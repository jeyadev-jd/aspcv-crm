import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Shown in the fallback so the user knows which area failed. */
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Keeps a crash inside one page from taking down the whole shell. Without
 * this, a null-pointer on a malformed API response blanks the sidebar and
 * topbar too, leaving no way to navigate away.
 *
 * Must be a class — React has no hook equivalent for componentDidCatch.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'page', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <AlertTriangle size={22} style={{ color: '#FF5353' }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', margin: 0 }}>
          Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}
        </p>
        <p style={{ fontSize: 12, color: '#8A8FA8', margin: '6px 0 0', maxWidth: 420 }}>
          This section failed to render. The rest of the app still works — you can navigate away or try again.
        </p>
        <p style={{ fontSize: 11, color: '#B1B1BE', margin: '10px 0 0', fontFamily: 'monospace', maxWidth: 520, wordBreak: 'break-word' }}>
          {error.message}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
