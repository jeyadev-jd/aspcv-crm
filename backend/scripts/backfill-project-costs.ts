// One-off backfill: recompute each Project's cached cost columns (purchaseCost,
// manufacturingCost, labourCost, serviceCost, totalExpenses, profit) from real
// child-table data.
//
// Why this is needed: those columns are normally kept in sync incrementally by
// the goods-receipts / work-orders / service-records / material-requests route
// handlers whenever a real user action happens. Seed data was inserted directly
// via Prisma (prisma.workOrder.create, prisma.goodsReceipt.create, ...), which
// bypasses those handlers entirely — so the columns stayed at their default of 0
// even though the child rows carry real costs. This script derives the same
// totals those handlers would have produced, using identical formulas, and
// writes them once. Safe to re-run — it recomputes from source data rather than
// incrementing, so it never double-counts.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, budget: true } }) // budget included for profit/remaining calc
  let updated = 0

  for (const project of projects) {
    const [poItems, mrPaid, workOrders, serviceRequests] = await Promise.all([
      // Purchase cost: goods-receipt line items for POs linked to this project.
      prisma.goodsReceiptItem.findMany({
        where: { goodsReceipt: { purchaseOrder: { projectId: project.id } } },
        select: { unitPrice: true, quantity: true },
      }),
      // Paid material requests roll their spend into purchaseCost too (material-requests.ts).
      prisma.materialRequest.findMany({
        where: { projectId: project.id, status: 'paid' },
        select: { totalEstimated: true, items: { select: { unitPrice: true, estimatedPrice: true, quantity: true } } },
      }),
      prisma.workOrder.findMany({ where: { projectId: project.id }, select: { materialCost: true, labourCost: true } }),
      prisma.serviceRequest.findMany({ where: { serviceRecord: { projectId: project.id } }, select: { cost: true } }),
    ])

    const purchaseFromGR = poItems.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0)
    const purchaseFromMR = mrPaid.reduce((s, mr) => s + (mr.totalEstimated ?? mr.items.reduce((a, i) => a + (i.unitPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0)), 0)
    const purchaseCost = purchaseFromGR + purchaseFromMR
    const manufacturingCost = workOrders.reduce((s, w) => s + (w.materialCost || 0), 0)
    const labourCost = workOrders.reduce((s, w) => s + (w.labourCost || 0), 0)
    const serviceCost = serviceRequests.reduce((s, r) => s + (r.cost || 0), 0)
    const installationCost = 0 // no write-path sets this anywhere in the app today

    const totalExpenses = purchaseCost + manufacturingCost + labourCost + serviceCost + installationCost
    const budget = project.budget || 0
    const profit = budget - totalExpenses
    // work-orders.ts decrements this on each material consumption; derive the same result.
    const remainingBudget = Math.max(0, budget - totalExpenses)

    await prisma.project.update({
      where: { id: project.id },
      data: { purchaseCost, manufacturingCost, labourCost, serviceCost, installationCost, totalExpenses, profit, remainingBudget },
    })
    if (totalExpenses > 0) updated++
  }

  console.log(`Backfilled cost columns for ${projects.length} projects (${updated} had non-zero expenses).`)
}

main().finally(() => prisma.$disconnect())
