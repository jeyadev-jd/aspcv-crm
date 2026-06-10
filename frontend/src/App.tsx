import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import { CurrencyProvider } from '@/lib/currencyContext'
import { CrmDataProvider } from '@/lib/crmDataContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LoginPage from '@/components/auth/LoginPage'
import Dashboard from '@/pages/Dashboard'
import Leads from '@/pages/Leads'
import Accounts from '@/pages/Accounts'
import Contacts from '@/pages/Contacts'
import Deals from '@/pages/Deals'
import Products from '@/pages/Products'
import Projects from '@/pages/Projects'
import Tasks from '@/pages/Tasks'
import Kanban from '@/pages/Kanban'
import CalendarPage from '@/pages/Calendar'
import Invoices from '@/pages/Invoices'
import Support from '@/pages/Support'
import Installations from '@/pages/Installations'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
    <CrmDataProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/leads"     element={<Leads />} />
            <Route path="/accounts"  element={<Accounts />} />
            <Route path="/contacts"  element={<Contacts />} />
            <Route path="/deals"     element={<Deals />} />
            <Route path="/products"  element={<Products />} />
            <Route path="/projects"  element={<Projects />} />
            <Route path="/tasks"     element={<Tasks />} />
            <Route path="/kanban"    element={<Kanban />} />
            <Route path="/calendar"  element={<CalendarPage />} />
            <Route path="/invoices"  element={<Invoices />} />
            <Route path="/support"        element={<Support />} />
            <Route path="/installations"  element={<Installations />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/settings"  element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </CrmDataProvider>
    </CurrencyProvider>
    </QueryClientProvider>
  )
}
