import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/authStore'
import { Eye, EyeOff } from 'lucide-react'

export default function ChangePasswordPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('crm_token')) navigate('/login', { replace: true })
  }, [navigate])

  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const clearMustChangePassword = useAuthStore(s => s.clearMustChangePassword)
  const setToken = useAuthStore(s => s.setToken)
  const logout = useAuthStore(s => s.logout)

  async function handleSendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/send-otp')
      setStep('verify')
    } catch {
      setError('Could not send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
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
      const { data } = await api.post('/auth/verify-otp-change-password', { otp, newPassword: password })
      setToken(data.token)
      clearMustChangePassword()
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/skip-password-change')
      // Clear the flag in BOTH the store and localStorage (via clearMustChangePassword),
      // otherwise ProtectedRoute.hydrate() re-reads the stale localStorage value on the
      // next render/reload and bounces the user straight back to this gate.
      clearMustChangePassword()
      navigate('/', { replace: true })
    } catch {
      setError('Could not skip password change. Please try again.')
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

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
            {step === 'request' ? 'Update your password' : 'Enter verification code'}
          </h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            {step === 'request'
              ? "You're using a default or temporary password. For security, set a new one before continuing."
              : `We sent a 6-digit code to your email. It expires in 10 minutes.`}
          </p>
        </div>

        {step === 'request' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#dc2626', textAlign: 'center' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              style={{
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #5D78FF)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 13, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(93,120,255,0.35)',
              }}
            >
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
            <button
              onClick={handleSkip}
              type="button"
              disabled={loading}
              style={{ background: 'none', border: 'none', color: loading ? '#cbd5e1' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', padding: 8 }}
            >
              {loading ? 'Please wait…' : 'Skip for now'}
            </button>
            <button
              onClick={logout}
              type="button"
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 11, cursor: 'pointer', padding: 4 }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Verification code
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                style={{
                  width: '100%', padding: '11px 14px', letterSpacing: 4, textAlign: 'center',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 18, outline: 'none', boxSizing: 'border-box',
                  color: '#1e293b', background: '#fff', fontWeight: 700,
                }}
                onFocus={e => { e.target.style.borderColor = '#5D78FF' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                placeholder="000000"
              />
            </div>

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
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2 }}
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
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#dc2626', textAlign: 'center' }}>
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
              }}
            >
              {loading ? 'Updating…' : 'Change password'}
            </button>

            <button
              onClick={handleSendOtp}
              type="button"
              disabled={loading}
              style={{ background: 'none', border: 'none', color: '#5D78FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4 }}
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
