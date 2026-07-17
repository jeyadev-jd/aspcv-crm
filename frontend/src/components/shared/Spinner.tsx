import { Loader2 } from 'lucide-react'

interface Props {
  size?: number
  fullPage?: boolean
  label?: string
}

export default function Spinner({ size = 24, fullPage = true, label }: Props) {
  const icon = <Loader2 size={size} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
  if (!fullPage) return icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 'calc(100vh - 120px)' }}>
      {icon}
      {label && <p style={{ fontSize: 12, color: '#B1B1BE' }}>{label}</p>}
    </div>
  )
}
