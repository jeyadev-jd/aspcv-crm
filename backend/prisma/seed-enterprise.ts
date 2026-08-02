import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding enterprise data...')

  // ─── Workflow Templates ─────────────────────────────────────────────────────
  const wfSales = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-SALES' },
    update: {},
    create: {
      code: 'WF-SALES',
      name: 'Sales Invoice Workflow',
      description: 'Standard sales invoice approval: Supervisor > Finance Review > Finance Approval',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Supervisor Review', requiredRole: 'Supervisor', resolverType: 'Hierarchy', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 2, stepName: 'Finance Review', requiredRole: 'FinanceExec', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 3, stepName: 'Finance Approval', requiredRole: 'FinanceManager', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 4, stepName: 'Director Approval', requiredRole: 'Director', resolverType: 'Hierarchy', timeoutHours: 72, allowedActions: '["Approve","Reject"]' },
        ],
      },
    },
  })

  const wfPurchase = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-PURCHASE' },
    update: {},
    create: {
      code: 'WF-PURCHASE',
      name: 'Purchase Invoice Workflow',
      description: 'Purchase approval: Dept Manager > Finance Review > Finance Approval > Director',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Department Manager Review', requiredRole: 'DeptManager', resolverType: 'Department', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 2, stepName: 'Finance Review', requiredRole: 'FinanceExec', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 3, stepName: 'Finance Approval', requiredRole: 'FinanceManager', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 4, stepName: 'Director Approval', requiredRole: 'Director', resolverType: 'Hierarchy', timeoutHours: 72, allowedActions: '["Approve","Reject"]' },
        ],
      },
    },
  })

  const wfExpense = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-EXPENSE' },
    update: {},
    create: {
      code: 'WF-EXPENSE',
      name: 'Expense Claim Workflow',
      description: 'Expense claim: Supervisor > Dept Manager > Finance > Director (amount-based)',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Supervisor Review', requiredRole: 'Supervisor', resolverType: 'Hierarchy', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 2, stepName: 'Department Manager Approval', requiredRole: 'DeptManager', resolverType: 'Department', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 3, stepName: 'Finance Manager Approval', requiredRole: 'FinanceManager', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 4, stepName: 'Director Approval', requiredRole: 'Director', resolverType: 'Hierarchy', timeoutHours: 72, allowedActions: '["Approve","Reject"]' },
        ],
      },
    },
  })

  const wfService = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-SERVICE' },
    update: {},
    create: {
      code: 'WF-SERVICE',
      name: 'Service Invoice Workflow',
      description: 'Service invoice: Project Manager > Finance Approval',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Project Manager Review', requiredRole: 'DeptManager', resolverType: 'Project', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 2, stepName: 'Finance Approval', requiredRole: 'FinanceManager', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 3, stepName: 'Director Approval', requiredRole: 'Director', resolverType: 'Hierarchy', timeoutHours: 72, allowedActions: '["Approve","Reject"]' },
        ],
      },
    },
  })

  const wfProforma = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-PROFORMA' },
    update: {},
    create: {
      code: 'WF-PROFORMA',
      name: 'Proforma Invoice Workflow',
      description: 'Lightweight: Supervisor only',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Supervisor Review', requiredRole: 'Supervisor', resolverType: 'Hierarchy', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
        ],
      },
    },
  })

  const wfAdjustment = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-ADJUSTMENT' },
    update: {},
    create: {
      code: 'WF-ADJUSTMENT',
      name: 'Credit/Debit Note Workflow',
      description: 'Adjustment documents: Finance Review > Finance Approval',
      steps: {
        create: [
          { stepOrder: 1, stepName: 'Finance Review', requiredRole: 'FinanceExec', resolverType: 'Hierarchy', timeoutHours: 24, allowedActions: '["Approve","Reject","Return"]' },
          { stepOrder: 2, stepName: 'Finance Approval', requiredRole: 'FinanceManager', resolverType: 'Hierarchy', timeoutHours: 48, allowedActions: '["Approve","Reject"]' },
          { stepOrder: 3, stepName: 'Director Approval', requiredRole: 'Director', resolverType: 'Hierarchy', timeoutHours: 72, allowedActions: '["Approve","Reject"]' },
        ],
      },
    },
  })

  const wfAuto = await prisma.workflowTemplate.upsert({
    where: { code: 'WF-AUTO' },
    update: {},
    create: {
      code: 'WF-AUTO',
      name: 'Auto-Approve Workflow',
      description: 'Internal documents, auto-approved with no steps',
    },
  })

  // ─── Document Type Configs ──────────────────────────────────────────────────
  const docTypes = [
    { code: 'SINV', name: 'Sales Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'INV', gstApplicable: true, workflowTemplateId: wfSales.id, requiredFields: JSON.stringify(['customer','placeOfSupply','items']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'PINV', name: 'Purchase Invoice', category: 'Expense' as const, direction: 'Inbound' as const, numberPrefix: 'PINV', gstApplicable: true, workflowTemplateId: wfPurchase.id, requiredFields: JSON.stringify(['vendorId','items']), hiddenFields: JSON.stringify(['customer']), budgetCheckEnabled: true },
    { code: 'CN', name: 'Credit Note', category: 'Adjustment' as const, direction: 'Outbound' as const, numberPrefix: 'CN', gstApplicable: true, workflowTemplateId: wfAdjustment.id, requiredFields: JSON.stringify(['customer','originalInvoiceId','reason']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'DN', name: 'Debit Note', category: 'Adjustment' as const, direction: 'Outbound' as const, numberPrefix: 'DN', gstApplicable: true, workflowTemplateId: wfAdjustment.id, requiredFields: JSON.stringify(['customer','originalInvoiceId','reason']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'PI', name: 'Proforma Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'PI', gstApplicable: true, workflowTemplateId: wfProforma.id, requiredFields: JSON.stringify(['customer','items']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'CINV', name: 'Commercial Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'CINV', gstApplicable: false, workflowTemplateId: wfSales.id, requiredFields: JSON.stringify(['customer','items','currency','exchangeRate']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'RINV', name: 'Recurring Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'RINV', gstApplicable: true, workflowTemplateId: wfAuto.id, requiredFields: JSON.stringify(['customer','recurringProfileId']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'SERV', name: 'Service Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'SRV', gstApplicable: true, workflowTemplateId: wfService.id, requiredFields: JSON.stringify(['customer','projectId','items']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'TINV', name: 'Timesheet Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'TIM', gstApplicable: true, workflowTemplateId: wfService.id, requiredFields: JSON.stringify(['customer','projectId','timesheetHours']), hiddenFields: JSON.stringify(['vendorId']), budgetCheckEnabled: false },
    { code: 'FINV', name: 'Final Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'FNL', gstApplicable: true, workflowTemplateId: wfSales.id, requiredFields: JSON.stringify(['customer','projectId','milestoneId']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'EINV', name: 'Export Invoice', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'EXP', gstApplicable: false, workflowTemplateId: wfSales.id, requiredFields: JSON.stringify(['customer','items','currency','exchangeRate','shippingAddr']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'BOS', name: 'Bill of Supply', category: 'Revenue' as const, direction: 'Outbound' as const, numberPrefix: 'BOS', gstApplicable: false, workflowTemplateId: wfSales.id, requiredFields: JSON.stringify(['customer','items']), hiddenFields: JSON.stringify(['vendorId','employeeId']), budgetCheckEnabled: false },
    { code: 'EXP', name: 'Expense Claim', category: 'Expense' as const, direction: 'Internal' as const, numberPrefix: 'EXP', gstApplicable: false, workflowTemplateId: wfExpense.id, requiredFields: JSON.stringify(['employeeId','items','notes']), hiddenFields: JSON.stringify(['customer','vendorId','placeOfSupply']), requiredAttachments: JSON.stringify(['receipt']), budgetCheckEnabled: true },
    { code: 'TRV', name: 'Travel Claim', category: 'Expense' as const, direction: 'Internal' as const, numberPrefix: 'TRV', gstApplicable: false, workflowTemplateId: wfExpense.id, requiredFields: JSON.stringify(['employeeId','items','travelFrom','travelTo','travelDate']), hiddenFields: JSON.stringify(['customer','vendorId','placeOfSupply']), requiredAttachments: JSON.stringify(['receipt','ticket']), budgetCheckEnabled: true },
    { code: 'FUEL', name: 'Fuel Claim', category: 'Expense' as const, direction: 'Internal' as const, numberPrefix: 'FUL', gstApplicable: false, workflowTemplateId: wfExpense.id, requiredFields: JSON.stringify(['employeeId','vehicleNumber','odometerStart','odometerEnd','fuelType']), hiddenFields: JSON.stringify(['customer','vendorId','placeOfSupply']), requiredAttachments: JSON.stringify(['fuelReceipt']), budgetCheckEnabled: true },
    { code: 'HTL', name: 'Hotel Claim', category: 'Expense' as const, direction: 'Internal' as const, numberPrefix: 'HTL', gstApplicable: true, workflowTemplateId: wfExpense.id, requiredFields: JSON.stringify(['employeeId','hotelName','checkIn','checkOut']), hiddenFields: JSON.stringify(['customer','vendorId']), requiredAttachments: JSON.stringify(['hotelBill']), budgetCheckEnabled: true },
    { code: 'VBILL', name: 'Vendor Bill', category: 'Expense' as const, direction: 'Inbound' as const, numberPrefix: 'VB', gstApplicable: true, workflowTemplateId: wfPurchase.id, requiredFields: JSON.stringify(['vendorId','items','vendorInvoiceNo']), hiddenFields: JSON.stringify(['customer','employeeId']), budgetCheckEnabled: true },
    { code: 'CBILL', name: 'Contractor Bill', category: 'Expense' as const, direction: 'Inbound' as const, numberPrefix: 'CB', gstApplicable: true, workflowTemplateId: wfPurchase.id, requiredFields: JSON.stringify(['vendorId','projectId','items','workOrderId']), hiddenFields: JSON.stringify(['customer','employeeId']), requiredAttachments: JSON.stringify(['workCompletion']), budgetCheckEnabled: true },
  ]

  for (const dt of docTypes) {
    await prisma.documentTypeConfig.upsert({
      where: { code: dt.code },
      update: {},
      create: {
        code: dt.code,
        name: dt.name,
        category: dt.category,
        direction: dt.direction,
        numberPrefix: dt.numberPrefix,
        gstApplicable: dt.gstApplicable,
        workflowTemplateId: dt.workflowTemplateId,
        requiredFields: dt.requiredFields,
        hiddenFields: dt.hiddenFields || '[]',
        budgetCheckEnabled: dt.budgetCheckEnabled,
        requiredAttachments: (dt as any).requiredAttachments || '[]',
      },
    })
  }

  // ─── Approval Rules (amount-based tiers) ────────────────────────────────────

  // Rule: Skip Finance + Director for amounts <= 10,000
  await prisma.approvalRuleConfig.create({
    data: {
      name: 'Small Amount - Supervisor Only',
      description: 'Skip Finance and Director steps for amounts <= 10,000',
      priority: 10,
      conditions: {
        create: [
          { field: 'grandTotal', operator: 'lessThan', value: 10001 },
        ],
      },
      actions: JSON.stringify([
        { type: 'skipStep', config: { requiredRole: 'FinanceExec' } },
        { type: 'skipStep', config: { requiredRole: 'FinanceManager' } },
        { type: 'skipStep', config: { requiredRole: 'Director' } },
      ]),
    },
  })

  // Rule: Skip Director for amounts <= 2,00,000
  await prisma.approvalRuleConfig.create({
    data: {
      name: 'Medium Amount - No Director',
      description: 'Skip Director approval for amounts <= 2,00,000',
      priority: 20,
      conditions: {
        create: [
          { field: 'grandTotal', operator: 'lessThan', value: 200001 },
        ],
      },
      actions: JSON.stringify([
        { type: 'skipStep', config: { requiredRole: 'Director' } },
      ]),
    },
  })

  // Rule: Capital expense always needs Director
  await prisma.approvalRuleConfig.create({
    data: {
      name: 'Capital Expense - Director Required',
      description: 'Capital expenses always require Director approval regardless of amount',
      priority: 5,
      conditions: {
        create: [
          { field: 'isCapitalExpense', operator: 'equals', value: true },
        ],
      },
      actions: JSON.stringify([]),
    },
  })

  // Rule: Emergency priority skips to Director
  await prisma.approvalRuleConfig.create({
    data: {
      name: 'Emergency - Fast Track',
      description: 'Emergency priority documents skip intermediate steps',
      priority: 1,
      conditions: {
        create: [
          { field: 'priority', operator: 'equals', value: 'Emergency' },
        ],
      },
      actions: JSON.stringify([
        { type: 'skipStep', config: { requiredRole: 'Supervisor' } },
        { type: 'skipStep', config: { requiredRole: 'DeptManager' } },
      ]),
    },
  })

  console.log('Enterprise seed data created successfully!')
  console.log(`  - 7 workflow templates`)
  console.log(`  - ${docTypes.length} document type configs`)
  console.log(`  - 4 approval rules`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
