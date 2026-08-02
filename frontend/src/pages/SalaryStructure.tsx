import { useState } from 'react'
import { Calculator, TrendingUp, IndianRupee } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

const inp = (): React.CSSProperties => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
})

const card = (accent: string): React.CSSProperties => ({
  background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20,
  borderLeft: `4px solid ${accent}`,
})

export default function SalaryStructure() {
  const [grossInput, setGrossInput] = useState('')
  const [tab, setTab] = useState<'calculator' | 'revision'>('calculator')

  const calcMut = useMutation({
    mutationFn: (gross: number) => api.post('/salary-structure/calculate', { grossSalary: gross }).then(r => r.data),
  })

  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => api.get('/users').then(r => r.data?.data || r.data || []) })

  const [revForm, setRevForm] = useState({ userId: '', newGross: '', effectiveDate: '', reason: '' })
  const revMut = useMutation({
    mutationFn: (data: any) => api.post('/salary-structure/revision', data).then(r => r.data),
  })

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: '0 0 24px' }}>Salary Structure</h2>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #F0F1F5', marginBottom: 24 }}>
        {(['calculator', 'revision'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
            marginBottom: -2, color: tab === t ? '#5D78FF' : '#B1B1BE', textTransform: 'capitalize',
          }}>{t === 'calculator' ? 'Salary Calculator' : 'Salary Revision'}</button>
        ))}
      </div>

      {tab === 'calculator' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 300 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Monthly Gross Salary</p>
              <input type="number" value={grossInput} onChange={e => setGrossInput(e.target.value)} placeholder="50000" style={inp()} />
            </div>
            <button onClick={() => grossInput && calcMut.mutateAsync(parseFloat(grossInput))} disabled={calcMut.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', height: 36 }}>
              <Calculator size={13} /> {calcMut.isPending ? 'Calculating...' : 'Calculate Breakdown'}
            </button>
          </div>

          {calcMut.data && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Gross Salary', value: calcMut.data.gross, color: '#5D78FF' },
                  { label: 'Total Deductions', value: calcMut.data.totalDeductions, color: '#DC2626' },
                  { label: 'Net Salary', value: calcMut.data.netSalary, color: '#2BC155' },
                  { label: 'CTC', value: calcMut.data.ctc, color: '#7C3AED' },
                ].map(c => (
                  <div key={c.label} style={card(c.color)}>
                    <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{c.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{fmt(c.value)}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#2BC155', marginBottom: 12 }}>Earnings</p>
                  {Object.entries(calcMut.data.breakdown as Record<string, number>)
                    .filter(([k]) => ['BASIC', 'HRA', 'SA'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8F9FD' }}>
                        <span style={{ fontSize: 12, color: '#374557' }}>{k === 'BASIC' ? 'Basic' : k === 'HRA' ? 'HRA' : 'Special Allowance'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{fmt(v)}</span>
                      </div>
                    ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 12 }}>Deductions</p>
                  {Object.entries(calcMut.data.breakdown as Record<string, number>)
                    .filter(([k]) => ['PF_EE', 'ESI_EE', 'PT', 'TDS'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8F9FD' }}>
                        <span style={{ fontSize: 12, color: '#374557' }}>{k === 'PF_EE' ? 'PF (Employee)' : k === 'ESI_EE' ? 'ESI (Employee)' : k}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: v > 0 ? '#DC2626' : '#B1B1BE' }}>{v > 0 ? fmt(v) : '-'}</span>
                      </div>
                    ))}
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', marginTop: 16, marginBottom: 8 }}>Employer Contributions</p>
                  {Object.entries(calcMut.data.breakdown as Record<string, number>)
                    .filter(([k]) => ['PF_ER', 'ESI_ER'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8F9FD' }}>
                        <span style={{ fontSize: 12, color: '#374557' }}>{k === 'PF_ER' ? 'PF (Employer)' : 'ESI (Employer)'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: v > 0 ? '#7C3AED' : '#B1B1BE' }}>{v > 0 ? fmt(v) : '-'}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'revision' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 24, maxWidth: 600 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 16 }}>
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Create Salary Revision
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Employee</p>
              <select value={revForm.userId} onChange={e => setRevForm(f => ({ ...f, userId: e.target.value }))} style={{ ...inp(), cursor: 'pointer' }}>
                <option value="">Select employee</option>
                {(Array.isArray(users) ? users : []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} — {(u.department as any)?.name || u.department || 'N/A'}</option>
                ))}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>New Gross Salary</p>
              <input type="number" value={revForm.newGross} onChange={e => setRevForm(f => ({ ...f, newGross: e.target.value }))} placeholder="60000" style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Effective Date</p>
              <input type="date" value={revForm.effectiveDate} onChange={e => setRevForm(f => ({ ...f, effectiveDate: e.target.value }))} style={inp()} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 5 }}>Reason</p>
              <input value={revForm.reason} onChange={e => setRevForm(f => ({ ...f, reason: e.target.value }))} placeholder="Annual increment" style={inp()} />
            </div>
          </div>
          <button onClick={() => revMut.mutateAsync({ ...revForm, newGross: parseFloat(revForm.newGross) })} disabled={revMut.isPending}
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <IndianRupee size={13} /> {revMut.isPending ? 'Processing...' : 'Create Revision'}
          </button>
          {revMut.data && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#E7FAF0', fontSize: 12, color: '#2BC155', fontWeight: 600 }}>
              Revision created. Increase: {revMut.data.percentageIncrease}% | Arrears: {fmt(revMut.data.arrearsAmount || 0)} ({revMut.data.arrearsMonths} months)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
