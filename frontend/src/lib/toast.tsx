import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  /** Milliseconds the toast stays up; drives the countdown bar when actionable. */
  duration: number
}

interface ShowOptions {
  action?: ToastAction
  duration?: number
}

interface ToastCtx {
  show: (message: string, type?: ToastType, opts?: ShowOptions) => void
}

const Ctx = createContext<ToastCtx>({ show: () => {} })

// Actionable toasts stay longer than passive ones — a user cannot read a
// message and decide to undo inside the old 4s window.
const PASSIVE_MS = 3000
const ACTION_MS = 6000

const COLORS: Record<ToastType, { bg: string; color: string; border: string }> = {
  success: { bg: '#E7FAF0', color: '#065F46', border: '#2BC155' },
  error:   { bg: '#FEF2F2', color: '#B91C1C', border: '#EF4444' },
  warning: { bg: '#FFFBEB', color: '#92400E', border: '#F59E0B' },
  info:    { bg: '#EFF6FF', color: '#1E40AF', border: '#3B82F6' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const show = useCallback((message: string, type: ToastType = 'info', opts?: ShowOptions) => {
    const id = ++counter.current
    const duration = opts?.duration ?? (opts?.action ? ACTION_MS : PASSIVE_MS)
    setToasts(t => [...t, { id, message, type, action: opts?.action, duration }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div key={t.id} style={{
              background: c.bg, color: c.color,
              border: `1px solid ${c.border}`,
              borderLeft: `4px solid ${c.border}`,
              borderRadius: 10,
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxWidth: 360, pointerEvents: 'auto',
              animation: 'slideIn 0.2s ease',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                <span style={{ flex: 1 }}>{t.message}</span>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                    style={{
                      flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
                      color: c.color, fontSize: 12, fontWeight: 700, textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              {t.action && (
                // Visual countdown so the undo window is obvious.
                <div style={{ height: 3, background: 'rgba(0,0,0,0.06)' }}>
                  <div style={{
                    height: '100%', background: c.border, width: '100%',
                    animation: `toastDrain ${t.duration}ms linear forwards`,
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes toastDrain { from { width:100% } to { width:0% } }
      `}</style>
    </Ctx.Provider>
  )
}

export function useToast() { return useContext(Ctx) }

// Singleton for use outside React (QueryClient callbacks)
let _show: ToastCtx['show'] = () => {}
export function setGlobalToast(fn: ToastCtx['show']) { _show = fn }
export const toast = {
  success: (m: string, opts?: ShowOptions) => _show(m, 'success', opts),
  error:   (m: string, opts?: ShowOptions) => _show(m, 'error', opts),
  info:    (m: string, opts?: ShowOptions) => _show(m, 'info', opts),
  warning: (m: string, opts?: ShowOptions) => _show(m, 'warning', opts),
}
