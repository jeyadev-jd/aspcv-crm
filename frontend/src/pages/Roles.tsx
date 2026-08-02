import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  ShieldCheck, Plus, ChevronDown, ChevronRight, Trash2,
  UserCheck, Handshake, Contact, Building2, FolderOpen, CheckSquare,
  Calendar, UserCircle, AlarmClock, Wallet, BarChart2,
  FileText, Package, ClipboardList, Boxes, Wrench, Headphones,
  MessageSquare, ClipboardCheck, Shield, Store,
  ShieldPlus, Truck, Cog, ScrollText, PenTool,
  Landmark, Settings, HardHat, ClipboardSignature,
} from 'lucide-react'
import { useConfirm } from '@/components/shared/useConfirm'

interface RoleDef {
  id: string
  name: string
  displayName: string
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  permissions: { id: string; resource: string; action: string; allowed: boolean }[]
}

const PERMISSION_GROUPS: { label: string; Icon: React.ElementType; perms: { key: string; label: string }[] }[] = [
  { label: 'Leads', Icon: UserCheck, perms: [
    { key: 'lead:create', label: 'Add new leads' }, { key: 'lead:read_own', label: 'View own leads' },
    { key: 'lead:read_all', label: 'View all leads' }, { key: 'lead:edit', label: 'Edit leads' }, { key: 'lead:delete', label: 'Delete leads' },
  ]},
  { label: 'Deals', Icon: Handshake, perms: [
    { key: 'deal:create', label: 'Add new deals' }, { key: 'deal:read_own', label: 'View own deals' },
    { key: 'deal:read_all', label: 'View all deals' }, { key: 'deal:edit', label: 'Edit deals' }, { key: 'deal:delete', label: 'Delete deals' },
    { key: 'deal:assign_pm', label: 'Assign Project Manager' }, { key: 'deal:assign_se', label: 'Assign Service Engineer' },
  ]},
  { label: 'Contacts', Icon: Contact, perms: [
    { key: 'contact:create', label: 'Add contacts' }, { key: 'contact:read_own', label: 'View contacts' },
    { key: 'contact:edit', label: 'Log contact events (calls, meetings)' },
    { key: 'contact:delete', label: 'Restore deleted contacts' },
  ]},
  { label: 'Accounts', Icon: Building2, perms: [
    { key: 'company:create', label: 'Add companies' }, { key: 'company:read_all', label: 'View companies' },
    { key: 'company:edit', label: 'Edit companies' }, { key: 'company:delete', label: 'Delete companies' },
  ]},
  { label: 'Projects', Icon: FolderOpen, perms: [
    { key: 'project:create', label: 'Create projects' }, { key: 'project:read_own', label: 'View own projects' },
    { key: 'project:read_all', label: 'View all projects' },
    { key: 'project:edit', label: 'Edit projects' }, { key: 'project:delete', label: 'Delete projects' },
  ]},
  { label: 'Tasks', Icon: CheckSquare, perms: [
    { key: 'task:create', label: 'Create tasks' }, { key: 'task:edit', label: 'Edit tasks' }, { key: 'task:delete', label: 'Delete tasks' },
  ]},
  { label: 'Calendar', Icon: Calendar, perms: [
    { key: 'calendar:create', label: 'Add events' },
    { key: 'calendar:edit', label: 'Edit events' }, { key: 'calendar:delete', label: 'Delete events' },
    { key: 'calendar:manage', label: 'Schedule for any department' },
  ]},
  { label: 'Employees (HR)', Icon: UserCircle, perms: [
    { key: 'hr_user:create', label: 'Add new employees' }, { key: 'hr_user:read_all', label: 'View all employees' },
    { key: 'hr_user:edit', label: 'Edit employee details' }, { key: 'hr_user:deactivate', label: 'Deactivate employees' },
  ]},
  { label: 'Attendance', Icon: AlarmClock, perms: [
    { key: 'attendance:checkin', label: 'Check in & out' }, { key: 'attendance:read_own', label: 'View own attendance' },
    { key: 'attendance:read_all', label: 'View all attendance' }, { key: 'attendance:edit', label: 'Edit attendance logs' },
    { key: 'attendance:manage', label: 'Manage location overrides' },
  ]},
  { label: 'Payroll', Icon: Wallet, perms: [
    { key: 'salary:generate', label: 'Generate salary slips' }, { key: 'salary:approve', label: 'Approve salary' },
    { key: 'salary:mark_paid', label: 'Mark salary as paid' }, { key: 'salary:read_own', label: 'View own salary slip' }, { key: 'salary:read_all', label: 'View all salary slips' },
  ]},
  { label: 'Finance & Assets', Icon: BarChart2, perms: [
    { key: 'financial:create', label: 'Add financial entries' }, { key: 'financial:read_all', label: 'View financials' },
    { key: 'financial:edit', label: 'Edit entries' }, { key: 'financial:delete', label: 'Delete entries' },
  ]},
  { label: 'Accounting (Ledger & Budgets)', Icon: Landmark, perms: [
    { key: 'finance:read', label: 'View department budgets & ledger' }, { key: 'finance:edit', label: 'Edit budgets, ledger & journal entries' },
  ]},
  { label: 'Invoices', Icon: FileText, perms: [
    { key: 'invoice:read_all', label: 'View invoices' }, { key: 'invoice:create', label: 'Create invoices' },
    { key: 'invoice:edit', label: 'Edit invoices' }, { key: 'invoice:approve', label: 'Approve invoices' }, { key: 'invoice:delete', label: 'Delete invoices' },
    { key: 'signatory:read_all', label: 'View signatories' }, { key: 'signatory:create', label: 'Add signatories' },
    { key: 'signatory:edit', label: 'Edit signatories' }, { key: 'signatory:delete', label: 'Delete signatories' },
    { key: 'bank_account:read_all', label: 'View bank accounts' }, { key: 'bank_account:create', label: 'Add bank accounts' },
    { key: 'bank_account:edit', label: 'Edit bank accounts' }, { key: 'bank_account:delete', label: 'Delete bank accounts' },
  ]},
  { label: 'Quotations', Icon: ClipboardSignature, perms: [
    { key: 'quotation:read_all', label: 'View quotations' }, { key: 'quotation:create', label: 'Create quotations' },
    { key: 'quotation:edit', label: 'Edit quotations' }, { key: 'quotation:approve', label: 'Approve quotations' }, { key: 'quotation:delete', label: 'Delete quotations' },
  ]},
  { label: 'Purchase Orders', Icon: Truck, perms: [
    { key: 'purchase_order:read_all', label: 'View purchase orders' }, { key: 'purchase_order:create', label: 'Create purchase orders' },
    { key: 'purchase_order:edit', label: 'Edit purchase orders' }, { key: 'purchase_order:approve', label: 'Approve purchase orders' },
    { key: 'purchase_order:delete', label: 'Delete purchase orders' },
    { key: 'goods_receipt:read_all', label: 'View goods receipts' }, { key: 'goods_receipt:create', label: 'Record goods receipts' },
  ]},
  { label: 'Manufacturing (Work Orders)', Icon: Cog, perms: [
    { key: 'work_order:read_all', label: 'View work orders' }, { key: 'work_order:create', label: 'Create work orders' },
    { key: 'work_order:edit', label: 'Edit work orders' }, { key: 'work_order:delete', label: 'Delete work orders' },
  ]},
  { label: 'Products', Icon: Package, perms: [
    { key: 'product:create', label: 'Add products' },
    { key: 'product:edit', label: 'Edit products' }, { key: 'product:delete', label: 'Delete products' },
  ]},
  { label: 'Material Requests', Icon: ClipboardList, perms: [
    { key: 'material_request:create', label: 'Raise material requests' }, { key: 'material_request:read_own', label: 'View material requests' },
    { key: 'material_request:reject', label: 'Reject material requests' },
  ]},
  { label: 'Inventory', Icon: Boxes, perms: [
    { key: 'component:create', label: 'Add components' },
    { key: 'component:edit', label: 'Edit components' }, { key: 'component:assign', label: 'Assign to projects' },
    { key: 'component:delete', label: 'Delete components' },
    { key: 'inventory_allocation:read_all', label: 'View allocations' }, { key: 'inventory_allocation:create', label: 'Allocate inventory' },
    { key: 'inventory_allocation:delete', label: 'Delete allocations' },
  ]},
  { label: 'Installation', Icon: Wrench, perms: [
    { key: 'installation:read_own', label: 'View installations' }, { key: 'installation:create', label: 'Add installations' },
    { key: 'installation:edit', label: 'Edit installations' }, { key: 'installation:delete', label: 'Delete installations' },
  ]},
  { label: 'Service & Warranty', Icon: HardHat, perms: [
    { key: 'service_record:read_all', label: 'View service records' }, { key: 'service_record:create', label: 'Create service requests' },
    { key: 'service_record:edit', label: 'Edit service records' },
    { key: 'service_record:delete', label: 'Delete service requests' },
  ]},
  { label: 'AMC Contracts', Icon: ShieldPlus, perms: [
    { key: 'amc:read_all', label: 'View AMC contracts' }, { key: 'amc:create', label: 'Create/renew AMC contracts' },
    { key: 'amc:edit', label: 'Edit AMC contracts, visits & invoices' },
  ]},
  { label: 'Support Tickets', Icon: Headphones, perms: [
    { key: 'support:read_all', label: 'View all tickets' }, { key: 'support:create', label: 'Raise tickets' },
    { key: 'support:edit', label: 'Edit tickets' }, { key: 'support:delete', label: 'Delete tickets' },
  ]},
  { label: 'Discussions', Icon: MessageSquare, perms: [
    { key: 'discussion:create', label: 'Start discussions' },
    { key: 'discussion:edit_own', label: 'Edit own comments / link projects' },
    { key: 'attachment:create', label: 'Upload attachments' }, { key: 'attachment:read_own', label: 'View/download attachments' },
    { key: 'attachment:delete', label: 'Delete attachments' },
  ]},
  { label: 'Approvals', Icon: ClipboardCheck, perms: [
    { key: 'approval_request:review', label: 'Approve or reject requests' },
  ]},
  { label: 'Dealers & Items', Icon: Store, perms: [
    { key: 'dealer:create', label: 'Add dealers' }, { key: 'dealer:read_all', label: 'View dealers' },
    { key: 'dealer:edit', label: 'Edit dealers' }, { key: 'dealer:delete', label: 'Delete dealers' },
    { key: 'dealer_item:create', label: 'Add dealer items' }, { key: 'dealer_item:read_all', label: 'View dealer items' },
    { key: 'dealer_item:edit', label: 'Edit dealer items' }, { key: 'dealer_item:delete', label: 'Delete dealer items' },
  ]},
  { label: 'Business Rules', Icon: ScrollText, perms: [
    { key: 'business_rule:read_all', label: 'View business rules' }, { key: 'business_rule:edit', label: 'Edit & run business rules' },
  ]},
  { label: 'Audit Log', Icon: PenTool, perms: [
    { key: 'audit_log:read_all', label: 'View audit log' },
  ]},
  { label: 'Company Settings', Icon: Settings, perms: [
    { key: 'settings:read', label: 'View company/branch settings' }, { key: 'settings:edit', label: 'Edit company/branch settings' },
  ]},
  { label: 'Admin', Icon: Shield, perms: [
    { key: 'role_admin:manage', label: 'Manage roles & permissions' },
  ]},
]


export default function Roles() {
  const { confirm, confirmDialog } = useConfirm()
  const isMobile = useIsMobile()
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDisplay, setNewRoleDisplay] = useState('')
  const [adding, setAdding] = useState(false)

  const { data: roles = [], isLoading } = useQuery<RoleDef[]>({
    queryKey: ['role-definitions'],
    queryFn: () => api.get('/role-definitions').then(r => r.data),
  })

  const createRole = useMutation({
    mutationFn: (data: { name: string; displayName: string }) => api.post('/role-definitions', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-definitions'] }); setAdding(false); setNewRoleName(''); setNewRoleDisplay('') },
  })

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.delete(`/role-definitions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['role-definitions'] }),
  })

  const togglePermission = useMutation({
    mutationFn: ({ id, resource, action, allowed }: { id: string; resource: string; action: string; allowed: boolean }) =>
      api.patch(`/role-definitions/${id}/permissions/${resource}/${action}`, { allowed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['role-definitions'] }),
  })

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <ShieldCheck size={22} color="#5D78FF" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#374557', margin: 0 }}>Roles & Permissions</h1>
        <button
          onClick={() => setAdding(v => !v)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} /> Add Role
        </button>
      </div>

      {adding && (
        <div style={{ background: '#f8f9ff', border: '1px solid #e0e3ff', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Internal Name</label>
            <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="e.g. SalesManager" style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input value={newRoleDisplay} onChange={e => setNewRoleDisplay(e.target.value)} placeholder="e.g. Sales Manager" style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <button
            onClick={() => createRole.mutate({ name: newRoleName, displayName: newRoleDisplay })}
            disabled={!newRoleName || !newRoleDisplay}
            style={{ padding: '7px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Create
          </button>
        </div>
      )}

      {isLoading ? <p style={{ color: '#999', fontSize: 14 }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roles.map(role => (
            <div key={role.id} style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
              >
                {expandedId === role.id ? <ChevronDown size={14} color="#aaa" /> : <ChevronRight size={14} color="#aaa" />}
                <span style={{ fontWeight: 600, fontSize: 14, color: '#374557' }}>{role.displayName}</span>
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{role.name}</span>
                {role.isSystem && <span style={{ fontSize: 10, background: '#f0f1f5', color: '#888', borderRadius: 4, padding: '1px 6px', marginLeft: 4 }}>system</span>}
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{role.permissions.length} permissions</span>
                {!role.isSystem && (
                  <button
                    onClick={e => { e.stopPropagation(); confirm({ title: `Delete role "${role.displayName}"?`, onConfirm: () => deleteRole.mutate(role.id) }) }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', padding: 4 }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {expandedId === role.id && (
                <div style={{ borderTop: '1px solid #f0f1f5', padding: 16, background: '#fafbff' }}>
                  <div style={{ columns: isMobile ? 1 : 2, columnGap: 24, columnFill: 'balance' }}>
                    {PERMISSION_GROUPS.map(group => {
                      const GIcon = group.Icon
                      return (
                        <div key={group.label} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f0f1f5' }}>
                            <GIcon size={12} color="#5D78FF" />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#374557', textTransform: 'uppercase', letterSpacing: 0.5 }}>{group.label}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {group.perms.map(p => {
                              const [resource, action] = p.key.split(':')
                              const existing = role.permissions.find(px => px.resource === resource && px.action === action)
                              const checked = existing?.allowed ?? false
                              return (
                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 5, background: checked ? '#EEF2FF' : 'transparent' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission.mutate({ id: role.id, resource, action, allowed: !checked })}
                                    style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: 12, color: checked ? '#374557' : '#9CA3AF' }}>{p.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
