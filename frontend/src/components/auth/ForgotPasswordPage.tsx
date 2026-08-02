import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <img src="/aspcv-logo1.png" alt="ASPCV" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 10 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>ASPCV CRM</p>
            <p style={{ fontSize: 10, color: '#64748b' }}>Aspiration Cleantech Ventures Pvt. Ltd.</p>
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Check your inbox</h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. The link expires in 1 hour.
            </p>
            <Link to="/login" style={{ fontSize: 13, color: '#5D78FF', fontWeight: 600, textDecoration: 'none' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Forgot password?</h2>
              <p style={{ fontSize: 13, color: '#64748b' }}>Enter your email and we'll send you a reset link</p>
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
                  }}
                  onFocus={e => { e.target.style.borderColor = '#5D78FF' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                  placeholder="you@aspcv.com"
                />
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
                  marginTop: 4,
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 12, color: '#94a3b8', marginTop: 24, textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
