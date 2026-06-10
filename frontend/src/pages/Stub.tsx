import { Construction } from 'lucide-react'

interface StubProps { title: string }

export default function Stub({ title }: StubProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #F0F1F5',
      padding: 48, textAlign: 'center', width: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <Construction size={32} style={{ color: '#B1B1BE' }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#374557' }}>{title}</p>
      <p style={{ fontSize: 13, color: '#B1B1BE', marginTop: 6 }}>Coming soon</p>
    </div>
  )
}
