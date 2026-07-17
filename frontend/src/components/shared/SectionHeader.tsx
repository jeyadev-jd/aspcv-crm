import type React from 'react'

interface Props {
  icon?: React.ElementType
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

// Consistent page-title row: icon + title + subtitle + right-aligned primary actions.
// Replaces the ad-hoc h1 blocks that varied per page.
export default function SectionHeader({ icon: Icon, title, subtitle, actions }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {Icon && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#5D78FF14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={17} style={{ color: '#5D78FF' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', margin: 0, lineHeight: 1.3 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 12, color: '#8C93A6', margin: 0 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
