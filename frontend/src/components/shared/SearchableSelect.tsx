import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

export interface SearchableSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
}

/**
 * Type-to-filter dropdown for a plain `<select>` replacement. Built for lists
 * long enough that scrolling a native <select> is slower than typing a few
 * letters (e.g. picking one project out of hundreds).
 */
export default function SearchableSelect({ value, onChange, options, placeholder = 'Search…', disabled, error }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => options.find(o => o.value === value) ?? null, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      // Focus after the input mounts so the dropdown opens with the caret ready.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setHighlight(0), [query])

  function commit(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) commit(filtered[highlight].value); return }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10,
          border: `1px solid ${error ? '#F04452' : '#E4E6EF'}`, background: disabled ? '#F4F5F9' : '#fff',
          fontSize: 13, color: selected ? '#374557' : '#9599A6', cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected && !disabled && (
            <X
              size={13}
              color="#B1B1BE"
              onClick={e => { e.stopPropagation(); commit('') }}
            />
          )}
          <ChevronDown size={14} color="#B1B1BE" />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 80,
            background: '#fff', border: '1px solid #E4E6EF', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(20,20,43,0.12)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #F0F1F5' }}>
            <Search size={14} color="#B1B1BE" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#374557' }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#B1B1BE' }}>No matches</div>
            )}
            {filtered.map((o, i) => (
              <div
                key={o.value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(o.value)}
                style={{
                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                  background: i === highlight ? '#F4F6FF' : '#fff',
                  color: o.value === value ? '#5D78FF' : '#374557',
                  fontWeight: o.value === value ? 600 : 400,
                }}
              >
                {o.label}
                {o.sublabel && <span style={{ marginLeft: 6, fontSize: 11, color: '#B1B1BE' }}>{o.sublabel}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
