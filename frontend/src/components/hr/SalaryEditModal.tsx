import { useState } from 'react'
import { X } from 'lucide-react'
import type { SalaryRecord, SalaryEditFields } from '@/hooks/useSalary'
import { toast } from '@/lib/toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Editable numeric columns, grouped for the form. Order = display order.
const EARNINGS: { key: keyof SalaryEditFields; label: string }[] = [
  { key: 'baseSalary', label: 'Base Salary' },
  { key: 'hra', label: 'HRA' },
  { key: 'allowances', label: 'Allowances' },
  { key: 'grossSalary', label: 'Gross Salary' },
]
const DEDUCTIONS: { key: keyof SalaryEditFields; label: string }[] = [
  { key: 'pfEmployee', label: 'PF (Employee)' },
  { key: 'esiEmployee', label: 'ESI (Employee)' },
  { key: 'tds', label: 'TDS' },
  { key: 'lateDeduction', label: 'Late Deduction' },
  { key: 'absentDeduction', label: 'Absent Deduction' },
  { key: 'otherDeduction', label: 'Other Deduction' },
]
const EMPLOYER: { key: keyof SalaryEditFields; label: string }[] = [
  { key: 'pfEmployer', label: 'PF (Employer)' },
  { key: 'esiEmployer', label: 'ESI (Employer)' },
]

const fInp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E8E9F0',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

export default function SalaryEditModal({
  record, isPending, onClose, onSubmit,
}: {
  record: SalaryRecord
  isPending: boolean
  onClose: () => void
  onSubmit: (fields: SalaryEditFields, reason: string) => void
}) {
  const allKeys = [...EARNINGS, ...DEDUCTIONS, ...EMPLOYER].map(f => f.key)
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(allKeys.map(k => [k, String((record as any)[k] ?? 0)])),
  )
  const [reason, setReason] = useState('')

  const num = (k: string) => Number(form[k]) || 0
  // Mirror the backend net formula so HR sees the result before submitting.
  const net = Math.max(0,
    num('grossSalary') - num('pfEmployee') - num('esiEmployee') - num('tds') -
    num('lateDeduction') - num('absentDeduction') - num('otherDeduction'))

  function submit() {
    // `num()` only catches NaN (falls back to 0) - Infinity and negative
    // amounts pass straight through and would corrupt netSalary once an admin
    // approves the correction, so they're checked explicitly here.
    for (const k of allKeys) {
      const raw = Number(form[k])
      if (form[k].trim() !== '' && (!Number.isFinite(raw) || raw < 0)) {
        toast.error(`${String(k)} must be a non-negative number`)
        return
      }
    }
    if (reason.trim().length < 3) {
      toast.error('Enter a reason for this correction')
      return
    }
    const fields = Object.fromEntries(allKeys.map(k => [k, num(k)])) as SalaryEditFields
    onSubmit(fields, reason.trim())
  }

  const group = (title: string, items: { key: keyof SalaryEditFields; label: string }[]) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {items.map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>{f.label} ₹</div>
            <input type="number" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={fInp} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Correct Payroll</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8FA8' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#8A8FA8', margin: '0 0 16px' }}>
          {record.user?.name ?? 'Employee'} — {MONTHS[record.month - 1]} {record.year}. Changes need admin approval before they apply.
        </p>

        {group('Earnings', EARNINGS)}
        {group('Employee Deductions', DEDUCTIONS)}
        {group('Employer Contributions', EMPLOYER)}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 4 }}>Reason for correction</div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. TDS slab applied wrongly" style={fInp} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#8A8FA8', fontWeight: 600 }}>New Net Pay (auto)</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2BC155' }}>₹{Math.round(net).toLocaleString('en-IN')}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={isPending}
            style={{ flex: 1, background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
            {isPending ? 'Submitting…' : 'Submit for Approval'}
          </button>
          <button onClick={onClose} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
