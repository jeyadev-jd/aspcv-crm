interface Option {
  value: string
  label: string
  count?: number
}

interface Props {
  options: Option[]
  value: string
  onChange: (v: string) => void
  accent?: string
}

// Pill-style filter row (status/stage tabs). Shared so every module's
// "All / Status A / Status B" row looks and behaves identically.
export default function FilterChips({ options, value, onChange, accent = '#5D78FF' }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: active ? accent : '#F4F5F9',
              color: active ? '#fff' : '#6B7280',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.25)' : '#fff', color: active ? '#fff' : '#8C93A6',
              }}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
