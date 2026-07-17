import type React from 'react'

interface Props {
  label: string
  value: React.ReactNode
  icon?: React.ElementType
  accent?: string
  trend?: { value: string; direction: 'up' | 'down' | 'flat'; label?: string }
  onClick?: () => void
  active?: boolean
}

const TREND_COLOR = { up: '#2BC155', down: '#FF5353', flat: '#B1B1BE' }

// Compact enterprise KPI tile — icon + label + big number + optional trend.
// Used in the per-module KPI strip (Fiori/Dynamics-style summary row).
export default function KpiCard({ label, value, icon: Icon, accent = '#5D78FF', trend, onClick, active }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${accent}0D` : '#fff',
        borderRadius: 12,
        border: active ? `1px solid ${accent}55` : '1px solid #F0F1F5',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.12s, background 0.12s',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8C93A6', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {Icon && (
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={13} style={{ color: accent }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', lineHeight: 1 }}>{value}</span>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 600, color: TREND_COLOR[trend.direction] }}>
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {trend.value}
          </span>
        )}
      </div>
      {trend?.label && <span style={{ fontSize: 10, color: '#B1B1BE' }}>{trend.label}</span>}
    </div>
  )
}
