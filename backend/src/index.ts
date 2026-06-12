import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import productsRouter from './routes/products'
import invoicesRouter from './routes/invoices'
import tasksRouter from './routes/tasks'
import kanbanRouter from './routes/kanban'
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
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'] }))
app.use(express.json())

// Existing routes
app.use('/api/products', productsRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/kanban', kanbanRouter)
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
