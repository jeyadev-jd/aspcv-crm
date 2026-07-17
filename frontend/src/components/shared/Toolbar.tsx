import type React from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  children?: React.ReactNode // filter chips / dropdowns
  actions?: React.ReactNode // quick-action buttons, right-aligned
}

// Standard enterprise list-page toolbar: search box + filter row + right-aligned actions.
// One consistent bar shape across every module instead of bespoke per-page layouts.
export default function Toolbar({ search, onSearchChange, searchPlaceholder = 'Search…', children, actions }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {onSearchChange && (
          <div style={{ position: 'relative', minWidth: 200, flex: '0 1 260px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
            <input
              value={search ?? ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ width: '100%', paddingLeft: 30, paddingRight: search ? 28 : 10, height: 34, borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
            {search && (
              <button onClick={() => onSearchChange('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', display: 'flex' }}>
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
