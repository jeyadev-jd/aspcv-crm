import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useDesignations, useCreateDesignation } from '@/hooks/useDesignations'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export default function DesignationInput({ value, onChange, placeholder = 'Select or type designation', style }: Props) {
  const { data: designations = [] } = useDesignations()
  const createDesignation = useCreateDesignation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = designations.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
  const exactMatch = designations.some(d => d.name.toLowerCase() === query.toLowerCase())

  function select(name: string) {
    onChange(name); setQuery(name); setOpen(false)
  }

  async function addNew() {
    if (!query.trim()) return
    await createDesignation.mutateAsync(query.trim())
    select(query.trim())
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #F0F1F5', fontSize: 12, color: '#374557',
    outline: 'none', background: '#fff', boxSizing: 'border-box',
    ...style,
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={inp}
      />
      {open && (filtered.length > 0 || (!exactMatch && query.trim())) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
        }}>
          {filtered.map(d => (
            <div key={d.id} onMouseDown={() => select(d.name)}
              style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: '#374557' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {d.name}
            </div>
          ))}
          {!exactMatch && query.trim() && (
            <div onMouseDown={addNew}
              style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: '#5D78FF', display: 'flex', alignItems: 'center', gap: 6, borderTop: filtered.length ? '1px solid #F4F5F9' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Plus size={12} /> Add "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
