import { useState } from 'react'
import { Save, Plus, Trash2, Pencil, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useConfirm } from '@/components/shared/useConfirm'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20, marginBottom: 20 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 16, borderBottom: '1px solid #F0F1F5', paddingBottom: 8 }}>{title}</p>
      {children}
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {onEdit && (
        <button onClick={onEdit} title="Edit" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#5D78FF' }}>
          <Pencil size={13} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} title="Delete" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

export default function HRSettings() {
  const { confirm, confirmDialog } = useConfirm()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'attendance' | 'leave' | 'salary' | 'holidays' | 'lop'>('attendance')
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())

  // Attendance Settings
  const { data: attSettings } = useQuery({ queryKey: ['att-settings'], queryFn: () => api.get('/leave/attendance-settings').then(r => r.data) })
  const [attForm, setAttForm] = useState<any>(null)
  const saveAtt = useMutation({
    mutationFn: (data: any) => api.put('/leave/attendance-settings', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['att-settings'] }),
  })

  // Leave Types
  const { data: leaveTypes = [] } = useQuery({ queryKey: ['leave-types-settings'], queryFn: () => api.get('/leave/types').then(r => r.data) })
  const emptyLT = { code: '', name: '', annualQuota: '0', monthlyAccrual: '0', maxCarryForward: '0', isEncashable: false, isPaidLeave: true, sandwichApplicable: false, halfDayAllowed: true }
  const [ltForm, setLtForm] = useState<any>(emptyLT)
  const [editingLT, setEditingLT] = useState<string | null>(null)
  const createLT = useMutation({
    mutationFn: (data: any) => api.post('/leave/types', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types-settings'] }); setLtForm(emptyLT) },
  })
  const updateLT = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/leave/types/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types-settings'] }); setLtForm(emptyLT); setEditingLT(null) },
  })
  const deleteLT = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types-settings'] }),
  })

  // Salary Components
  const { data: salaryComps = [] } = useQuery({ queryKey: ['salary-comps'], queryFn: () => api.get('/salary-structure/components').then(r => r.data) })
  const emptySC = { code: '', name: '', type: 'earning', calculationType: 'percentage', percentageOf: '', percentage: '', fixedAmount: '', isTaxable: true, isStatutory: false, sortOrder: '0' }
  const [scForm, setScForm] = useState<any>(emptySC)
  const [editingSC, setEditingSC] = useState<string | null>(null)
  const saveSC = useMutation({
    mutationFn: (data: any) => api.post('/salary-structure/components', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-comps'] }); setScForm(emptySC); setEditingSC(null) },
  })
  const deleteSC = useMutation({
    mutationFn: (id: string) => api.delete(`/salary-structure/components/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-comps'] }),
  })

  // LOP Rules
  const { data: lopRules = [] } = useQuery({ queryKey: ['lop-rules'], queryFn: () => api.get('/leave/late-lop-rules').then(r => r.data) })
  const [lopForm, setLopForm] = useState({ lateCount: '', lopDays: '' })
  const createLop = useMutation({
    mutationFn: (data: any) => api.post('/leave/late-lop-rules', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lop-rules'] }); setLopForm({ lateCount: '', lopDays: '' }) },
  })
  const deleteLop = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/late-lop-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lop-rules'] }),
  })

  // Holidays
  const { data: holidays = [] } = useQuery({ queryKey: ['holidays-settings', holidayYear], queryFn: () => api.get(`/leave/holidays?year=${holidayYear}`).then(r => r.data) })
  const emptyHol = { name: '', date: '', type: 'public', isOptional: false }
  const [holForm, setHolForm] = useState<any>(emptyHol)
  const [editingHol, setEditingHol] = useState<string | null>(null)
  const createHol = useMutation({
    mutationFn: (data: any) => api.post('/leave/holidays', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays-settings', holidayYear] }); setHolForm(emptyHol) },
  })
  const updateHol = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/leave/holidays/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays-settings', holidayYear] }); setHolForm(emptyHol); setEditingHol(null) },
  })
  const deleteHol = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays-settings', holidayYear] }),
  })

  const currentAtt = attForm || attSettings || {}

  function startEditLT(lt: any) {
    setEditingLT(lt.id)
    setLtForm({ ...lt, annualQuota: String(lt.annualQuota), monthlyAccrual: String(lt.monthlyAccrual), maxCarryForward: String(lt.maxCarryForward) })
  }
  function startEditSC(c: any) {
    setEditingSC(c.id)
    setScForm({ ...c, percentageOf: c.percentageOf ?? '', percentage: c.percentage ?? '', fixedAmount: c.fixedAmount ?? '', sortOrder: String(c.sortOrder ?? 0) })
  }
  function startEditHol(h: any) {
    setEditingHol(h.id)
    setHolForm({ name: h.name, date: h.date.slice(0, 10), type: h.type, isOptional: h.isOptional })
  }

  return (
    <div style={{ padding: 24 }}>
      {confirmDialog}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: '0 0 24px' }}>HR Settings</h2>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['attendance', 'leave', 'salary', 'lop', 'holidays'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', textTransform: 'capitalize',
          }}>{t === 'lop' ? 'Late/LOP Rules' : t === 'leave' ? 'Leave Types' : t === 'salary' ? 'Salary Components' : t}</button>
        ))}
      </div>

      {tab === 'attendance' && (
        <Section title="Office & Attendance Configuration">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Office Start Time</p>
              <input type="time" value={currentAtt.officeStartTime || '09:00'} onChange={e => setAttForm({ ...currentAtt, officeStartTime: e.target.value })} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Office End Time</p>
              <input type="time" value={currentAtt.officeEndTime || '18:00'} onChange={e => setAttForm({ ...currentAtt, officeEndTime: e.target.value })} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Grace Period (minutes)</p>
              <input type="number" value={currentAtt.gracePeriodMinutes ?? 15} onChange={e => setAttForm({ ...currentAtt, gracePeriodMinutes: parseInt(e.target.value) })} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Half Day Hours</p>
              <input type="number" value={currentAtt.halfDayHours ?? 4} onChange={e => setAttForm({ ...currentAtt, halfDayHours: parseFloat(e.target.value) })} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Full Day Hours</p>
              <input type="number" value={currentAtt.fullDayHours ?? 8} onChange={e => setAttForm({ ...currentAtt, fullDayHours: parseFloat(e.target.value) })} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>GPS Radius (meters)</p>
              <input type="number" value={currentAtt.gpsRadiusMeters ?? 200} onChange={e => setAttForm({ ...currentAtt, gpsRadiusMeters: parseInt(e.target.value) })} style={inp()} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Weekly Off Days</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                const weeklyOff: string[] = currentAtt.weeklyOff ?? ['Sunday']
                const checked = weeklyOff.includes(day)
                return (
                  <label key={day} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => setAttForm({
                        ...currentAtt,
                        weeklyOff: e.target.checked ? [...weeklyOff, day] : weeklyOff.filter(d => d !== day),
                      })}
                    />
                    {day}
                  </label>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={currentAtt.lateMarkAfterGrace ?? true} onChange={e => setAttForm({ ...currentAtt, lateMarkAfterGrace: e.target.checked })} />
              Late mark after grace
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={currentAtt.autoAbsentOnNoCheckIn ?? true} onChange={e => setAttForm({ ...currentAtt, autoAbsentOnNoCheckIn: e.target.checked })} />
              Auto-absent on no check-in
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={currentAtt.gpsRequired ?? false} onChange={e => setAttForm({ ...currentAtt, gpsRequired: e.target.checked })} />
              GPS required
            </label>
          </div>
          <button onClick={() => saveAtt.mutateAsync(attForm || currentAtt)} disabled={saveAtt.isPending}
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Save size={13} /> {saveAtt.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </Section>
      )}

      {tab === 'leave' && (
        <div>
          <Section title="Configured Leave Types">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F9FD' }}>
                  {['Code', 'Name', 'Quota', 'Accrual/Mo', 'Carry Fwd', 'Encashable', 'Paid', 'Sandwich', 'Half Day', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt: any) => (
                  <tr key={lt.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#5D78FF' }}>{lt.code}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{lt.name}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{lt.annualQuota}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{lt.monthlyAccrual || '-'}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{lt.maxCarryForward || '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{lt.isEncashable ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{lt.isPaidLeave ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{lt.sandwichApplicable ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{lt.halfDayAllowed ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <RowActions
                        onEdit={() => startEditLT(lt)}
                        onDelete={() => { confirm({ title: `Deactivate leave type "${lt.name}"?`, onConfirm: () => deleteLT.mutate(lt.id) }) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title={editingLT ? 'Edit Leave Type' : 'Add Leave Type'}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Code</p><input value={ltForm.code} onChange={e => setLtForm((f: any) => ({ ...f, code: e.target.value }))} placeholder="AL" style={inp()} disabled={!!editingLT} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Name</p><input value={ltForm.name} onChange={e => setLtForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Annual Leave" style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Annual Quota</p><input type="number" value={ltForm.annualQuota} onChange={e => setLtForm((f: any) => ({ ...f, annualQuota: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Monthly Accrual</p><input type="number" value={ltForm.monthlyAccrual} onChange={e => setLtForm((f: any) => ({ ...f, monthlyAccrual: e.target.value }))} style={inp()} /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!ltForm.isEncashable} onChange={e => setLtForm((f: any) => ({ ...f, isEncashable: e.target.checked }))} /> Encashable
              </label>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={ltForm.isPaidLeave !== false} onChange={e => setLtForm((f: any) => ({ ...f, isPaidLeave: e.target.checked }))} /> Paid
              </label>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!ltForm.sandwichApplicable} onChange={e => setLtForm((f: any) => ({ ...f, sandwichApplicable: e.target.checked }))} /> Sandwich rule
              </label>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={ltForm.halfDayAllowed !== false} onChange={e => setLtForm((f: any) => ({ ...f, halfDayAllowed: e.target.checked }))} /> Half day allowed
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => {
                  const payload = { ...ltForm, annualQuota: parseFloat(ltForm.annualQuota), monthlyAccrual: parseFloat(ltForm.monthlyAccrual), maxCarryForward: parseFloat(ltForm.maxCarryForward) }
                  if (editingLT) updateLT.mutate({ id: editingLT, data: payload })
                  else createLT.mutate(payload)
                }}
                disabled={createLT.isPending || updateLT.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {editingLT ? <Save size={13} /> : <Plus size={13} />} {editingLT ? 'Save Changes' : 'Add Leave Type'}
              </button>
              {editingLT && (
                <button onClick={() => { setEditingLT(null); setLtForm(emptyLT) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F0F1F5', color: '#5A5B6A', border: 'none', cursor: 'pointer' }}>
                  <X size={13} /> Cancel
                </button>
              )}
            </div>
          </Section>
        </div>
      )}

      {tab === 'salary' && (
        <div>
          <Section title="Salary Components">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F9FD' }}>
                  {['Code', 'Name', 'Type', 'Calculation', 'Of', '%/Fixed', 'Taxable', 'Statutory', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salaryComps.map((c: any) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#5D78FF' }}>{c.code}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{c.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: c.type === 'earning' ? '#E7FAF0' : c.type === 'deduction' ? '#FEE2E2' : '#E8EDFF',
                        color: c.type === 'earning' ? '#2BC155' : c.type === 'deduction' ? '#DC2626' : '#5D78FF',
                      }}>{c.type}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{c.calculationType}</td>
                    <td style={{ padding: '8px 12px', color: '#B1B1BE' }}>{c.percentageOf || '-'}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{c.percentage ? `${c.percentage}%` : c.fixedAmount ? `₹${c.fixedAmount}` : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{c.isTaxable ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{c.isStatutory ? '✓' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <RowActions
                        onEdit={() => startEditSC(c)}
                        onDelete={() => { confirm({ title: `Deactivate component "${c.name}"?`, onConfirm: () => deleteSC.mutate(c.id) }) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title={editingSC ? 'Edit Salary Component' : 'Add Salary Component'}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Code</p><input value={scForm.code} onChange={e => setScForm((f: any) => ({ ...f, code: e.target.value }))} placeholder="HRA" style={inp()} disabled={!!editingSC} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Name</p><input value={scForm.name} onChange={e => setScForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="House Rent Allowance" style={inp()} /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Type</p>
                <select value={scForm.type} onChange={e => setScForm((f: any) => ({ ...f, type: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                  <option value="statutory">Statutory</option>
                </select>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Calculation</p>
                <select value={scForm.calculationType} onChange={e => setScForm((f: any) => ({ ...f, calculationType: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Percentage Of</p><input value={scForm.percentageOf} onChange={e => setScForm((f: any) => ({ ...f, percentageOf: e.target.value }))} placeholder="basic" style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Percentage</p><input type="number" value={scForm.percentage} onChange={e => setScForm((f: any) => ({ ...f, percentage: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Fixed Amount</p><input type="number" value={scForm.fixedAmount} onChange={e => setScForm((f: any) => ({ ...f, fixedAmount: e.target.value }))} style={inp()} /></div>
              <div><p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Sort Order</p><input type="number" value={scForm.sortOrder} onChange={e => setScForm((f: any) => ({ ...f, sortOrder: e.target.value }))} style={inp()} /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={scForm.isTaxable !== false} onChange={e => setScForm((f: any) => ({ ...f, isTaxable: e.target.checked }))} /> Taxable
              </label>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!scForm.isStatutory} onChange={e => setScForm((f: any) => ({ ...f, isStatutory: e.target.checked }))} /> Statutory
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => saveSC.mutate({
                  ...scForm,
                  percentage: scForm.percentage === '' ? null : parseFloat(scForm.percentage),
                  fixedAmount: scForm.fixedAmount === '' ? null : parseFloat(scForm.fixedAmount),
                  sortOrder: parseInt(scForm.sortOrder) || 0,
                  percentageOf: scForm.percentageOf || null,
                })}
                disabled={saveSC.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {editingSC ? <Save size={13} /> : <Plus size={13} />} {editingSC ? 'Save Changes' : 'Add Component'}
              </button>
              {editingSC && (
                <button onClick={() => { setEditingSC(null); setScForm(emptySC) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F0F1F5', color: '#5A5B6A', border: 'none', cursor: 'pointer' }}>
                  <X size={13} /> Cancel
                </button>
              )}
            </div>
          </Section>
        </div>
      )}

      {tab === 'lop' && (
        <div>
          <Section title="Late-to-LOP Conversion Rules">
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 12 }}>Defines how many late marks convert to Loss of Pay days per payroll cycle</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, maxWidth: 480 }}>
              <thead>
                <tr style={{ background: '#F8F9FD' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>Late Count</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>LOP Days</th>
                  <th style={{ padding: '8px 12px', fontSize: 11 }}></th>
                </tr>
              </thead>
              <tbody>
                {lopRules.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374557' }}>{r.lateCount} late marks</td>
                    <td style={{ padding: '8px 12px', color: '#DC2626', fontWeight: 600 }}>{r.lopDays} day{r.lopDays !== 1 ? 's' : ''} LOP</td>
                    <td style={{ padding: '8px 12px' }}>
                      <RowActions onDelete={() => { confirm({ title: 'Remove this rule?', onConfirm: () => deleteLop.mutate(r.id) }) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Late Count</p>
                <input type="number" value={lopForm.lateCount} onChange={e => setLopForm(f => ({ ...f, lateCount: e.target.value }))} placeholder="3" style={{ ...inp(), width: 100 }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>LOP Days</p>
                <input type="number" step="0.5" value={lopForm.lopDays} onChange={e => setLopForm(f => ({ ...f, lopDays: e.target.value }))} placeholder="1" style={{ ...inp(), width: 100 }} />
              </div>
              <button onClick={() => createLop.mutateAsync({ lateCount: parseInt(lopForm.lateCount), lopDays: parseFloat(lopForm.lopDays) })}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', height: 36 }}>
                <Plus size={13} /> Add Rule
              </button>
            </div>
          </Section>
        </div>
      )}

      {tab === 'holidays' && (
        <div>
          <Section title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Holiday Calendar</span>
            <select value={holidayYear} onChange={e => setHolidayYear(Number(e.target.value))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, background: '#fff' }}>
              {[holidayYear - 1, holidayYear, holidayYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F9FD' }}>
                  {['Date', 'Name', 'Type', 'Optional', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#B1B1BE', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holidays.map((h: any) => (
                  <tr key={h.id} style={{ borderTop: '1px solid #F0F1F5' }}>
                    <td style={{ padding: '8px 12px', color: '#374557', fontWeight: 600 }}>{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '8px 12px', color: '#374557' }}>{h.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
                        background: h.type === 'national' ? '#EDE9FE' : '#F4F5F9',
                        color: h.type === 'national' ? '#7C3AED' : '#6B7280',
                      }}>{h.type}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#B1B1BE' }}>{h.isOptional ? 'Yes' : '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <RowActions
                        onEdit={() => startEditHol(h)}
                        onDelete={() => { confirm({ title: `Remove holiday "${h.name}"?`, onConfirm: () => deleteHol.mutate(h.id) }) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title={editingHol ? 'Edit Holiday' : 'Add Holiday'}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Name</p>
                <input value={holForm.name} onChange={e => setHolForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Holiday name" style={{ ...inp(), width: 200 }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Date</p>
                <input type="date" value={holForm.date} onChange={e => setHolForm((f: any) => ({ ...f, date: e.target.value }))} style={{ ...inp(), width: 150 }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Type</p>
                <select value={holForm.type} onChange={e => setHolForm((f: any) => ({ ...f, type: e.target.value }))} style={{ ...inp(), width: 130, cursor: 'pointer' }}>
                  <option value="public">Public</option>
                  <option value="national">National</option>
                  <option value="regional">Regional</option>
                </select>
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 4 }}>
                <input type="checkbox" checked={holForm.isOptional} onChange={e => setHolForm((f: any) => ({ ...f, isOptional: e.target.checked }))} /> Optional
              </label>
              <button
                onClick={() => editingHol ? updateHol.mutate({ id: editingHol, data: holForm }) : createHol.mutateAsync(holForm)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', height: 36 }}>
                {editingHol ? <Save size={13} /> : <Plus size={13} />} {editingHol ? 'Save Changes' : 'Add Holiday'}
              </button>
              {editingHol && (
                <button onClick={() => { setEditingHol(null); setHolForm(emptyHol) }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F0F1F5', color: '#5A5B6A', border: 'none', cursor: 'pointer', height: 36 }}>
                  <X size={13} /> Cancel
                </button>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
