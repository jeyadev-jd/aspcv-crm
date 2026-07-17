import { useState } from 'react'
import { ShieldAlert, Download, Search, X } from 'lucide-react'
import { useAuditLogs, useAuditLogModules, downloadAuditLogsCsv } from '@/hooks/useAuditLogs'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import Pagination from '@/components/shared/Pagination'

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  create: { bg: '#E7FAF0', color: '#2BC155' },
  update: { bg: '#E8EDFF', color: '#5D78FF' },
  delete: { bg: '#FFEEEE', color: '#FF5353' },
  approve: { bg: '#E7FAF0', color: '#2BC155' },
  reject: { bg: '#FFEEEE', color: '#FF5353' },
  login: { bg: '#F3EEFF', color: '#8B5CF6' },
  archive: { bg: '#FFF5EE', color: '#FF9B52' },
}

export default function AuditLogs() {
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const filters = { module: module || undefined, action: action || undefined, q: q || undefined, page, pageSize }
  const { data, isLoading, isError } = useAuditLogs(filters)
  const { data: modules = [] } = useAuditLogModules()

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  async function handleExport() {
    await downloadAuditLogsCsv(filters)
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <ShieldAlert size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Audit Log</h1>
        <p style={{ fontSize: 12, color: '#B1B1BE', margin: 0 }}>Who changed what, when, and from where</p>
        <button onClick={handleExport} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search user, module, entity, reason…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 36, borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={12} /></button>}
        </div>
        <select value={module} onChange={e => { setModule(e.target.value); setPage(1) }} style={{ height: 36, borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, padding: '0 10px', background: '#fff' }}>
          <option value="">All modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} style={{ height: 36, borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, padding: '0 10px', background: '#fff' }}>
          <option value="">All actions</option>
          {['create', 'update', 'delete', 'approve', 'reject', 'login', 'archive'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {isLoading ? <Spinner /> : isError ? (
        <EmptyState icon={ShieldAlert} title="Failed to load audit log" />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No audit entries" subtitle="Nothing matches these filters yet." />
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ background: '#F8F9FF' }}>
                  {['Time', 'User', 'Role', 'Action', 'Module', 'Entity', 'IP', 'Browser'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#374557', borderBottom: '2px solid #F0F1F5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map(log => {
                  const style = ACTION_STYLE[log.action] ?? { bg: '#F4F5F9', color: '#8C8C8C' }
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F4F5F9' }}>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#374557', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#374557' }}>{log.userName ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#B1B1BE' }}>{log.roleName ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: style.bg, color: style.color }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#374557' }}>{log.module}</td>
                      <td style={{ padding: '10px 14px', fontSize: 10, color: '#B1B1BE', fontFamily: 'monospace' }}>{log.entityId ? log.entityId.slice(0, 10) + '…' : '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#B1B1BE' }}>{log.ipAddress ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 10, color: '#B1B1BE', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userAgent ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
