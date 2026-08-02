import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Reset link is invalid or has expired')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Invalid link</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>This password reset link is missing its token.</p>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#5D78FF', fontWeight: 600, textDecoration: 'none' }}>
            Request a new link
          </Link>
        </div>
      </div>
    )
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

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Password reset</h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Your password has been changed. Redirecting to sign in…
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Set new password</h2>
              <p style={{ fontSize: 13, color: '#64748b' }}>Choose a new password for your account</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%', padding: '11px 42px 11px 14px',
                      border: '1.5px solid #e2e8f0', borderRadius: 10,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      color: '#1e293b', background: '#fff',
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

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '11px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: 10,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    color: '#1e293b', background: '#fff',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#5D78FF' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                  placeholder="••••••••"
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
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
