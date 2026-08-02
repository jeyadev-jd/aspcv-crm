import prisma from '../lib/prisma'
import type { Invoice, WorkflowInstance, ApprovalActionType, InvoiceStatus } from '@prisma/client'

interface ApproverInfo {
  userId: string
  stepOrder: number
  stepName: string
}

export async function startWorkflow(invoiceId: string, templateCode?: string): Promise<WorkflowInstance> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { documentTypeConfig: true },
  })

  let templateId = templateCode
    ? (await prisma.workflowTemplate.findUniqueOrThrow({ where: { code: templateCode } })).id
    : invoice.documentTypeConfig?.workflowTemplateId

  if (!templateId) {
    const typeToCode: Record<string, string> = {
      TaxInvoice: 'SINV', SalesInvoice: 'SINV', BillOfSupply: 'BOS',
      CreditNote: 'CN', DebitNote: 'DN', ProformaInvoice: 'PI',
      ExportInvoice: 'EINV', CommercialInvoice: 'CINV', RecurringInvoice: 'RINV',
      ServiceInvoice: 'SERV', TimesheetInvoice: 'TINV', FinalInvoice: 'FINV',
      PurchaseInvoice: 'PINV', ExpenseClaim: 'EXP', TravelClaim: 'TRV',
      FuelClaim: 'FUEL', HotelClaim: 'HTL', VendorBill: 'VBILL',
      MaterialPurchase: 'PINV', ContractorBill: 'CBILL',
    }
    const code = typeToCode[invoice.invoiceType] || 'SINV'
    const config = await prisma.documentTypeConfig.findUnique({ where: { code } })
    if (config?.workflowTemplateId) {
      templateId = config.workflowTemplateId
      await prisma.invoice.update({ where: { id: invoiceId }, data: { documentTypeConfigId: config.id } })
    }
  }

  if (!templateId) {
    throw new Error('No workflow template configured for this document type')
  }

  const template = await prisma.workflowTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  if (template.steps.length === 0) {
    throw new Error('Workflow template has no steps')
  }

  const applicableSteps = await filterStepsByRules(template.steps, invoice)

  if (applicableSteps.length === 0) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'Approved', approvedAt: new Date() },
    })
    return prisma.workflowInstance.create({
      data: {
        invoiceId,
        templateId,
        currentStepOrder: 0,
        status: 'Completed',
        completedAt: new Date(),
      },
    })
  }

  const firstStep = applicableSteps[0]
  const approver = await resolveApprover(firstStep, invoice)

  const instance = await prisma.workflowInstance.create({
    data: {
      invoiceId,
      templateId,
      currentStepOrder: firstStep.stepOrder,
      status: 'InProgress',
      approvalActions: {
        create: {
          stepOrder: firstStep.stepOrder,
          stepName: firstStep.stepName,
          assignedToId: approver.userId,
        },
      },
    },
  })

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: mapStepToStatus(firstStep.stepName),
      submittedAt: new Date(),
    },
  })

  return instance
}

export async function performAction(
  instanceId: string,
  userId: string,
  action: ApprovalActionType,
  comments?: string,
  delegateToId?: string,
  ipAddress?: string,
): Promise<{ nextStep: string | null; completed: boolean }> {
  const fullInstance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { id: instanceId },
    include: {
      template: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      invoice: true,
    },
  })

  const pendingAction = await prisma.approvalAction.findFirst({
    where: { instanceId, stepOrder: fullInstance.currentStepOrder, action: null },
  })

  if (!pendingAction) {
    throw new Error('No pending approval action at current step')
  }

  if (pendingAction.assignedToId !== userId) {
    throw new Error('You are not the assigned approver for this step')
  }

  // Maker-checker: submitter cannot approve own document
  if (action === 'Approve' && fullInstance.invoice.createdById === userId) {
    throw new Error('Maker-checker violation: you cannot approve your own document')
  }

  await prisma.approvalAction.update({
    where: { id: pendingAction.id },
    data: {
      action,
      actionAt: new Date(),
      comments: comments || null,
      delegatedToId: action === 'Delegate' ? delegateToId : null,
      ipAddress,
    },
  })

  if (action === 'Reject') {
    await prisma.$transaction([
      prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'Completed', completedAt: new Date() },
      }),
      prisma.invoice.update({
        where: { id: fullInstance.invoiceId },
        data: { status: 'Rejected', rejectedAt: new Date(), rejectReason: comments },
      }),
    ])
    return { nextStep: null, completed: true }
  }

  if (action === 'Return') {
    await prisma.$transaction([
      prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'Cancelled' },
      }),
      prisma.invoice.update({
        where: { id: fullInstance.invoiceId },
        data: { status: 'Returned', returnedAt: new Date(), returnReason: comments },
      }),
    ])
    return { nextStep: null, completed: true }
  }

  if (action === 'Delegate') {
    if (!delegateToId) throw new Error('Delegate target user required')
    await prisma.approvalAction.create({
      data: {
        instanceId,
        stepOrder: fullInstance.currentStepOrder,
        stepName: pendingAction.stepName,
        assignedToId: delegateToId,
      },
    })
    return { nextStep: pendingAction.stepName + ' (delegated)', completed: false }
  }

  // Action === Approve — advance to next step
  const steps = fullInstance.template.steps
  const applicableSteps = await filterStepsByRules(steps, fullInstance.invoice)
  const currentIdx = applicableSteps.findIndex(s => s.stepOrder === fullInstance.currentStepOrder)
  const nextStep = applicableSteps[currentIdx + 1]

  if (!nextStep) {
    // All steps completed
    await prisma.$transaction([
      prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'Completed', completedAt: new Date() },
      }),
      prisma.invoice.update({
        where: { id: fullInstance.invoiceId },
        data: { status: 'Approved', approvedBy: userId, approvedAt: new Date() },
      }),
    ])
    return { nextStep: null, completed: true }
  }

  // Move to next step
  const nextApprover = await resolveApprover(nextStep, fullInstance.invoice)
  await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { currentStepOrder: nextStep.stepOrder },
    }),
    prisma.approvalAction.create({
      data: {
        instanceId,
        stepOrder: nextStep.stepOrder,
        stepName: nextStep.stepName,
        assignedToId: nextApprover.userId,
      },
    }),
    prisma.invoice.update({
      where: { id: fullInstance.invoiceId },
      data: { status: mapStepToStatus(nextStep.stepName) },
    }),
  ])

  return { nextStep: nextStep.stepName, completed: false }
}

export async function getMyPendingApprovals(userId: string) {
  return prisma.approvalAction.findMany({
    where: { assignedToId: userId, action: null },
    include: {
      instance: {
        include: {
          invoice: { select: { id: true, number: true, customer: true, grandTotal: true, invoiceType: true, date: true, createdById: true } },
          template: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getWorkflowHistory(invoiceId: string) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { invoiceId },
    include: {
      template: { select: { name: true, code: true } },
      approvalActions: {
        include: {
          assignedTo: { select: { id: true, name: true, roleName: true } },
          delegatedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return instance
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function filterStepsByRules(steps: any[], invoice: Invoice): Promise<any[]> {
  const rules = await prisma.approvalRuleConfig.findMany({
    where: { isActive: true },
    include: { conditions: true },
    orderBy: { priority: 'asc' },
  })

  let stepsToSkip: number[] = []
  let stepsToAdd: any[] = []

  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, invoice)) continue
    const actions = rule.actions as any[]
    for (const act of actions) {
      if (act.type === 'skipStep') stepsToSkip.push(act.config.stepOrder)
      if (act.type === 'addStep') stepsToAdd.push(act.config)
    }
  }

  // Amount-based defaults: skip Director for amounts ≤ ₹2,00,000 unless capital expense
  const total = invoice.grandTotal || 0
  if (total <= 200000 && !invoice.isCapitalExpense) {
    const directorStep = steps.find(s => s.requiredRole === 'Director')
    if (directorStep) stepsToSkip.push(directorStep.stepOrder)
  }
  // Skip supervisor for amounts > ₹50,000 (goes directly to dept manager)
  if (total <= 10000) {
    const deptMgrStep = steps.find(s => s.requiredRole === 'DeptManager')
    const finStep = steps.find(s => s.requiredRole === 'FinanceExec' || s.requiredRole === 'FinanceManager')
    if (deptMgrStep) stepsToSkip.push(deptMgrStep.stepOrder)
    if (finStep) stepsToSkip.push(finStep.stepOrder)
  }

  return steps.filter(s => !stepsToSkip.includes(s.stepOrder))
}

function evaluateConditions(conditions: any[], invoice: Invoice): boolean {
  for (const cond of conditions) {
    const fieldValue = (invoice as any)[cond.field]
    const condValue = cond.value

    switch (cond.operator) {
      case 'equals':
        if (fieldValue !== condValue) return false
        break
      case 'in':
        if (!Array.isArray(condValue) || !condValue.includes(fieldValue)) return false
        break
      case 'greaterThan':
        if (typeof fieldValue !== 'number' || fieldValue <= condValue) return false
        break
      case 'lessThan':
        if (typeof fieldValue !== 'number' || fieldValue >= condValue) return false
        break
      case 'between':
        if (typeof fieldValue !== 'number' || fieldValue < condValue[0] || fieldValue > condValue[1]) return false
        break
      case 'isNotNull':
        if (fieldValue == null) return false
        break
    }
  }
  return true
}

async function resolveApprover(step: any, invoice: Invoice): Promise<ApproverInfo> {
  const resolverType = step.resolverType || 'Hierarchy'

  switch (resolverType) {
    case 'Fixed': {
      const config = step.resolverConfig as any
      return { userId: config.userId, stepOrder: step.stepOrder, stepName: step.stepName }
    }

    case 'Hierarchy': {
      // Walk up reporting chain to find someone with the required role level
      const user = invoice.createdById
        ? await prisma.user.findUnique({ where: { id: invoice.createdById } })
        : null
      if (!user) throw new Error('Cannot resolve approver: no creator on invoice')

      // Find users in same department with required role
      const roleMap: Record<string, string[]> = {
        Supervisor: ['SeniorEngineer', 'Manager'],
        DeptManager: ['Manager', 'BusinessHead', 'ProjectHead'],
        FinanceExec: ['Accountant'],
        FinanceManager: ['Manager', 'BusinessHead'],
        Director: ['SuperAdmin', 'BusinessHead'],
      }
      const validRoles = roleMap[step.requiredRole] || [step.requiredRole]
      const candidates = await prisma.user.findMany({
        where: {
          role: { in: validRoles as any[] },
          isActive: true,
          id: { not: invoice.createdById || undefined },
          ...(step.requiredRole !== 'Director' && step.requiredRole !== 'FinanceExec' && step.requiredRole !== 'FinanceManager'
            ? { departmentId: user.departmentId }
            : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      })
      if (candidates.length === 0) {
        // Fallback: find any SuperAdmin
        const admin = await prisma.user.findFirst({ where: { role: 'SuperAdmin', isActive: true } })
        if (!admin) throw new Error(`No approver found for role: ${step.requiredRole}`)
        return { userId: admin.id, stepOrder: step.stepOrder, stepName: step.stepName }
      }
      return { userId: candidates[0].id, stepOrder: step.stepOrder, stepName: step.stepName }
    }

    case 'Department': {
      const dept = invoice.departmentId
        ? await prisma.department.findUnique({ where: { id: invoice.departmentId } })
        : null
      if (dept?.headUserId) {
        return { userId: dept.headUserId, stepOrder: step.stepOrder, stepName: step.stepName }
      }
      // Fallback to hierarchy
      return resolveApprover({ ...step, resolverType: 'Hierarchy' }, invoice)
    }

    case 'Project': {
      if (invoice.projectId) {
        const project = await prisma.project.findUnique({ where: { id: invoice.projectId } })
        if (project?.assignedPMId) {
          return { userId: project.assignedPMId, stepOrder: step.stepOrder, stepName: step.stepName }
        }
      }
      return resolveApprover({ ...step, resolverType: 'Hierarchy' }, invoice)
    }

    case 'Pool': {
      const validRoles = [step.requiredRole]
      const poolUser = await prisma.user.findFirst({
        where: { roleName: { in: validRoles }, isActive: true },
      })
      if (!poolUser) throw new Error(`No pool user for role: ${step.requiredRole}`)
      return { userId: poolUser.id, stepOrder: step.stepOrder, stepName: step.stepName }
    }

    default:
      throw new Error(`Unknown resolver type: ${resolverType}`)
  }
}

function mapStepToStatus(stepName: string): InvoiceStatus {
  const name = stepName.toLowerCase()
  if (name.includes('supervisor') || name.includes('dept')) return 'DeptReview'
  if (name.includes('manager') && !name.includes('finance')) return 'MgrApproval'
  if (name.includes('finance') && name.includes('review')) return 'FinanceReview'
  if (name.includes('finance') && name.includes('approv')) return 'FinanceApproval'
  if (name.includes('director')) return 'DirectorApproval'
  return 'PendingApproval'
}
