import { useState } from 'react'
import {
  HelpCircle, LayoutDashboard, Users, FolderKanban, Factory,
  Boxes, Package, FileText, UserCircle, Clock, Wallet, ClipboardCheck,
  BarChart3, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'

type Perm = [resource: string, action: string]

interface Guide {
  key: string
  title: string
  icon: any
  /** Shown only if the user holds this permission. Omit = everyone. */
  perm?: Perm
  intro: string
  steps: string[]
}

// Ordered, step-by-step guides. Each is gated on the same permission the feature
// itself uses, so a user only sees instructions for what they can actually do.
const GUIDES: Guide[] = [
  {
    key: 'dashboard', title: 'Dashboard', icon: LayoutDashboard,
    intro: 'Your daily overview of pipeline, projects and alerts.',
    steps: [
      'Open Dashboard from the sidebar — it loads automatically after login.',
      'Read the KPI cards at the top for pipeline value, active projects and pending work.',
      'Scroll to recent activity to see the latest deals, projects and payments.',
      'Act on any red/amber alert banners (e.g. holiday setup) using their linked button.',
    ],
  },
  {
    key: 'leads', title: 'Leads & Deals', icon: Users, perm: ['lead', 'read_all'],
    intro: 'Capture enquiries and move them through the sales pipeline.',
    steps: [
      'Go to Leads → click "New Lead" and fill contact + requirement details.',
      'Add a Scope of Supply so the eventual project knows what to build.',
      'Qualify the lead, then convert it to a Deal from the lead detail panel.',
      'Drag the deal across pipeline stages until it is Won or Lost.',
      'On Won, convert the deal to a Project to start execution.',
    ],
  },
  {
    key: 'projects', title: 'Projects', icon: FolderKanban, perm: ['project', 'read_all'],
    intro: 'Run delivery: scope, budget, manufacturing, installation and billing.',
    steps: [
      'Open Projects → click a project to see its tabs (Overview, Scope, Budget, etc.).',
      'In Scope of Supply, add line items and click Assign to link inventory to each line.',
      'Use Bulk Assign to fill several unallocated lines from inventory at once.',
      'Track costs in the Budget tab; raise work orders under Manufacturing.',
      'Move the project through its stages until Completed.',
    ],
  },
  {
    key: 'manufacturing', title: 'Manufacturing', icon: Factory, perm: ['work_order', 'read_all'],
    intro: 'Turn project scope into work orders and track production.',
    steps: [
      'Open the Manufacturing tab → click "New Work Order" and pick a project + scope line.',
      'Use the Status dropdown on each card to move it Waiting → In Production → Assembly → Testing → Finished.',
      'You can move a work order back a stage (revert) if it was advanced by mistake.',
      'Filter the list by Project or Status, or search by title / reference number.',
      'Click "Consume Material" to draw allocated inventory into the work order.',
      'Add production log entries to record progress; Finish locks in consumed cost.',
    ],
  },
  {
    key: 'inventory', title: 'Inventory (Raw Components)', icon: Boxes, perm: ['component', 'read_all'],
    intro: 'Stock of raw components used across projects.',
    steps: [
      'Open Inventory → click "Add Component" to record received stock.',
      'Set category, quantity, unit and price so allocation and costing work.',
      'Assign stock to a project scope line from the project Scope tab.',
      'Use filters to see in-stock vs assigned/used items.',
    ],
  },
  {
    key: 'items', title: 'Items (Dealer Catalogue)', icon: Package, perm: ['dealer_item', 'read_all'],
    intro: 'Products supplied by your dealers, with multi-dealer pricing.',
    steps: [
      'Open Items → click "New Item" and pick the supplying dealer.',
      'Enter name, specification, unit and price; mark whether it is in stock.',
      'Use "+ Add" under Other Dealers to record alternative vendor prices.',
      'The page is empty until you add items — start with New Item.',
    ],
  },
  {
    key: 'invoices', title: 'Invoices', icon: FileText, perm: ['invoice', 'read_all'],
    intro: 'Raise and track customer tax invoices.',
    steps: [
      'Open Invoices → click "New Invoice" and select the customer.',
      'Add line items; totals and tax are calculated automatically.',
      'Save, then download the PDF or share it with the customer.',
      'Filter by amount to find large or small invoices quickly.',
    ],
  },
  {
    key: 'hr', title: 'Employees (HR)', icon: UserCircle, perm: ['hr_user', 'read_all'],
    intro: 'Manage employee records, performance and exits.',
    steps: [
      'Open Employees → Directory → "Add Employee" to create a record.',
      'Fill salary, PF/ESI (with UAN / ESI numbers) and bank details.',
      'Click an employee to open their profile — Personal Info, Performance and Full & Final tabs.',
      'Use the department and role filters to narrow the list.',
    ],
  },
  {
    key: 'attendance', title: 'Attendance', icon: Clock, perm: ['attendance', 'read_all'],
    intro: 'Track punches and correct records when needed.',
    steps: [
      'Open Attendance → "All Staff" tab to see every employee.',
      'Click an employee name to open their monthly calendar.',
      'Click any day — including empty days marked "+ mark" — then Edit.',
      'Set status, check-in/out, break start/end and travel hours, then Save. Changes apply directly.',
    ],
  },
  {
    key: 'payroll', title: 'Payroll', icon: Wallet, perm: ['salary', 'read_all'],
    intro: 'Generate, correct and approve monthly salary.',
    steps: [
      'Open Payroll → pick month/year → "Generate Slip" (or Generate All).',
      'If a calculation is wrong, click Edit on the row, correct the figures and submit.',
      'A correction goes to an admin as an approval request — it is not applied until approved.',
      'Once a record is Draft, approve it, then Mark Paid to include it in the NEFT export.',
    ],
  },
  {
    key: 'approvals', title: 'Approvals', icon: ClipboardCheck, perm: ['approval_request', 'review'],
    intro: 'Review and act on requests raised by staff (payroll corrections, attendance, etc.).',
    steps: [
      'Open Approvals → the Pending tab lists requests waiting on you.',
      'Read the request title, who raised it and the reason.',
      'Click Approve to apply the change, or Reject with a reason.',
      'Switch to All to see the full history.',
    ],
  },
  {
    key: 'reports', title: 'HR Reports', icon: BarChart3, perm: ['hr_user', 'read_all'],
    intro: 'Export employee, attendance, leave and payroll data.',
    steps: [
      'Open HR Reports → choose a tab (Employee, Attendance, Leave, Payroll).',
      'Set the month/year or department filters as needed.',
      'Click Export CSV to download the current view.',
    ],
  },
]

export default function Help() {
  const can = useAuthStore(s => s.can)
  // A guide with no perm is for everyone; otherwise gate on the exact permission.
  const visible = GUIDES.filter(g => !g.perm || can(g.perm[0], g.perm[1]))
  const [open, setOpen] = useState<string | null>(visible[0]?.key ?? null)

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <HelpCircle size={22} color="#5D78FF" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: 0 }}>Help & Guides</h1>
      </div>
      <p style={{ fontSize: 13, color: '#8A8FA8', margin: '0 0 20px' }}>
        Step-by-step instructions for each part of the CRM. You only see guides for the areas your role can access.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(g => {
          const isOpen = open === g.key
          const Icon = g.icon
          return (
            <div key={g.key} style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : g.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} style={{ color: '#5D78FF' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', margin: 0 }}>{g.title}</p>
                  <p style={{ fontSize: 12, color: '#8A8FA8', margin: '2px 0 0' }}>{g.intro}</p>
                </div>
                {isOpen ? <ChevronDown size={16} color="#8A8FA8" /> : <ChevronRight size={16} color="#8A8FA8" />}
              </button>

              {isOpen && (
                <ol style={{ margin: 0, padding: '0 20px 18px 20px', listStyle: 'none', counterReset: 'step' }}>
                  {g.steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderTop: i === 0 ? '1px solid #F4F5F9' : 'none' }}>
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#5D78FF', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: '#374557', lineHeight: 1.55 }}>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}

        {visible.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#8A8FA8', margin: 0 }}>No guides available for your role yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
