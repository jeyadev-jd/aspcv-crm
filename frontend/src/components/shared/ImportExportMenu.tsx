import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload, FileSpreadsheet, X } from 'lucide-react'
import { api } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { toast } from '@/lib/toast'

interface ImportError { row: number; error?: string }

interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
}

interface Props {
  /** Entity key the data-transfer routes understand (companies|contacts|leads). */
  entity: string
  /** Query key to refetch after a successful import. */
  invalidateKey: string
  label: string
  /** Hides Import/Template for entities that only support export. */
  exportOnly?: boolean
}

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
  borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid #E8E9F0',
  background: '#fff', color: '#374151', cursor: 'pointer',
}

export default function ImportExportMenu({ entity, invalidateKey, label, exportOnly }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'template' | 'import' | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function run(kind: 'export' | 'template') {
    setBusy(kind)
    try {
      const url = kind === 'export' ? `/data-transfer/${entity}/export` : `/data-transfer/${entity}/template`
      await downloadFile(url, `${label}.xlsx`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not download ${kind}`)
    } finally {
      setBusy(null)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset immediately so picking the same file twice still fires onChange.
    e.target.value = ''
    if (!file) return

    setBusy('import')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<ImportResult>(`/data-transfer/${entity}/import`, form)
      setResult(res.data)
      if (res.data.skipped === 0) {
        toast.success(`Imported ${res.data.created + res.data.updated} of ${res.data.total} rows`)
      }
      await qc.invalidateQueries({ queryKey: [invalidateKey] })
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg ?? 'Import failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 8 }}>
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => run('export')}>
          <Download size={13} />{busy === 'export' ? 'Exporting…' : 'Export'}
        </button>
        {!exportOnly && (
          <>
            <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => fileRef.current?.click()}>
              <Upload size={13} />{busy === 'import' ? 'Importing…' : 'Import'}
            </button>
            <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => run('template')}
              title="Download a blank sheet with the expected columns">
              <FileSpreadsheet size={13} />Template
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={onFile} style={{ display: 'none' }} />
          </>
        )}
      </div>

      {result && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,26,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 'min(560px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F1F6' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Import summary — {label}</div>
              <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8FA8' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 20px' }}>
              {[
                { label: 'Created', value: result.created, color: '#2BC155' },
                { label: 'Updated', value: result.updated, color: '#5D78FF' },
                { label: 'Skipped', value: result.skipped, color: result.skipped ? '#EF4444' : '#8A8FA8' },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, border: '1px solid #F0F1F6', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#8A8FA8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div style={{ overflowY: 'auto', padding: '0 20px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '4px 0 8px' }}>
                  Rows that were not imported
                </div>
                {result.errors.map((e) => (
                  <div key={e.row} style={{ display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 6, background: '#FEF2F2', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', minWidth: 52 }}>Row {e.row}</span>
                    <span style={{ fontSize: 12, color: '#7F1D1D' }}>{e.error}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F1F6', textAlign: 'right' }}>
              <button onClick={() => setResult(null)} style={{ ...btn, background: '#5D78FF', color: '#fff', border: 'none' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
