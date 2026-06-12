import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShieldCheck, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

interface RoleDef {
  id: string
  name: string
  displayName: string
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  permissions: { id: string; resource: string; action: string; allowed: boolean }[]
}

export default function Roles() {
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
    <div style={{ padding: '24px', maxWidth: 900 }}>
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
                    onClick={e => { e.stopPropagation(); if (confirm(`Delete role "${role.displayName}"?`)) deleteRole.mutate(role.id) }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', padding: 4 }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {expandedId === role.id && (
                <div style={{ borderTop: '1px solid #f0f1f5', padding: 16 }}>
                  {role.permissions.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#aaa' }}>No permissions defined.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                      {role.permissions.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={p.allowed}
                            onChange={() => togglePermission.mutate({ id: role.id, resource: p.resource, action: p.action, allowed: !p.allowed })}
                          />
                          <span><b>{p.resource}</b>:{p.action}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
