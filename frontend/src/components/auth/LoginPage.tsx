import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/authStore'
import { useIsMobile } from '@/lib/useIsMobile'
import { Zap, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', background: '#fff', overflow: 'hidden' }}>
      {/* Left brand panel — hidden on mobile */}
      {!isMobile && (
        <div style={{
          width: '42%', minWidth: 360, maxWidth: 500, flexShrink: 0,
          background: 'linear-gradient(160deg, #0f2044 0%, #1a3a72 45%, #2d5bbf 100%)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 44px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(93,120,255,0.18)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(93,120,255,0.12)' }} />
          <div style={{ position: 'absolute', bottom: 160, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            <img src="/aspcv-logo.png" alt="ASPCV" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>ASPCV</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Aspiration Cleantech Pvt. Ltd.</p>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 16 }}>
              Clean Energy.<br />Smart Business.
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 280 }}>
              Manage your full customer lifecycle — from first enquiry to AMC — in one place.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36 }}>
              {[
                { icon: '⚡', label: 'Heat Pumps & Chillers' },
                { icon: '🔆', label: 'ORC & Waste Heat Recovery' },
                { icon: '💡', label: 'LED Lights & BLDC Fans' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 1 }}>
            © 2026 Aspiration Cleantech Pvt. Ltd.
          </p>
        </div>
      )}

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 24 : 48, background: '#fff', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile logo */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1a3a72,#5D78FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={18} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>ASPCV CRM</p>
                <p style={{ fontSize: 10, color: '#64748b' }}>Aspiration Cleantech</p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: '#64748b' }}>Sign in to your CRM account</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  color: '#1e293b', background: '#fff',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#5D78FF' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                placeholder="you@aspcv.com"
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '11px 42px 11px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: 10,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    color: '#1e293b', background: '#fff',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#5D78FF' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 12, color: '#dc2626', textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #5D78FF)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 13, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(93,120,255,0.35)',
                transition: 'all 0.15s',
                marginTop: 4,
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 28 }}>
            Contact your admin to reset your password
          </p>
        </div>
      </div>
    </div>
  )
}
