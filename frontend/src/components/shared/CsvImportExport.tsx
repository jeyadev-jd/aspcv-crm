import { useRef, useState } from 'react'
import { Download, Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { exportCSV, parseCSV } from '@/lib/csvUtils'

export interface CsvColDef<T> {
  header: string
  accessor: (row: T) => string
}

interface ImportResult {
  total: number
  success: number
  errors: string[]
}

interface Props<T> {
  // Export
  data: T[]
  columns: CsvColDef<T>[]
  filename: string
  // Template sample row (shown as example in downloaded template)
  templateRow?: Record<string, string>
  // Import: receive parsed rows, return result
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult> | ImportResult
  // Optional label override
  label?: string
  // Compact mode (icon-only buttons)
  compact?: boolean
}

export function CsvImportExport<T>({ data, columns, filename, templateRow, onImport, label, compact }: Props<T>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function handleExport() {
    if (!data.length) return
    const rows = data.map(item => Object.fromEntries(columns.map(col => [col.header, col.accessor(item)])))
    exportCSV(rows, filename)
  }

  function handleTemplate() {
    const row = templateRow ?? Object.fromEntries(columns.map(col => [col.header, '']))
    exportCSV([row], filename.replace('.csv', '-template.csv'))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await file.text()
    const rows = parseCSV(text)
    if (!rows.length) { setResult({ total: 0, success: 0, errors: ['No valid rows found in CSV'] }); return }
    setImporting(true)
    try {
      const res = await onImport(rows)
      setResult(res)
    } finally {
      setImporting(false)
    }
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5, padding: compact ? '6px 8px' : '7px 12px',
    borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid #E8EAED',
    cursor: 'pointer', whiteSpace: 'nowrap',
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={handleExport} disabled={!data.length} title="Export all current data as CSV"
          style={{ ...btnBase, background: data.length ? '#fff' : '#F4F5F9', color: data.length ? '#374557' : '#B1B1BE', borderColor: data.length ? '#E8EAED' : 'transparent' }}>
          <Download size={13} />{!compact && (label ? `Export ${label}` : 'Export')}
        </button>

        <button onClick={() => fileRef.current?.click()} disabled={importing} title="Import from CSV file"
          style={{ ...btnBase, background: importing ? '#F4F5F9' : '#EEF2FF', color: importing ? '#B1B1BE' : '#5D78FF', borderColor: '#5D78FF' }}>
          <Upload size={13} />{!compact && (importing ? 'Importing…' : 'Import')}
        </button>

        <button onClick={handleTemplate} title="Download blank template CSV"
          style={{ ...btnBase, background: '#F4F5F9', color: '#9CA3AF', borderColor: 'transparent' }}>
          <FileText size={13} />{!compact && 'Template'}
        </button>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {/* Result toast */}
      {result && (
        <div style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 999, background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '14px 18px', minWidth: 280, maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {result.errors.length === 0
              ? <CheckCircle2 size={18} color="#2BC155" style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertCircle size={18} color="#FF9B52" style={{ flexShrink: 0, marginTop: 1 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374557', marginBottom: 2 }}>
                {result.errors.length === 0 ? 'Import complete' : 'Import finished with errors'}
              </p>
              <p style={{ fontSize: 11, color: '#6B7280' }}>
                {result.success}/{result.total} rows imported successfully
              </p>
              {result.errors.slice(0, 3).map((e, i) => (
                <p key={i} style={{ fontSize: 11, color: '#FF5353', marginTop: 3 }}>• {e}</p>
              ))}
              {result.errors.length > 3 && <p style={{ fontSize: 11, color: '#FF5353' }}>…and {result.errors.length - 3} more errors</p>}
            </div>
            <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', flexShrink: 0 }}><X size={14} /></button>
          </div>
        </div>
      )}
    </>
  )
}
