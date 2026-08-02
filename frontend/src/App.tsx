import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyProvider } from '@/lib/currencyContext'
import { CrmDataProvider } from '@/lib/crmDataContext'
import { ToastProvider, setGlobalToast, useToast } from '@/lib/toast'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import PermGuard from '@/components/auth/PermGuard'
import LoginPage from '@/components/auth/LoginPage'
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/components/auth/ResetPasswordPage'
import ChangePasswordPage from '@/components/auth/ChangePasswordPage'
import Dashboard from '@/pages/Dashboard'
import Leads from '@/pages/Leads'
import Accounts from '@/pages/Accounts'
import Customer360 from '@/pages/Customer360'
import Contacts from '@/pages/Contacts'
import Deals from '@/pages/Deals'
import Projects from '@/pages/Projects'
import Service from '@/pages/Service'
import Tasks from '@/pages/Tasks'
import CalendarPage from '@/pages/Calendar'
import Invoices from '@/pages/Invoices'
import Support from '@/pages/Support'
import Dealers from '@/pages/Dealers'
import Items from '@/pages/Items'
import RawComponents from '@/pages/RawComponents'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import HR from '@/pages/HR'
import Attendance from '@/pages/Attendance'
import Leave from '@/pages/Leave'
import MyProfile from '@/pages/MyProfile'
import Help from '@/pages/Help'
import Warehouse from '@/pages/Warehouse'
import Roles from '@/pages/Roles'
import Approvals from '@/pages/Approvals'
import UserManagement from '@/pages/UserManagement'
import AuditLogs from '@/pages/AuditLogs'
import BusinessRules from '@/pages/BusinessRules'
import Reimbursements from '@/pages/Reimbursements'
import FnFSettlement from '@/pages/FnFSettlement'
import Performance from '@/pages/Performance'
import HRReports from '@/pages/HRReports'
import Notifications from '@/pages/Notifications'
import NotFound from '@/pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: {
    // Shared records change under you while you work, so they refetch on focus
    // rather than serving a stale cache for half a minute.
    queries: { retry: 1, staleTime: 0, refetchOnWindowFocus: true },
    mutations: {
      // React Query v5 runs this *in addition to* a mutation's own onError, so
      // it only fires when the caller has not handled the error itself —
      // otherwise one failure would raise two toasts.
      onError: (err: unknown, _vars, _ctx, mutation) => {
        if (mutation?.options.onError) return
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
  useEffect(() => {
    useAuthStore.getState().initCrossTabSync()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
    <ToastProvider>
    <ToastBridge />
    <CurrencyProvider>
    <CrmDataProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Public to any authenticated user */}
            <Route path="/"          element={<Dashboard />} />
            <Route path="/tasks"     element={<Tasks />} />
            <Route path="/calendar"  element={<CalendarPage />} />
            <Route path="/profile"   element={<MyProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/dealers"   element={<PermGuard resource="dealer" action="read_all"><Dealers /></PermGuard>} />
            <Route path="/items"     element={<PermGuard resource="dealer_item" action="read_all"><Items /></PermGuard>} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/settings"  element={<PermGuard resource="role_admin" action="manage"><Settings /></PermGuard>} />

            {/* Permission-gated */}
            <Route path="/leads"     element={<PermGuard resource="lead" action="read_own"><Leads /></PermGuard>} />
            <Route path="/accounts"  element={<PermGuard resource="company" action="read_all"><Accounts /></PermGuard>} />
            <Route path="/customers/:id" element={<PermGuard resource="company" action="read_all"><Customer360 /></PermGuard>} />
            <Route path="/contacts"  element={<PermGuard resource="contact" action="read_own"><Contacts /></PermGuard>} />
            <Route path="/deals"     element={<PermGuard resource="deal" action="read_own"><Deals /></PermGuard>} />
            <Route path="/projects"  element={<Projects />} />
            <Route path="/service"   element={<Service />} />
            <Route path="/esco"      element={<Navigate to="/service" replace />} />
            <Route path="/invoices"  element={<PermGuard resource="invoice" action="read_all"><Invoices /></PermGuard>} />
            <Route path="/support"        element={<PermGuard resource="support" action="create"><Support /></PermGuard>} />
            <Route path="/raw-components" element={<PermGuard resource="component" action="read_all"><RawComponents /></PermGuard>} />
            {/* HR hub — Attendance, Payroll, Salary Structure, Recruitment,
                Onboarding and HR Settings are tabs inside it, not routes */}
            <Route path="/hr"               element={<HR />} />
            <Route path="/attendance"       element={<Attendance />} />
            <Route path="/payroll"          element={<Navigate to="/hr" replace />} />
            <Route path="/salary-structure" element={<Navigate to="/hr" replace />} />
            <Route path="/hr-settings"      element={<Navigate to="/hr" replace />} />
            <Route path="/recruitment"      element={<Navigate to="/hr" replace />} />
            <Route path="/onboarding"       element={<Navigate to="/hr" replace />} />
            <Route path="/leave"            element={<Leave />} />
            <Route path="/reimbursements"   element={<Reimbursements />} />
            <Route path="/fnf"             element={<PermGuard resource="hr_user" action="read_all"><FnFSettlement /></PermGuard>} />
            <Route path="/performance"     element={<Performance />} />
            <Route path="/hr-reports"      element={<PermGuard resource="hr_user" action="read_all"><HRReports /></PermGuard>} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/help" element={<Help />} />
            <Route path="/inventory"        element={<Navigate to="/raw-components" replace />} />
            <Route path="/roles"            element={<PermGuard resource="role_admin" action="manage"><Roles /></PermGuard>} />
            <Route path="/approvals"        element={<PermGuard resource="approval_request" action="review"><Approvals /></PermGuard>} />
            <Route path="/users"            element={<PermGuard resource="role_admin" action="manage"><UserManagement /></PermGuard>} />
            <Route path="/audit-logs"       element={<PermGuard resource="audit_log" action="read_all"><AuditLogs /></PermGuard>} />
            <Route path="/business-rules"   element={<PermGuard resource="business_rule" action="read_all"><BusinessRules /></PermGuard>} />
            {/* Budget is a tab inside the Projects module, not its own page */}
            <Route path="/budget"             element={<Navigate to="/projects" replace />} />
            {/* Legacy/renamed paths kept as explicit aliases so old links resolve
                instead of dead-ending on the 404 below */}
            <Route path="/products"          element={<Navigate to="/items" replace />} />
            <Route path="/material-requests" element={<Navigate to="/warehouse" replace />} />
            {/* Real 404 for anything unmatched, instead of a silent redirect to Dashboard
                that hides broken/stale links */}
            <Route path="*" element={<NotFound />} />
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
