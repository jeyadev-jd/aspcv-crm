import type React from 'react'

interface Props {
  icon: React.ElementType
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 48, textAlign: 'center' }}>
      <Icon size={28} style={{ color: '#D5D5D5', margin: '0 auto 10px' }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{title}</p>
      {subtitle && <p style={{ fontSize: 12, color: '#B1B1BE', marginTop: 4 }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
