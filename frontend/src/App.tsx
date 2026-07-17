import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyProvider } from '@/lib/currencyContext'
import { CrmDataProvider } from '@/lib/crmDataContext'
import { ToastProvider, setGlobalToast, useToast } from '@/lib/toast'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PermGuard from '@/components/auth/PermGuard'
import LoginPage from '@/components/auth/LoginPage'
import Dashboard from '@/pages/Dashboard'
import Leads from '@/pages/Leads'
import Accounts from '@/pages/Accounts'
import Customer360 from '@/pages/Customer360'
import Contacts from '@/pages/Contacts'
import Deals from '@/pages/Deals'
import Projects from '@/pages/Projects'
import Tasks from '@/pages/Tasks'
import Kanban from '@/pages/Kanban'
import CalendarPage from '@/pages/Calendar'
import Invoices from '@/pages/Invoices'
import Support from '@/pages/Support'
import Dealers from '@/pages/Dealers'
import Items from '@/pages/Items'
import RawComponents from '@/pages/RawComponents'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import MLAnalytics from '@/pages/MLAnalytics'
import HR from '@/pages/HR'
import Attendance from '@/pages/Attendance'
import Payroll from '@/pages/Payroll'
import MyProfile from '@/pages/MyProfile'
import MaterialRequests from '@/pages/MaterialRequests'
import Financials from '@/pages/Financials'
import Roles from '@/pages/Roles'
import Approvals from '@/pages/Approvals'
import UserManagement from '@/pages/UserManagement'
import AuditLogs from '@/pages/AuditLogs'
import BusinessRules from '@/pages/BusinessRules'
import Procurement from '@/pages/Procurement'
import Manufacturing from '@/pages/Manufacturing'
import Budget from '@/pages/Budget'
import Service from '@/pages/Service'
import Installations from '@/pages/Installations'
import Sales from '@/pages/Sales'
import CompletedProjects from '@/pages/CompletedProjects'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: {
      onError: (err: unknown) => {
        Promise.all([import('@/lib/toast'), import('@/lib/apiError')]).then(([toastMod, errMod]) => {
          toastMod.toast.error(errMod.friendlyError(err))
        })
      },
    },
  },
})

// Inner component so useToast works inside ToastProvider
function ToastBridge() {
  const { show } = useToast()
  setGlobalToast(show)
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <ToastProvider>
    <ToastBridge />
    <CurrencyProvider>
    <CrmDataProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Public to any authenticated user */}
            <Route path="/"          element={<Dashboard />} />
            <Route path="/tasks"     element={<Tasks />} />
            <Route path="/kanban"    element={<Kanban />} />
            <Route path="/calendar"  element={<CalendarPage />} />
            <Route path="/profile"   element={<MyProfile />} />
            <Route path="/dealers"   element={<Dealers />} />
            <Route path="/items"     element={<Items />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/ml-analytics" element={<MLAnalytics />} />
            <Route path="/settings"  element={<Settings />} />

            {/* Permission-gated */}
            <Route path="/leads"     element={<PermGuard resource="lead" action="read_own"><Leads /></PermGuard>} />
            <Route path="/accounts"  element={<PermGuard resource="company" action="read_all"><Accounts /></PermGuard>} />
            <Route path="/customers/:id" element={<PermGuard resource="company" action="read_all"><Customer360 /></PermGuard>} />
            <Route path="/contacts"  element={<PermGuard resource="contact" action="read_own"><Contacts /></PermGuard>} />
            <Route path="/deals"     element={<PermGuard resource="deal" action="read_own"><Deals /></PermGuard>} />
            <Route path="/projects"  element={<PermGuard resource="project" action="read_all"><Projects /></PermGuard>} />
            <Route path="/invoices"  element={<PermGuard resource="invoice" action="read_all"><Invoices /></PermGuard>} />
            <Route path="/support"        element={<PermGuard resource="support" action="create"><Support /></PermGuard>} />
            <Route path="/raw-components" element={<PermGuard resource="component" action="read_all"><RawComponents /></PermGuard>} />
            <Route path="/hr"               element={<PermGuard resource="hr_user" action="read_all"><HR /></PermGuard>} />
            <Route path="/attendance"       element={<PermGuard resource="attendance" action="read_own"><Attendance /></PermGuard>} />
            <Route path="/payroll"          element={<PermGuard resource="salary" action="read_own"><Payroll /></PermGuard>} />
            <Route path="/material-requests" element={<PermGuard resource="material_request" action="create"><MaterialRequests /></PermGuard>} />
            <Route path="/inventory"        element={<Navigate to="/raw-components" replace />} />
            <Route path="/financials"       element={<PermGuard resource="financial" action="read_all"><Financials /></PermGuard>} />
            <Route path="/roles"            element={<PermGuard resource="role_admin" action="manage"><Roles /></PermGuard>} />
            <Route path="/approvals"        element={<PermGuard resource="approval_request" action="review"><Approvals /></PermGuard>} />
            <Route path="/users"            element={<PermGuard resource="role_admin" action="manage"><UserManagement /></PermGuard>} />
            <Route path="/audit-logs"       element={<PermGuard resource="audit_log" action="read_all"><AuditLogs /></PermGuard>} />
            <Route path="/business-rules"   element={<PermGuard resource="business_rule" action="read_all"><BusinessRules /></PermGuard>} />
            {/* ERP modules */}
            <Route path="/sales"              element={<PermGuard resource="quotation" action="read_all"><Sales /></PermGuard>} />
            <Route path="/procurement"        element={<PermGuard resource="bom" action="read_all"><Procurement /></PermGuard>} />
            <Route path="/manufacturing"      element={<PermGuard resource="work_order" action="read_all"><Manufacturing /></PermGuard>} />
            <Route path="/service"            element={<PermGuard resource="service_record" action="read_all"><Service /></PermGuard>} />
            <Route path="/installations"      element={<PermGuard resource="installation" action="read_all"><Installations /></PermGuard>} />
            <Route path="/completed-projects" element={<PermGuard resource="project" action="read_all"><CompletedProjects /></PermGuard>} />
            <Route path="/budget"             element={<PermGuard resource="project" action="read_all"><Budget /></PermGuard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </CrmDataProvider>
    </CurrencyProvider>
    </ToastProvider>
    </QueryClientProvider>
  )
}
