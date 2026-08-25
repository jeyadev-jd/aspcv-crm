import { useState, useEffect, useRef } from 'react'
import { Save, Calculator, RotateCcw } from 'lucide-react'
import { usePayrollPreview, useUpdateEmployeeSalary, type PreviewResult } from '@/hooks/usePayroll'
import { toast } from '@/lib/toast'

/**
 * Spreadsheet-style salary editor.
 *
 * Every field is a real input holding a real number. Typing in one recomputes
 * the rest through the backend and writes the results straight into the other
 * inputs, so what you see is what payroll will calculate - and any computed
 * value can then be typed over.
 *
 * A field the user has edited by hand is "pinned": recalculation stops
 * overwriting it, and the formulas take it as an input instead. Clearing the
 * field (or pressing Reset) unpins it and hands it back to the formula.
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
  /** Day counts from the real period calculation, so the editor's monthly
   *  figures match the breakdown shown alongside it. */
  calendarDays?: number
  lop?: number
  onSaved?: () => void
}

/** Computed fields the user may override. */
type Overridable =
  | 'masterBasic' | 'masterHra' | 'masterOthers'
  | 'employeeTds' | 'employeePt'

const num = (v: string) => (v.trim() === '' ? 0 : Number(v))
const show = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(Math.round(n * 100) / 100)

export default function SalaryModelEditor({ employeeId, initial, calendarDays, lop, onSaved }: Props) {
  // Inputs the user drives directly.
  const [inputs, setInputs] = useState({
    masterGross: initial.masterGross?.toString() ?? '',
    masterSpecial1: initial.masterSpecial1?.toString() ?? '',
    masterSpecial2: initial.masterSpecial2?.toString() ?? '',
    variablePayPa: initial.variablePayPa?.toString() ?? '',
    pfApplicable: initial.pfApplicable ?? true,
    esiApplicable: initial.esiApplicable ?? true,
    calendarDays: String(calendarDays ?? 30),
    lop: String(lop ?? 0),
    monthlySpecial1: '',
    monthlySpecial2: '',
    employeeDeduction1: '',
    employeeDeduction2: '',
    tda: '',
  })

  // Fields the user has typed over. A key present here wins over the formula.
  const [overrides, setOverrides] = useState<Partial<Record<Overridable, string>>>(() => {
    const o: Partial<Record<Overridable, string>> = {}
    if (initial.masterBasic != null) o.masterBasic = String(initial.masterBasic)
    if (initial.masterHra != null) o.masterHra = String(initial.masterHra)
    if (initial.masterOthers != null) o.masterOthers = String(initial.masterOthers)
    return o
  })

  const [result, setResult] = useState<PreviewResult | null>(null)
  const preview = usePayrollPreview()
  const save = useUpdateEmployeeSalary()
  const previewRef = useRef(preview)
  previewRef.current = preview

  // Debounced so a burst of keystrokes issues one request, not one per letter.
  useEffect(() => {
    const t = setTimeout(() => {
      previewRef.current.mutate(
        {
          ...inputs,
          // Only send overrides that still hold a value; a cleared field falls
          // back to the formula.
          masterBasic: overrides.masterBasic?.trim() ? overrides.masterBasic : null,
          masterHra: overrides.masterHra?.trim() ? overrides.masterHra : null,
          masterOthers: overrides.masterOthers?.trim() ? overrides.masterOthers : null,
          ...(overrides.employeeTds?.trim() ? { employeeTds: overrides.employeeTds } : {}),
          ...(overrides.employeePt?.trim() ? { employeePt: overrides.employeePt } : {}),
        },
        { onSuccess: setResult, onError: () => setResult(null) }
      )
    }, 250)
    return () => clearTimeout(t)
  }, [inputs, overrides])

  // The period calculation resolves after the first render, so adopt its day
  // counts when they arrive. Only fills the defaults - a value the user has
  // already typed is left alone.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || calendarDays === undefined) return
    seeded.current = true
    setInputs((f) => ({
      ...f,
      calendarDays: f.calendarDays === '30' ? String(calendarDays) : f.calendarDays,
      lop: f.lop === '0' ? String(lop ?? 0) : f.lop,
    }))
  }, [calendarDays, lop])

  function setInput(key: keyof typeof inputs, value: string | boolean) {
    setInputs((f) => ({ ...f, [key]: value }))
  }

  /** Value shown in an overridable field: the user's edit, else the computed number. */
  function fieldValue(key: Overridable): string {
    if (overrides[key] !== undefined) return overrides[key] as string
    return show(result?.[key] as number | undefined)
  }

  function setOverride(key: Overridable, value: string) {
    setOverrides((o) => {
      if (value.trim() === '') {
        // Cleared - hand the field back to the formula.
        const next = { ...o }
        delete next[key]
        return next
      }
      return { ...o, [key]: value }
    })
  }

  function resetOverrides() {
    setOverrides({})
    toast.success('Reverted to calculated values')
  }

  function onSave() {
    // Master Gross is the sum of the components (workbook AA = SUM(U:Z)), so
    // the calculated total is what gets stored - the seed field is only a
    // convenience for filling an empty form.
    const gross = result?.masterGross ?? Number(inputs.masterGross)
    if (!Number.isFinite(gross) || gross <= 0) {
      return toast.error('Enter Basic, HRA and Others (or a gross figure to split)')
    }

    // The components are the source of truth, so the values on screen are what
    // gets stored - including ones the 50/25/25 seed produced. Saving those as
    // null would leave the record unable to reproduce this exact gross.
    const component = (k: Overridable, computed: number | undefined) => {
      if (overrides[k]?.trim()) return Number(overrides[k])
      return computed ?? null
    }

    // A stray override this can't parse (or the server-side reformula for a
    // computed field returning nothing) must not save silently - it would
    // write NaN or a negative figure straight into a field every payroll
    // calculation for this employee reads from then on.
    const values = {
      masterBasic: component('masterBasic', result?.masterBasic),
      masterHra: component('masterHra', result?.masterHra),
      masterOthers: component('masterOthers', result?.masterOthers),
      masterSpecial1: num(inputs.masterSpecial1),
      masterSpecial2: num(inputs.masterSpecial2),
      variablePayPa: num(inputs.variablePayPa),
    }
    for (const [k, v] of Object.entries(values)) {
      if (v !== null && (!Number.isFinite(v) || v < 0)) {
        return toast.error(`${k} must be a non-negative number`)
      }
    }

    save.mutate(
      {
        id: employeeId,
        masterGross: gross,
        ...values,
        pfApplicable: inputs.pfApplicable,
        esiApplicable: inputs.esiApplicable,
      },
      {
        onSuccess: () => { toast.success('Master salary saved'); onSaved?.() },
        onError: (e: unknown) =>
          toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not save'),
      }
    )
  }

  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calculator size={15} /> Salary Model
          {preview.isPending && <span style={{ fontSize: 10, color: '#8A8FA8', fontWeight: 500 }}>calculating…</span>}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasOverrides && (
            <button onClick={resetOverrides}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#6B7280', border: 'none', cursor: 'pointer' }}>
              <RotateCcw size={12} />Reset to formula
            </button>
          )}
          <button onClick={onSave} disabled={save.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: save.isPending ? 'default' : 'pointer', opacity: save.isPending ? 0.6 : 1 }}>
            <Save size={13} />{save.isPending ? 'Saving…' : 'Save Master Salary'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#8A8FA8', marginBottom: 14 }}>
        Enter Basic, HRA and Others — Master Gross is their sum, and every field below recalculates
        as you type. Grey boxes are formula results; TDS and Professional Tax are calculated but can
        be typed over, and clearing one hands it back to the formula.
      </p>

      {/* Basic / HRA / Others are the inputs and Master Gross is their sum,
          matching the workbook where U/V/W are typed and AA is =SUM(U:Z). */}
      <SubHeading>Master Salary — enter the components</SubHeading>
      <Grid>
        <Input label="Master Basic" value={fieldValue('masterBasic')} onChange={(v) => setOverride('masterBasic', v)} autoFocus primary />
        <Input label="Master HRA" value={fieldValue('masterHra')} onChange={(v) => setOverride('masterHra', v)} primary />
        <Input label="Master Others" value={fieldValue('masterOthers')} onChange={(v) => setOverride('masterOthers', v)} primary />
        <Input label="Special 1" value={inputs.masterSpecial1} onChange={(v) => setInput('masterSpecial1', v)} />
        <Input label="Special 2" value={inputs.masterSpecial2} onChange={(v) => setInput('masterSpecial2', v)} />
        <Readonly label="Master Gross" value={show(result?.masterGross)} hint="= sum of the components" strong />
      </Grid>

      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 11, color: '#8A8FA8', cursor: 'pointer' }}>
          Start from a gross figure instead (splits 50 / 25 / 25)
        </summary>
        <div style={{ marginTop: 8, maxWidth: 220 }}>
          <Input
            label="Master Gross (seed)"
            hint="only used while the components above are blank"
            value={inputs.masterGross}
            onChange={(v) => setInput('masterGross', v)}
          />
        </div>
      </details>

      <SubHeading>Statutory — calculated</SubHeading>
      <Grid>
        <Readonly label="Master PF Basic" value={show(result?.masterPfBasic)} hint="min(Gross − HRA, 15,000)" />
        <Readonly label="Master Co PF" value={show(result?.masterCoPf)} hint="× 12%" />
        <Readonly label="For ESI" value={result?.masterForEsi ?? ''} hint="Gross > 21,000 ⇒ NO ESI" text />
        <Readonly label="Master ESI Gross" value={show(result?.masterEsiGross)} />
        <Readonly label="Master Co ESI" value={show(result?.masterCoEsi)} hint="× 3.25%" />
        <Readonly label="Master CTC PM" value={show(result?.masterCtcPm)} hint="Gross + CoPF + CoESI" strong />
        <Readonly label="Master CTC PA" value={show(result?.masterCtcPa)} hint="× 12" />
        <Input label="Variable Pay PA" value={inputs.variablePayPa} onChange={(v) => setInput('variablePayPa', v)} />
        <Readonly label="CTC PA Fix + Vari" value={show(result?.masterCtcPaTotal)} strong />
      </Grid>

      <div style={{ display: 'flex', gap: 18, marginTop: 10, marginBottom: 4 }}>
        <Toggle label="PF applicable" checked={inputs.pfApplicable} onChange={(v) => setInput('pfApplicable', v)} />
        <Toggle label="ESI applicable" checked={inputs.esiApplicable} onChange={(v) => setInput('esiApplicable', v)} />
      </div>

      <SubHeading>Attendance & Salary Days</SubHeading>
      <Grid>
        <Input label="Calendar Days" value={inputs.calendarDays} onChange={(v) => setInput('calendarDays', v)} />
        <Input label="LOP Days" value={inputs.lop} onChange={(v) => setInput('lop', v)} />
        <Readonly label="Days for Salary" value={show(result?.daysForSalary)} hint="calendar − LOP" strong text />
      </Grid>

      <SubHeading>Monthly Earnings — calculated</SubHeading>
      <Grid>
        <Readonly label="Monthly Basic" value={show(result?.monthlyBasic)} hint="÷ cal. days × payable" />
        <Readonly label="Monthly HRA" value={show(result?.monthlyHra)} />
        <Readonly label="Monthly Others" value={show(result?.monthlyOthers)} />
        <Input label="Monthly Special 1" value={inputs.monthlySpecial1} onChange={(v) => setInput('monthlySpecial1', v)} />
        <Input label="Monthly Special 2" value={inputs.monthlySpecial2} onChange={(v) => setInput('monthlySpecial2', v)} />
        <Readonly label="Monthly Gross" value={show(result?.monthlyGross)} strong />
        <Readonly label="Gross − HRA" value={show(result?.grossHra)} hint="PF wage basis" />
      </Grid>

      <SubHeading>Deductions</SubHeading>
      <Grid>
        <Readonly label="Employee PF" value={show(result?.employeePf)} hint="12%, flat 1,800 above ceiling" />
        <Readonly label="Employee ESI" value={show(result?.employeeEsi)} hint="0.75% when eligible" />
        <Input label="Employee TDS" hint="auto from CTC" value={fieldValue('employeeTds')} onChange={(v) => setOverride('employeeTds', v)} computed overridden={overrides.employeeTds !== undefined} />
        <Input label="Professional Tax" hint="Tamil Nadu" value={fieldValue('employeePt')} onChange={(v) => setOverride('employeePt', v)} computed overridden={overrides.employeePt !== undefined} />
        <Input label="Deduction 1" value={inputs.employeeDeduction1} onChange={(v) => setInput('employeeDeduction1', v)} />
        <Input label="Deduction 2" value={inputs.employeeDeduction2} onChange={(v) => setInput('employeeDeduction2', v)} />
        <Readonly label="Total Deduction" value={show(result?.totalDeduction)} strong danger />
        <Input label="TDA" value={inputs.tda} onChange={(v) => setInput('tda', v)} />
        <Readonly label="Net Pay" value={show(result?.netPay)} strong success />
      </Grid>

      <SubHeading>Employer Contributions — calculated</SubHeading>
      <Grid>
        <Readonly label="Employer PF" value={show(result?.employerPf)} />
        <Readonly label="Admin Charges" value={show(result?.adminCharges)} hint="0.5%" />
        <Readonly label="EDLI Charges" value={show(result?.edliCharges)} hint="0.5%" />
        <Readonly label="Employer ESI" value={show(result?.employerEsi)} hint="3.25% below 21,000" />
        <Readonly label="Total Employer Cost" value={show(result?.totalEmployerCost)} strong />
      </Grid>
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>{children}</div>
}

/**
 * `computed` marks a field the formula fills in but the user may type over;
 * `overridden` shows it currently holds a manual value.
 */
function Input({ label, value, onChange, hint, autoFocus, primary, computed, overridden }: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  autoFocus?: boolean
  primary?: boolean
  computed?: boolean
  overridden?: boolean
}) {
  const border = overridden ? '#F59E0B' : computed ? '#93C5FD' : primary ? '#5D78FF' : '#E8E9F0'
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 10.5, color: '#8A8FA8', display: 'block', marginBottom: 3 }}>
        {label}
        {overridden && <span style={{ color: '#F59E0B', fontWeight: 700 }}> · edited</span>}
      </span>
      <input
        type="number"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 9px', borderRadius: 7,
          border: `1.5px solid ${border}`,
          background: overridden ? '#FFFBEB' : '#fff',
          fontSize: 12, fontWeight: primary ? 700 : 500,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {hint && <span style={{ fontSize: 9.5, color: '#B1B1BE', display: 'block', marginTop: 2 }}>{hint}</span>}
    </label>
  )
}

/** Pure formula output - shown in a field-shaped box so the grid reads evenly. */
function Readonly({ label, value, hint, strong, danger, success, text }: {
  label: string; value: string; hint?: string; strong?: boolean; danger?: boolean; success?: boolean; text?: boolean
}) {
  return (
    <div>
      <span style={{ fontSize: 10.5, color: '#8A8FA8', display: 'block', marginBottom: 3 }}>{label}</span>
      <div style={{
        padding: '7px 9px', borderRadius: 7, border: '1.5px solid transparent',
        background: '#F4F6FB',
        fontSize: strong ? 13 : 12,
        fontWeight: strong ? 700 : 600,
        color: success ? '#2BC155' : danger ? '#EF4444' : '#1A1D23',
        minHeight: 32, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center',
      }}>
        {value === '' ? <span style={{ color: '#C4C4CF', fontWeight: 500 }}>—</span> : text ? value : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
      {hint && <span style={{ fontSize: 9.5, color: '#B1B1BE', display: 'block', marginTop: 2 }}>{hint}</span>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {label}
    </label>
  )
}
