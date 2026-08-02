import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'

/** Log out after this much inactivity. */
const IDLE_MS = 30 * 60 * 1000
/** Warn this long before the logout actually fires. */
const WARN_MS = 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/**
 * Idle session guard. A CRM left open on a shared machine should not stay
 * authenticated indefinitely — after IDLE_MS without interaction the user is
 * warned, then signed out.
 *
 * Timers live in refs so ordinary activity never triggers a re-render; only
 * entering/leaving the warning state does.
 */
export default function IdleTimeout() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const logout = useAuthStore(s => s.logout)

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (tick.current) clearInterval(tick.current)
    warnTimer.current = logoutTimer.current = tick.current = null
  }, [])

  const signOut = useCallback(() => {
    clearAll()
    setSecondsLeft(null)
    logout()
    navigate('/login', { replace: true })
  }, [clearAll, logout, navigate])

  const reset = useCallback(() => {
    clearAll()
    setSecondsLeft(null)
    if (!token) return

    warnTimer.current = setTimeout(() => {
      setSecondsLeft(Math.floor(WARN_MS / 1000))
      tick.current = setInterval(() => {
        setSecondsLeft(s => (s === null ? null : Math.max(0, s - 1)))
      }, 1000)
      logoutTimer.current = setTimeout(signOut, WARN_MS)
    }, IDLE_MS - WARN_MS)
  }, [clearAll, signOut, token])

  useEffect(() => {
    if (!token) { clearAll(); setSecondsLeft(null); return }

    reset()
    // While the warning is up, activity must not silently extend the session —
    // the user has to acknowledge it, so the listeners are detached.
    const onActivity = () => { if (secondsLeft === null) reset() }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity))
      clearAll()
    }
    // `secondsLeft === null` flips the listener behaviour, so it belongs here.
  }, [token, secondsLeft === null, reset, clearAll])

  if (!token || secondsLeft === null) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <AlertTriangle size={18} style={{ color: '#FF9B52' }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', margin: 0 }}>Still there?</p>
        </div>
        <p style={{ fontSize: 12, color: '#8A8FA8', marginBottom: 16 }}>
          You've been inactive for a while. For security you'll be signed out in{' '}
          <span style={{ fontWeight: 700, color: '#FF5353' }}>{secondsLeft}s</span>.
        </p>
        <div style={{ height: 4, background: '#F4F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{
            height: '100%', background: '#FF9B52', borderRadius: 4,
            width: `${(secondsLeft / (WARN_MS / 1000)) * 100}%`,
            transition: 'width 1s linear',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={signOut}
            style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}
          >
            Sign out now
          </button>
          <button
            onClick={reset}
            style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
}
