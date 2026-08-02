import { Link, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  const { pathname } = useLocation()
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#1a3a72,#5D78FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Compass size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>404</h1>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginTop: 12 }}>Page not found</p>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
          No page exists at <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 6 }}>{pathname}</code>.
          The link may be outdated or the module was renamed.
        </p>
        <Link
          to="/"
          style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg, #3b82f6, #5D78FF)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(93,120,255,0.35)' }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
