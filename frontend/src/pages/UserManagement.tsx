import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  Users, CheckCircle, XCircle, Clock, ChevronDown, ShieldCheck, ChevronRight,
  UserCheck, Handshake, Contact, Building2, FolderOpen, CheckSquare,
  Calendar, UserCircle, AlarmClock, Wallet, BarChart2,
  FileText, Package, ClipboardList, Boxes, Wrench, Headphones,
  MessageSquare, ClipboardCheck, Shield, Briefcase, Plus, Trash2,
} from 'lucide-react'
import { useDepartments, useCreateDepartment, useDeleteDepartment, useDepartmentMembers } from '@/hooks/useDepartments'
import { useAuthStore } from '@/lib/authStore'
import { useConfirm } from '@/components/shared/useConfirm'

interface User {
  id: string; name: string; email: string; role: string; roleName: string
  designation: string | null; department: { id: string; name: string } | null
  isActive: boolean; baseSalary: number | null; createdAt: string
}

interface RoleDef {
  id: string; name: string; displayName: string
  permissions: { resource: string; action: string; allowed: boolean }[]
}

interface PermOverride {
  id: string; resource: string; action: string; allowed: boolean; reason?: string
}

const PERMISSION_GROUPS: { label: string; Icon: React.ElementType; perms: { key: string; label: string }[] }[] = [
  { label: 'Leads', Icon: UserCheck, perms: [
    { key: 'lead:create',   label: 'Add new leads' },
    { key: 'lead:read_own', label: 'View own leads' },
    { key: 'lead:read_all', label: 'View all leads' },
    { key: 'lead:edit',     label: 'Edit leads' },
    { key: 'lead:delete',   label: 'Delete leads' },
  ]},
  { label: 'Deals', Icon: Handshake, perms: [
    { key: 'deal:create',   label: 'Add new deals' },
    { key: 'deal:read_own', label: 'View own deals' },
    { key: 'deal:read_all', label: 'View all deals' },
    { key: 'deal:edit',     label: 'Edit deals' },
    { key: 'deal:delete',   label: 'Delete deals' },
  ]},
  { label: 'Contacts', Icon: Contact, perms: [
    { key: 'contact:create',   label: 'Add contacts' },
    { key: 'contact:read_own', label: 'View own contacts' },
    { key: 'contact:read_all', label: 'View all contacts' },
    { key: 'contact:edit',     label: 'Edit contacts' },
    { key: 'contact:delete',   label: 'Delete contacts' },
  ]},
  { label: 'Accounts', Icon: Building2, perms: [
    { key: 'company:create',   label: 'Add companies' },
    { key: 'company:read_all', label: 'View companies' },
    { key: 'company:edit',     label: 'Edit companies' },
    { key: 'company:delete',   label: 'Delete companies' },
  ]},
  { label: 'Projects', Icon: FolderOpen, perms: [
    { key: 'project:create',   label: 'Create projects' },
    { key: 'project:read_all', label: 'View projects' },
    { key: 'project:edit',     label: 'Edit projects' },
    { key: 'project:delete',   label: 'Delete projects' },
  ]},
  { label: 'Tasks', Icon: CheckSquare, perms: [
    { key: 'task:create',   label: 'Create tasks' },
    { key: 'task:read_own', label: 'View own tasks' },
    { key: 'task:read_all', label: 'View all tasks' },
    { key: 'task:edit',     label: 'Edit tasks' },
    { key: 'task:delete',   label: 'Delete tasks' },
  ]},
  { label: 'Calendar', Icon: Calendar, perms: [
    { key: 'calendar:read_all', label: 'View calendar' },
    { key: 'calendar:create',   label: 'Add events' },
    { key: 'calendar:edit',     label: 'Edit events' },
    { key: 'calendar:delete',   label: 'Delete events' },
    { key: 'calendar:manage',   label: 'Schedule for any department' },
  ]},
  { label: 'Employees (HR)', Icon: UserCircle, perms: [
    { key: 'hr_user:create',     label: 'Add new employees' },
    { key: 'hr_user:read_all',   label: 'View all employees' },
    { key: 'hr_user:edit',       label: 'Edit employee details' },
    { key: 'hr_user:deactivate', label: 'Deactivate employees' },
  ]},
  { label: 'Attendance', Icon: AlarmClock, perms: [
    { key: 'attendance:checkin',  label: 'Check in & out' },
    { key: 'attendance:read_own', label: 'View own attendance' },
    { key: 'attendance:read_all', label: 'View all attendance' },
  ]},
  { label: 'Payroll', Icon: Wallet, perms: [
    { key: 'salary:generate',  label: 'Generate salary slips' },
    { key: 'salary:approve',   label: 'Approve salary' },
    { key: 'salary:mark_paid', label: 'Mark salary as paid' },
    { key: 'salary:read_own',  label: 'View own salary slip' },
    { key: 'salary:read_all',  label: 'View all salary slips' },
  ]},
  { label: 'Finance & Assets', Icon: BarChart2, perms: [
    { key: 'financial:create',   label: 'Add financial entries' },
    { key: 'financial:read_all', label: 'View financials' },
    { key: 'financial:edit',     label: 'Edit entries' },
    { key: 'financial:delete',   label: 'Delete entries' },
  ]},
  { label: 'Invoices', Icon: FileText, perms: [
    { key: 'invoice:read_all', label: 'View invoices' },
    { key: 'invoice:create',   label: 'Create invoices' },
    { key: 'invoice:edit',     label: 'Edit invoices' },
    { key: 'invoice:delete',   label: 'Delete invoices' },
  ]},
  { label: 'Products', Icon: Package, perms: [
    { key: 'product:read_all', label: 'View products' },
    { key: 'product:create',   label: 'Add products' },
    { key: 'product:edit',     label: 'Edit products' },
    { key: 'product:delete',   label: 'Delete products' },
  ]},
  { label: 'Material Requests', Icon: ClipboardList, perms: [
    { key: 'material_request:create',   label: 'Raise material requests' },
    { key: 'material_request:read_own', label: 'View own requests' },
    { key: 'material_request:read_all', label: 'View all requests' },
  ]},
  { label: 'Inventory', Icon: Boxes, perms: [
    { key: 'component:create',   label: 'Add components' },
    { key: 'component:read_all', label: 'View inventory' },
    { key: 'component:edit',     label: 'Edit components' },
    { key: 'component:assign',   label: 'Assign to projects' },
    { key: 'component:delete',   label: 'Delete components' },
  ]},
  { label: 'Installation', Icon: Wrench, perms: [
    { key: 'installation:read_all', label: 'View installations' },
    { key: 'installation:create',   label: 'Add installations' },
    { key: 'installation:edit',     label: 'Edit installations' },
    { key: 'installation:delete',   label: 'Delete installations' },
  ]},
  { label: 'Service & Warranty', Icon: Wrench, perms: [
    { key: 'service_record:read_all', label: 'View service records' },
    { key: 'service_record:create',   label: 'Create service requests' },
    { key: 'service_record:edit',     label: 'Edit service records' },
    { key: 'service_record:delete',   label: 'Delete service requests' },
  ]},
  { label: 'Support Tickets', Icon: Headphones, perms: [
    { key: 'support:read_all', label: 'View all tickets' },
    { key: 'support:create',   label: 'Raise tickets' },
    { key: 'support:edit',     label: 'Edit tickets' },
    { key: 'support:delete',   label: 'Delete tickets' },
  ]},
  { label: 'Discussions', Icon: MessageSquare, perms: [
    { key: 'discussion:create',     label: 'Start discussions' },
    { key: 'discussion:read_all',   label: 'Read all discussions' },
    { key: 'discussion:edit_own',   label: 'Edit own comments' },
    { key: 'discussion:delete_own', label: 'Delete own comments' },
  ]},
  { label: 'Approvals', Icon: ClipboardCheck, perms: [
    { key: 'approval_request:create', label: 'Submit approval requests' },
    { key: 'approval_request:review', label: 'Approve or reject requests' },
  ]},
  { label: 'Admin — Roles & Users', Icon: Shield, perms: [
    { key: 'role_admin:manage', label: 'Manage roles & permissions' },
  ]},
]


function SectionHeader({ label, Icon }: { label: string; Icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Icon size={13} color="#5D78FF" />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#374557', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

function UserPermPanel({ user, roles }: { user: User; roles: RoleDef[] }) {
  const isMobile = useIsMobile()
  const qc = useQueryClient()
  const [editingRole, setEditingRole] = useState(false)
  const [tab, setTab] = useState<'role' | 'overrides'>('role')

  const { data: overrides = [] } = useQuery<PermOverride[]>({
    queryKey: ['user-overrides', user.id],
    queryFn: () => api.get(`/user-permissions/${user.id}`).then(r => r.data),
  })

  const assignRole = useMutation({
    mutationFn: (roleName: string) => api.patch(`/user-permissions/${user.id}/role`, { roleName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditingRole(false) },
  })

  const setOverride = useMutation({
    mutationFn: ({ resource, action, allowed }: { resource: string; action: string; allowed: boolean }) =>
      api.put(`/user-permissions/${user.id}/${resource}/${action}`, { allowed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-overrides', user.id] }),
  })

  const removeOverride = useMutation({
    mutationFn: ({ resource, action }: { resource: string; action: string }) =>
      api.delete(`/user-permissions/${user.id}/${resource}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-overrides', user.id] }),
  })

  const currentRole = roles.find(r => r.name === user.roleName)
  const rolePerms = new Set(currentRole?.permissions.filter(p => p.allowed).map(p => `${p.resource}:${p.action}`) ?? [])
  const overrideMap = new Map(overrides.map(o => [`${o.resource}:${o.action}`, o]))

  return (
    <div style={{ borderTop: '1px solid #f0f1f5', background: '#fafbff' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f1f5', background: '#fff' }}>
        {(['role', 'overrides'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 12, fontWeight: 600, border: 'none',
              cursor: 'pointer', background: 'transparent',
              color: tab === t ? '#5D78FF' : '#aaa',
              borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            }}
          >
            {t === 'role' ? 'Role & Permissions' : `Overrides ${overrides.length > 0 ? `(${overrides.length})` : ''}`}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 'role' && (
          <div>
            {/* Role selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>Assigned Role</p>
                {editingRole ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      defaultValue={user.roleName}
                      onChange={e => assignRole.mutate(e.target.value)}
                      style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}
                    >
                      {roles.map(r => <option key={r.id} value={r.name}>{r.displayName}</option>)}
                    </select>
                    <button onClick={() => setEditingRole(false)} style={{ border: 'none', background: '#f4f5f9', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{currentRole?.displayName ?? user.roleName}</span>
                    <button
                      onClick={() => setEditingRole(true)}
                      style={{ fontSize: 11, padding: '4px 10px', background: '#EEF2FF', color: '#5D78FF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                    >Change</button>
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#22C55E', margin: 0 }}>{currentRole?.permissions.filter(p => p.allowed).length ?? 0}</p>
                  <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>Permissions</p>
                </div>
                {overrides.length > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{overrides.length}</p>
                    <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>Overrides</p>
                  </div>
                )}
              </div>
            </div>

            {/* Permission view — grouped, 2 columns of groups */}
            <div style={{ columns: isMobile ? 1 : 2, columnGap: 24, columnFill: 'balance' }}>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                  <SectionHeader label={group.label} Icon={group.Icon} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                    {group.perms.map(p => {
                      const override = overrideMap.get(p.key)
                      const effective = override ? override.allowed : rolePerms.has(p.key)
                      return (
                        <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: effective ? '#22C55E' : '#E5E7EB' }} />
                          <span style={{ fontSize: 12, color: effective ? '#374557' : '#C4C4CF' }}>{p.label}</span>
                          {override && (
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: override.allowed ? '#dcfce7' : '#fee2e2', color: override.allowed ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                              {override.allowed ? '+' : '−'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'overrides' && (
          <div>
            <div style={{ background: '#EEF2FF', border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#374557' }}>
              Overrides let you grant or block individual permissions <b>beyond what the role allows</b>. Use sparingly.
            </div>
            <div style={{ columns: isMobile ? 1 : 2, columnGap: 24, columnFill: 'balance' }}>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                  <SectionHeader label={group.label} Icon={group.Icon} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
                    {group.perms.map(p => {
                      const [resource, action] = p.key.split(':')
                      const fromRole = rolePerms.has(p.key)
                      const override = overrideMap.get(p.key)
                      const effective = override ? override.allowed : fromRole

                      let rowBg = 'transparent'
                      if (override?.allowed === true) rowBg = '#f0fdf4'
                      if (override?.allowed === false) rowBg = '#fef2f2'

                      return (
                        <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: rowBg, borderRadius: 5, padding: '5px 8px' }}>
                          <input
                            type="checkbox"
                            checked={effective}
                            onChange={e => {
                              const newVal = e.target.checked
                              if (newVal === fromRole && override) removeOverride.mutate({ resource, action })
                              else setOverride.mutate({ resource, action, allowed: newVal })
                            }}
                            style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, color: effective ? '#374557' : '#9CA3AF', flex: 1 }}>{p.label}</span>
                          {override && (
                            <>
                              <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: override.allowed ? '#dcfce7' : '#fee2e2', color: override.allowed ? '#15803d' : '#dc2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {override.allowed ? 'Extra grant' : 'Blocked'}
                              </span>
                              <button
                                onClick={() => removeOverride.mutate({ resource, action })}
                                title="Reset to role default"
                                style={{ border: 'none', background: '#f4f5f9', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}
                              >Reset</button>
                            </>
                          )}
                          {!override && fromRole && (
                            <span style={{ fontSize: 9, color: '#C4C4CF', whiteSpace: 'nowrap' }}>via role</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
              Extra grant = on beyond role default &nbsp;·&nbsp; Blocked = off despite role &nbsp;·&nbsp; Reset = revert to role
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DepartmentMemberRow({ user, departments }: { user: User; departments: { id: string; name: string }[] }) {
  const qc = useQueryClient()
  const reassign = useMutation({
    mutationFn: (departmentId: string) => api.patch(`/users/${user.id}`, { departmentId: departmentId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['departments'] }) },
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, background: '#fafbff' }}>
      <span style={{ fontSize: 12, color: '#374557', flex: 1 }}>{user.name} <span style={{ color: '#aaa' }}>· {user.email}</span></span>
      <select
        defaultValue={user.department?.id ?? ''}
        onChange={e => reassign.mutate(e.target.value)}
        style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}
      >
        <option value="">— No department —</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  )
}

function DepartmentRow({ dept, users }: { dept: { id: string; name: string }; users: User[] }) {
  const { confirm, confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const deleteDept = useDeleteDepartment()
  const { data: members = [] } = useDepartmentMembers(open ? dept.id : null)
  const departments = useDepartments().data ?? []
  const can = useAuthStore(s => s.can)
  const canDeleteDept = can('hr_user', 'deactivate')

  // Count only users belonging to THIS department — `users` is the full list.
  const memberCount = users.filter(u => u.department?.id === dept.id).length

  return (
    <div style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden' }}>
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <Briefcase size={15} color="#5D78FF" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374557', flex: 1 }}>{dept.name}</span>
        <span style={{ fontSize: 11, color: '#aaa' }}>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
        <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: '#f4f5f9', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#555', fontWeight: 600 }}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Members
        </button>
        {canDeleteDept && (
          <button onClick={() => { confirm({ title: `Delete department "${dept.name}"?`, onConfirm: () => deleteDept.mutate(dept.id) }) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #f0f1f5', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.length === 0 && <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>No members yet.</p>}
          {members.map(m => {
            const u = users.find(x => x.id === m.id)
            return u ? <DepartmentMemberRow key={u.id} user={u} departments={departments} /> : null
          })}
        </div>
      )}
    </div>
  )
}

function DepartmentsPanel({ users }: { users: User[] }) {
  const { data: departments = [], isLoading } = useDepartments()
  const createDept = useCreateDepartment()
  const [newName, setNewName] = useState('')

  function add() {
    if (!newName.trim()) return
    createDept.mutate(newName.trim())
    setNewName('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New department name…" onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, maxWidth: 280, fontSize: 12, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 7 }} />
        <button onClick={add} disabled={createDept.isPending || !newName.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', opacity: createDept.isPending || !newName.trim() ? 0.6 : 1 }}>
          <Plus size={13} /> Add
        </button>
      </div>
      {isLoading ? (
        <p style={{ color: '#999', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {departments.map(d => <DepartmentRow key={d.id} dept={d} users={users} />)}
          {departments.length === 0 && <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 32 }}>No departments yet. Add one above.</p>}
        </div>
      )}
    </div>
  )
}

export default function UserManagement() {
  const { confirm, confirmDialog } = useConfirm()
  const qc = useQueryClient()
  const can = useAuthStore(s => s.can)
  const canDeactivate = can('hr_user', 'deactivate')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [view, setView] = useState<'users' | 'departments'>('users')
  const [deptFilter, setDeptFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users', 'all'],
    queryFn: () => api.get('/users', { params: { includePending: 'true', pageSize: 1000 } }).then(r => r.data.data),
  })

  const { data: roles = [] } = useQuery<RoleDef[]>({
    queryKey: ['role-definitions'],
    queryFn: () => api.get('/role-definitions').then(r => r.data),
  })

  const { data: departments = [] } = useDepartments()

  const deactivate = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const filtered = users.filter(u => {
    if (filter === 'active' && !u.isActive) return false
    if (filter === 'pending' && u.isActive) return false
    if (deptFilter !== 'all' && u.department?.id !== (deptFilter === 'none' ? undefined : deptFilter)) {
      if (!(deptFilter === 'none' && !u.department)) return false
    }
    if (roleFilter !== 'all' && u.roleName !== roleFilter) return false
    return true
  })

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {confirmDialog}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Users size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>User Management</h1>
        <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
          {(['users', 'departments'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
              cursor: 'pointer', border: 'none',
              background: view === v ? '#374557' : '#f4f5f9',
              color: view === v ? '#fff' : '#555',
            }}>
              {v === 'users' ? 'Users' : 'Departments'}
            </button>
          ))}
        </div>
        {view === 'users' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['all', 'active', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                cursor: 'pointer', border: 'none',
                background: filter === f ? '#5D78FF' : '#f4f5f9',
                color: filter === f ? '#fff' : '#555',
              }}>
                {f === 'all' ? `All (${users.length})` : f === 'active' ? `Active (${users.filter(u => u.isActive).length})` : `Pending (${users.filter(u => !u.isActive).length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'departments' && <DepartmentsPanel users={users} />}
      {view === 'users' && <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Users', value: users.length, color: '#5D78FF' },
          { label: 'Active', value: users.filter(u => u.isActive).length, color: '#22C55E' },
          { label: 'Pending Approval', value: users.filter(u => !u.isActive).length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: '4px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category filters: department + role */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #f0f1f5', fontSize: 12, color: '#374557', background: '#fff', cursor: 'pointer' }}>
          <option value="all">All departments</option>
          <option value="none">— No department —</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #f0f1f5', fontSize: 12, color: '#374557', background: '#fff', cursor: 'pointer' }}>
          <option value="all">All roles</option>
          {roles.map(r => <option key={r.name} value={r.name}>{r.displayName ?? r.name}</option>)}
        </select>
        {(deptFilter !== 'all' || roleFilter !== 'all') && (
          <button onClick={() => { setDeptFilter('all'); setRoleFilter('all') }}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #f0f1f5', background: '#fff', fontSize: 12, color: '#5D78FF', fontWeight: 600, cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <p style={{ color: '#999', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(user => (
            <div key={user.id} style={{ background: '#fff', border: '1px solid #f0f1f5', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#5D78FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374557', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
                </div>
                {/* Role */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EEF2FF', borderRadius: 6, padding: '4px 10px' }}>
                  <ShieldCheck size={12} color="#5D78FF" />
                  <span style={{ fontSize: 11, color: '#5D78FF', fontWeight: 600 }}>
                    {roles.find(r => r.name === user.roleName)?.displayName ?? user.roleName}
                  </span>
                </div>
                {/* Status */}
                {user.isActive ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#22C55E', background: '#F0FDF4', borderRadius: 6, padding: '3px 8px' }}>
                    <CheckCircle size={11} /> Active
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#F59E0B', background: '#FFFBEB', borderRadius: 6, padding: '3px 8px' }}>
                    <Clock size={11} /> Pending
                  </span>
                )}
                {user.isActive && canDeactivate && (
                  <button
                    onClick={() => { confirm({ title: `Deactivate ${user.name}?`, onConfirm: () => deactivate.mutate(user.id) }) }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#EF4444', background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    <XCircle size={11} /> Deactivate
                  </button>
                )}
                <button
                  onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: '#f4f5f9', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#555', fontWeight: 600 }}
                >
                  {expandedId === user.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Manage
                </button>
              </div>
              {expandedId === user.id && <UserPermPanel user={user} roles={roles} />}
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 32 }}>No users found.</p>
          )}
        </div>
      )}
      </>}
    </div>
  )
}
