import { useState, useRef } from 'react'
import { Paperclip, Upload, X, FileText, Image, Link as LinkIcon } from 'lucide-react'
import { api } from '@/lib/api'

interface Attachment {
  id: string
  fileName: string
  mimeType?: string | null
  sizeBytes?: number
  externalUrl?: string | null
  url: string
}

interface Props {
  entityType?: string
  entityId?: string
  discussionId?: string
  onUploaded?: (attachment: Attachment) => void
}

export default function AttachmentUploader({ entityType, entityId, discussionId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploads, setUploads] = useState<Attachment[]>([])
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (entityType) form.append('entityType', entityType)
      if (entityId) form.append('entityId', entityId)
      if (discussionId) form.append('discussionId', discussionId)
      const { data } = await api.post('/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploads(prev => [...prev, data])
      onUploaded?.(data)
    } finally {
      setUploading(false)
    }
  }

  async function attachLink() {
    if (!linkUrl.trim() || !/^https?:\/\//i.test(linkUrl.trim())) return
    setUploading(true)
    try {
      const { data } = await api.post('/attachments/link', {
        url: linkUrl.trim(),
        fileName: linkName.trim() || undefined,
        entityType, entityId, discussionId,
      })
      setUploads(prev => [...prev, data])
      onUploaded?.(data)
      setLinkUrl(''); setLinkName('')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    Array.from(e.dataTransfer.files).forEach(uploadFile)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) Array.from(e.target.files).forEach(uploadFile)
  }

  function fmt(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setMode('file')} style={{ flex: 1, padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #E8E9F0', cursor: 'pointer', background: mode === 'file' ? '#5D78FF' : '#fff', color: mode === 'file' ? '#fff' : '#374557' }}>
          <Upload size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} /> Upload File
        </button>
        <button onClick={() => setMode('link')} style={{ flex: 1, padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #E8E9F0', cursor: 'pointer', background: mode === 'link' ? '#5D78FF' : '#fff', color: mode === 'link' ? '#fff' : '#374557' }}>
          <LinkIcon size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} /> Paste Link
        </button>
      </div>

      {mode === 'file' ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#3b82f6' : '#d1d5db'}`,
            borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? '#eff6ff' : '#fafafa', transition: 'all 0.15s'
          }}
        >
          <Upload size={20} style={{ color: '#94a3b8', margin: '0 auto 6px' }} />
          <div style={{ fontSize: 13, color: '#64748b' }}>{uploading ? 'Uploading…' : 'Drop files or click to upload'}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Max 50 MB per file</div>
          <input ref={inputRef} type="file" multiple hidden onChange={onFileChange} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://onedrive.live.com/... or any shareable link"
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              placeholder="Label (optional)"
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={attachLink}
              disabled={uploading || !linkUrl.trim()}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: !linkUrl.trim() ? '#D1D5DB' : '#5D78FF', color: '#fff', cursor: !linkUrl.trim() ? 'not-allowed' : 'pointer' }}
            >
              {uploading ? 'Adding…' : 'Add Link'}
            </button>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {uploads.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              {a.externalUrl ? <LinkIcon size={14} color="#5D78FF" /> : a.mimeType?.startsWith('image/') ? <Image size={14} color="#3b82f6" /> : <FileText size={14} color="#64748b" />}
              <a href={a.externalUrl ?? `http://localhost:4000${a.url}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#374151', flex: 1, textDecoration: 'none' }}>{a.fileName}</a>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmt(a.sizeBytes)}</span>
              <button onClick={() => setUploads(prev => prev.filter(u => u.id !== a.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={12} color="#94a3b8" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
