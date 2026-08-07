import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import productsRouter from './routes/products'
import invoicesRouter from './routes/invoices'
import tasksRouter from './routes/tasks'
import auditLogsRouter from './routes/audit-logs'
import businessRulesRouter from './routes/business-rules'
import dataTransferRouter from './routes/data-transfer'
import { auditLogger } from './middleware/auditLogger'
import reportsRouter from './routes/reports'
import calendarRouter from './routes/calendar'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import companiesRouter from './routes/companies'
import contactsRouter from './routes/contacts'
import leadsRouter from './routes/leads'
import discussionsRouter from './routes/discussions'
import scopeItemsRouter from './routes/scope-items'
import timelineRouter from './routes/timeline'
import locationRouter from './routes/location'
import attachmentsRouter from './routes/attachments'
import dealsRouter from './routes/deals'
import projectsRouter from './routes/projects'
import installationsRouter from './routes/installations'
import supportRouter from './routes/support'
import designationsRouter from './routes/designations'
import departmentsRouter from './routes/departments'
import regionsRouter from './routes/regions'
import countriesRouter from './routes/countries'
import commercialModelsRouter from './routes/commercial-models'
import leadSourcesMasterRouter from './routes/lead-sources-master'
import reasonCodesRouter from './routes/reason-codes'
import capacityUnitsRouter from './routes/capacity-units'
import solutionsRouter from './routes/solutions'
import industriesRouter from './routes/industries'
import contactEventsRouter from './routes/contact-events'
import attendanceRouter from './routes/attendance'
import salaryRouter from './routes/salary'
import leaveRouter from './routes/leave'
import reimbursementRouter from './routes/reimbursement'
import fnfRouter from './routes/fnf'
import salaryStructureRouter from './routes/salary-structure'
import materialRequestsRouter from './routes/material-requests'
import componentsRouter from './routes/components'
import expensesRouter from './routes/expenses'
import approvalRequestsRouter from './routes/approval-requests'
import roleDefinitionsRouter from './routes/role-definitions'
import userPermissionsRouter from './routes/user-permissions'
import dealersRouter from './routes/dealers'
import itemsRouter from './routes/items'
import notificationsRouter from './routes/notifications'
import signatoriesRouter from './routes/signatories'
import bankAccountsRouter from './routes/bank-accounts'
import searchRouter from './routes/search'
import companyProfileRouter from './routes/company-profile'
import quotationsRouter from './routes/quotations'
import purchaseOrdersRouter from './routes/purchase-orders'
import goodsReceiptsRouter from './routes/goods-receipts'
import inventoryAllocationsRouter from './routes/inventory-allocations'
import workOrdersRouter from './routes/work-orders'
import serviceRecordsRouter from './routes/service-records'
import recruitmentRouter from './routes/recruitment'
import onboardingRouter from './routes/onboarding'
import performanceRouter from './routes/performance'
import branchesRouter from './routes/branches'
import amcRouter from './routes/amc'
import ledgerRouter from './routes/ledger'
import departmentBudgetsRouter from './routes/department-budgets'
import locationOverridesRouter from './routes/location-overrides'
import { errorHandler } from './middleware/errorHandler'
import './services/businessRules' // register all rule handlers (side-effect import)
import { runAllRules } from './services/rulesEngine'
import { scanMissingAmcDetails } from './services/amcReminder'

const app = express()
const PORT = process.env.PORT || 4000

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173']
/**
 * Security headers. This process serves a JSON API plus file downloads - it
 * never returns HTML - so the restrictive CSP below costs nothing here and
 * still blocks anything injected into an error page or a sniffed response.
 *
 * crossOriginResourcePolicy is relaxed to same-site because the frontend runs
 * on a different port in development and fetches attachments from this origin.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      // useDefaults would add upgrade-insecure-requests, which rewrites http://
      // to https:// in the browser and breaks local development over plain HTTP.
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Only meaningful over HTTPS; harmless on plain HTTP but pointless, so it
    // is enabled only in production where TLS is expected to terminate.
    hsts: process.env.NODE_ENV === 'production',
    referrerPolicy: { policy: 'no-referrer' },
  }),
)

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(auditLogger)

// Existing routes
app.use('/api/products', productsRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api/business-rules', businessRulesRouter)
app.use('/api/data-transfer', dataTransferRouter)
app.use('/api/calendar', calendarRouter)

// Enterprise routes
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/companies', companiesRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/discussions', discussionsRouter)
app.use('/api/scope-items', scopeItemsRouter)
app.use('/api/timeline', timelineRouter)
app.use('/api/location', locationRouter)
app.use('/api/attachments', attachmentsRouter)
app.use('/api/deals', dealsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/installations', installationsRouter)
app.use('/api/support', supportRouter)
app.use('/api/designations', designationsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/regions', regionsRouter)
app.use('/api/countries', countriesRouter)
app.use('/api/commercial-models', commercialModelsRouter)
app.use('/api/lead-sources-master', leadSourcesMasterRouter)
app.use('/api/reason-codes', reasonCodesRouter)
app.use('/api/capacity-units', capacityUnitsRouter)
app.use('/api/solutions', solutionsRouter)
app.use('/api/industries', industriesRouter)
app.use('/api/contact-events', contactEventsRouter)
app.use('/api/attendance', attendanceRouter)
app.use('/api/salary', salaryRouter)
app.use('/api/leave', leaveRouter)
app.use('/api/reimbursement', reimbursementRouter)
app.use('/api/fnf', fnfRouter)
app.use('/api/salary-structure', salaryStructureRouter)
app.use('/api/material-requests', materialRequestsRouter)
app.use('/api/components', componentsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/approval-requests', approvalRequestsRouter)
app.use('/api/role-definitions', roleDefinitionsRouter)
app.use('/api/user-permissions', userPermissionsRouter)
app.use('/api/dealers', dealersRouter)
app.use('/api/items', itemsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/signatories', signatoriesRouter)
app.use('/api/bank-accounts', bankAccountsRouter)
app.use('/api/search', searchRouter)
app.use('/api/company-profile', companyProfileRouter)

// ERP routes
app.use('/api/quotations', quotationsRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
app.use('/api/goods-receipts', goodsReceiptsRouter)
app.use('/api/inventory-allocations', inventoryAllocationsRouter)
app.use('/api/work-orders', workOrdersRouter)
app.use('/api/service-records', serviceRecordsRouter)

// HR modules
app.use('/api/recruitment', recruitmentRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/performance', performanceRouter)
app.use('/api/branches', branchesRouter)
app.use('/api/amc', amcRouter)
app.use('/api/ledger', ledgerRouter)
app.use('/api/department-budgets', departmentBudgetsRouter)
app.use('/api/location-overrides', locationOverridesRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)

  // Run business rules scan every 5 minutes
  const RULES_INTERVAL_MS = 5 * 60 * 1000
  const runRulesSafe = () => runAllRules().catch(err => console.error('[rules] scan error:', err))
  runRulesSafe() // run once on startup
  setInterval(runRulesSafe, RULES_INTERVAL_MS)

  // Daily nudge for completed projects still missing warranty/AMC details
  const AMC_INTERVAL_MS = 24 * 60 * 60 * 1000
  const runAmcScanSafe = () =>
    scanMissingAmcDetails().catch(err => console.error('[amc] reminder scan error:', err))
  runAmcScanSafe()
  setInterval(runAmcScanSafe, AMC_INTERVAL_MS)
})
