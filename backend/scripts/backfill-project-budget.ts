// One-off backfill: set Project.budget for projects where it was never set (0 or
// null), deriving it from the contract value that actually exists — the linked
// Quotation's totalAmount, falling back to the linked Deal's value.
//
// Why this is needed: profit = budget - totalExpenses. Seed data left budget
// unset on most projects, so profit came out as a large negative number for
// every project with real costs (0 - expenses), even though the project may be
// perfectly profitable against its real contract value. This never overwrites
// a budget that was already set — only fills in the ones that are genuinely
// missing. Safe to re-run.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    where: { OR: [{ budget: null }, { budget: 0 }] },
    select: {
      id: true, totalExpenses: true,
      quotation: { select: { totalAmount: true } },
      deal: { select: { value: true } },
    },
  })

  let filled = 0
  for (const p of projects) {
    const budget = p.quotation?.totalAmount || p.deal?.value || 0
    if (budget <= 0) continue // nothing to derive it from — leave as-is, don't fabricate a number

    const totalExpenses = p.totalExpenses || 0
    const profit = budget - totalExpenses
    const remainingBudget = Math.max(0, budget - totalExpenses)

    await prisma.project.update({
      where: { id: p.id },
      data: { budget, profit, remainingBudget },
    })
    filled++
  }

  console.log(`Checked ${projects.length} projects with no budget. Filled ${filled} from quotation/deal value.`)
}

main().finally(() => prisma.$disconnect())
