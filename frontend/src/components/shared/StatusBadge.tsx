export interface StatusStyle {
  bg: string
  color: string
  label?: string
}

interface Props {
  value: string
  map: Record<string, StatusStyle>
  fallback?: StatusStyle
  size?: 'sm' | 'md'
}

const DEFAULT_FALLBACK: StatusStyle = { bg: '#F4F5F9', color: '#8C8C8C' }

// Safe-by-construction status pill: unmapped values fall back instead of crashing
// (this exact crash class — statusStyle[unmappedEnum] — broke Projects.tsx earlier).
export default function StatusBadge({ value, map, fallback = DEFAULT_FALLBACK, size = 'md' }: Props) {
  const style = map[value] ?? fallback
  const padding = size === 'sm' ? '1px 8px' : '3px 10px'
  const fontSize = size === 'sm' ? 10 : 11
  return (
    <span style={{ fontSize, fontWeight: 600, padding, borderRadius: 20, background: style.bg, color: style.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {style.label ?? value}
    </span>
  )
}
