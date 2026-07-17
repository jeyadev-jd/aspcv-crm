import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import productsRouter from './routes/products'
import invoicesRouter from './routes/invoices'
import tasksRouter from './routes/tasks'
import kanbanRouter from './routes/kanban'
import auditLogsRouter from './routes/audit-logs'
import businessRulesRouter from './routes/business-rules'
import { auditLogger } from './middleware/auditLogger'
import reportsRouter from './routes/reports'
import calendarRouter from './routes/calendar'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import companiesRouter from './routes/companies'
import contactsRouter from './routes/contacts'
import leadsRouter from './routes/leads'
import discussionsRouter from './routes/discussions'
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
import materialRequestsRouter from './routes/material-requests'
import componentsRouter from './routes/components'
import expensesRouter from './routes/expenses'
import financialsRouter from './routes/financials'
import approvalRequestsRouter from './routes/approval-requests'
import roleDefinitionsRouter from './routes/role-definitions'
import userPermissionsRouter from './routes/user-permissions'
import dealersRouter from './routes/dealers'
import itemsRouter from './routes/items'
import notificationsRouter from './routes/notifications'
import signatoriesRouter from './routes/signatories'
import bankAccountsRouter from './routes/bank-accounts'
import quotationsRouter from './routes/quotations'
import salesOrdersRouter from './routes/sales-orders'
import handoverDocumentsRouter from './routes/handover-documents'
import bomRouter from './routes/bom'
import purchaseOrdersRouter from './routes/purchase-orders'
import goodsReceiptsRouter from './routes/goods-receipts'
import inventoryAllocationsRouter from './routes/inventory-allocations'
import workOrdersRouter from './routes/work-orders'
import serviceRecordsRouter from './routes/service-records'
import { errorHandler } from './middleware/errorHandler'
import analyticsRouter from './routes/analytics'

const app = express()
const PORT = process.env.PORT || 4000

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173']
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(auditLogger)

// Existing routes
app.use('/api/analytics', analyticsRouter)
app.use('/api/products', productsRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/kanban', kanbanRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api/business-rules', businessRulesRouter)
app.use('/api/calendar', calendarRouter)

// Enterprise routes
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/companies', companiesRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/discussions', discussionsRouter)
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
app.use('/api/material-requests', materialRequestsRouter)
app.use('/api/components', componentsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/financials', financialsRouter)
app.use('/api/approval-requests', approvalRequestsRouter)
app.use('/api/role-definitions', roleDefinitionsRouter)
app.use('/api/user-permissions', userPermissionsRouter)
app.use('/api/dealers', dealersRouter)
app.use('/api/items', itemsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/signatories', signatoriesRouter)
app.use('/api/bank-accounts', bankAccountsRouter)

// ERP routes
app.use('/api/quotations', quotationsRouter)
app.use('/api/sales-orders', salesOrdersRouter)
app.use('/api/handover-documents', handoverDocumentsRouter)
app.use('/api/bom', bomRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
app.use('/api/goods-receipts', goodsReceiptsRouter)
app.use('/api/inventory-allocations', inventoryAllocationsRouter)
app.use('/api/work-orders', workOrdersRouter)
app.use('/api/service-records', serviceRecordsRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
