import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
interface Toast { id: number; message: string; type: ToastType }
interface ToastCtx { show: (message: string, type?: ToastType) => void }

const Ctx = createContext<ToastCtx>({ show: () => {} })

const COLORS: Record<ToastType, { bg: string; color: string; border: string }> = {
  success: { bg: '#E7FAF0', color: '#065F46', border: '#2BC155' },
  error:   { bg: '#FEF2F2', color: '#B91C1C', border: '#EF4444' },
  warning: { bg: '#FFFBEB', color: '#92400E', border: '#F59E0B' },
  info:    { bg: '#EFF6FF', color: '#1E40AF', border: '#3B82F6' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

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
              borderRadius: 10, padding: '10px 16px',
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxWidth: 340, pointerEvents: 'auto',
              animation: 'slideIn 0.2s ease',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </Ctx.Provider>
  )
}

export function useToast() { return useContext(Ctx) }

// Singleton for use outside React (QueryClient callbacks)
let _show: ToastCtx['show'] = () => {}
export function setGlobalToast(fn: ToastCtx['show']) { _show = fn }
export const toast = {
  success: (m: string) => _show(m, 'success'),
  error:   (m: string) => _show(m, 'error'),
  info:    (m: string) => _show(m, 'info'),
  warning: (m: string) => _show(m, 'warning'),
}
