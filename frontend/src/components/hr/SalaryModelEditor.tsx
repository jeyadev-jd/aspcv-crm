import { useState, useEffect, useRef } from 'react'
import { Save, Calculator } from 'lucide-react'
import { usePayrollPreview, useUpdateEmployeeSalary, type PreviewResult } from '@/hooks/usePayroll'
import { toast } from '@/lib/toast'

/**
 * Spreadsheet-style salary editor. Every input recomputes the derived fields
 * through the backend on each change, so what you see while typing is exactly
 * what payroll will calculate - the arithmetic lives in one place, not two.
 */

interface Props {
  employeeId: string
  initial: {
    masterGross?: number | null
    masterBasic?: number | null
    masterHra?: number | null
    masterOthers?: number | null
    masterSpecial1?: number | null
    masterSpecial2?: number | null
    variablePayPa?: number | null
    pfApplicable?: boolean
    esiApplicable?: boolean
  }
  onSaved?: () => void
}

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SalaryModelEditor({ employeeId, initial, onSaved }: Props) {
  const [form, setForm] = useState({
    masterGross: initial.masterGross?.toString() ?? '',
    // Blank means "use the 50/25/25 split"; a value here overrides it.
    masterBasic: initial.masterBasic?.toString() ?? '',
    masterHra: initial.masterHra?.toString() ?? '',
    masterOthers: initial.masterOthers?.toString() ?? '',
    masterSpecial1: initial.masterSpecial1?.toString() ?? '',
    masterSpecial2: initial.masterSpecial2?.toString() ?? '',
    variablePayPa: initial.variablePayPa?.toString() ?? '',
    pfApplicable: initial.pfApplicable ?? true,
    esiApplicable: initial.esiApplicable ?? true,
    // Monthly what-if inputs — preview only, not saved on the employee.
    calendarDays: '30',
    lop: '0',
    monthlySpecial1: '',
    monthlySpecial2: '',
    employeeDeduction1: '',
    employeeDeduction2: '',
    tda: '',
  })

  const [result, setResult] = useState<PreviewResult | null>(null)
  const preview = usePayrollPreview()
  const save = useUpdateEmployeeSalary()
  const previewRef = useRef(preview)
  previewRef.current = preview

  // Debounced so a burst of keystrokes issues one request, not one per letter.
  useEffect(() => {
    const t = setTimeout(() => {
      previewRef.current.mutate(form, {
        onSuccess: setResult,
        onError: () => setResult(null),
      })
    }, 250)
    return () => clearTimeout(t)
  }, [form])

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function onSave() {
    const gross = Number(form.masterGross)
    if (!Number.isFinite(gross) || gross <= 0) return toast.error('Enter a valid Master Gross')

    // Blank override fields are saved as null so the 50/25/25 split keeps
    // applying rather than freezing today's computed number onto the record.
    const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
    save.mutate(
      {
        id: employeeId,
        masterGross: gross,
        masterBasic: numOrNull(form.masterBasic),
        masterHra: numOrNull(form.masterHra),
        masterOthers: numOrNull(form.masterOthers),
        masterSpecial1: Number(form.masterSpecial1) || 0,
        masterSpecial2: Number(form.masterSpecial2) || 0,
        variablePayPa: Number(form.variablePayPa) || 0,
        pfApplicable: form.pfApplicable,
        esiApplicable: form.esiApplicable,
      },
      {
        onSuccess: () => { toast.success('Master salary saved'); onSaved?.() },
        onError: (e: unknown) =>
          toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not save'),
      }
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calculator size={15} /> Salary Model
          {preview.isPending && <span style={{ fontSize: 10, color: '#8A8FA8', fontWeight: 500 }}>calculating…</span>}
        </h2>
        <button onClick={onSave} disabled={save.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: save.isPending ? 'default' : 'pointer', opacity: save.isPending ? 0.6 : 1 }}>
          <Save size={13} />{save.isPending ? 'Saving…' : 'Save Master Salary'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 14 }}>
        Type a value and every dependent field recalculates immediately. Basic / HRA / Others
        default to the 50 / 25 / 25 split of Master Gross — leave them blank to keep that,
        or enter a value to override.
      </p>

      {/* ── Inputs ── */}
      <SubHeading>Master Salary Inputs</SubHeading>
      <InputGrid>
        <Field label="Master Gross" value={form.masterGross} onChange={(v) => set('masterGross', v)} autoFocus />
        <Field label="Master Basic" value={form.masterBasic} onChange={(v) => set('masterBasic', v)} placeholder={result ? String(result.masterBasic) : '50%'} />
        <Field label="Master HRA" value={form.masterHra} onChange={(v) => set('masterHra', v)} placeholder={result ? String(result.masterHra) : '25%'} />
        <Field label="Master Others" value={form.masterOthers} onChange={(v) => set('masterOthers', v)} placeholder={result ? String(result.masterOthers) : '25%'} />
        <Field label="Special 1" value={form.masterSpecial1} onChange={(v) => set('masterSpecial1', v)} />
        <Field label="Special 2" value={form.masterSpecial2} onChange={(v) => set('masterSpecial2', v)} />
        <Field label="Variable Pay PA" value={form.variablePayPa} onChange={(v) => set('variablePayPa', v)} />
        <Toggle label="PF applicable" checked={form.pfApplicable} onChange={(v) => set('pfApplicable', v)} />
        <Toggle label="ESI applicable" checked={form.esiApplicable} onChange={(v) => set('esiApplicable', v)} />
      </InputGrid>

      <SubHeading>Monthly Inputs (preview only — not saved on the employee)</SubHeading>
      <InputGrid>
        <Field label="Calendar Days" value={form.calendarDays} onChange={(v) => set('calendarDays', v)} />
        <Field label="LOP Days" value={form.lop} onChange={(v) => set('lop', v)} />
        <Field label="Monthly Special 1" value={form.monthlySpecial1} onChange={(v) => set('monthlySpecial1', v)} />
        <Field label="Monthly Special 2" value={form.monthlySpecial2} onChange={(v) => set('monthlySpecial2', v)} />
        <Field label="Deduction 1" value={form.employeeDeduction1} onChange={(v) => set('employeeDeduction1', v)} />
        <Field label="Deduction 2" value={form.employeeDeduction2} onChange={(v) => set('employeeDeduction2', v)} />
        <Field label="TDA" value={form.tda} onChange={(v) => set('tda', v)} />
      </InputGrid>

      {/* ── Computed ── */}
      {result && (
        <>
          <SubHeading>Computed — Master</SubHeading>
          <OutGrid>
            <Out label="Master Basic" value={money(result.masterBasic)} />
            <Out label="Master HRA" value={money(result.masterHra)} />
            <Out label="Master Others" value={money(result.masterOthers)} />
            <Out label="Master Gross" value={money(result.masterGross)} strong />
            <Out label="PF Basic" value={money(result.masterPfBasic)} hint="min(Gross − HRA, 15,000)" />
            <Out label="Co PF" value={money(result.masterCoPf)} hint="× 12%" />
            <Out label="For ESI" value={result.masterForEsi} />
            <Out label="ESI Gross" value={money(result.masterEsiGross)} />
            <Out label="Co ESI" value={money(result.masterCoEsi)} hint="× 3.25%" />
            <Out label="CTC PM" value={money(result.masterCtcPm)} strong />
            <Out label="CTC PA" value={money(result.masterCtcPa)} />
            <Out label="CTC PA Fix+Vari" value={money(result.masterCtcPaTotal)} strong />
          </OutGrid>

          <SubHeading>Computed — Monthly</SubHeading>
          <OutGrid>
            <Out label="Days for Salary" value={String(result.daysForSalary)} />
            <Out label="Monthly Basic" value={money(result.monthlyBasic)} />
            <Out label="Monthly HRA" value={money(result.monthlyHra)} />
            <Out label="Monthly Others" value={money(result.monthlyOthers)} />
            <Out label="Monthly Gross" value={money(result.monthlyGross)} strong />
            <Out label="Gross − HRA" value={money(result.grossHra)} hint="PF wage basis" />
          </OutGrid>

          <SubHeading>Computed — Deductions & Net Pay</SubHeading>
          <OutGrid>
            <Out label="Employee PF" value={money(result.employeePf)} />
            <Out label="Employee ESI" value={money(result.employeeEsi)} />
            <Out label="TDS" value={money(result.employeeTds)} />
            <Out label="Professional Tax" value={money(result.employeePt)} />
            <Out label="Total Deduction" value={money(result.totalDeduction)} danger />
            <Out label="TDA" value={money(result.tda)} />
            <Out label="Net Pay" value={money(result.netPay)} strong success />
          </OutGrid>

          <SubHeading>Computed — Employer Contributions</SubHeading>
          <OutGrid>
            <Out label="Employer PF" value={money(result.employerPf)} />
            <Out label="Admin Charges" value={money(result.adminCharges)} />
            <Out label="EDLI Charges" value={money(result.edliCharges)} />
            <Out label="Employer ESI" value={money(result.employerEsi)} />
            <Out label="Total Employer Cost" value={money(result.totalEmployerCost)} strong />
          </OutGrid>
        </>
      )}
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8FA8', margin: '16px 0 8px', letterSpacing: 0.3 }}>
      {children}
    </div>
  )
}

function InputGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>{children}</div>
}

function OutGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, background: '#FAFBFF', borderRadius: 8, padding: 12 }}>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 10.5, color: '#8A8FA8', display: 'block', marginBottom: 3 }}>{label}</span>
      <input
        type="number"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #E8E9F0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
      />
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151', cursor: 'pointer', paddingTop: 16 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {label}
    </label>
  )
}

function Out({ label, value, hint, strong, danger, success }: {
  label: string; value: string; hint?: string; strong?: boolean; danger?: boolean; success?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8A8FA8' }}>{label}</div>
      <div style={{
        fontSize: strong ? 14 : 12.5,
        fontWeight: strong ? 700 : 600,
        marginTop: 2,
        color: success ? '#2BC155' : danger ? '#EF4444' : '#1A1D23',
      }}>{value}</div>
      {hint && <div style={{ fontSize: 9.5, color: '#B1B1BE', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}
