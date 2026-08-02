import { useMemo, useState } from 'react'
import type React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

/**
 * Shared slice-and-dice filter bar.
 *
 * A page declares which dimensions it can filter on; this component owns the
 * chrome (search box, selects, numeric/date ranges, active count, clear) and
 * `applyFilters` does the matching. Pages keep the filter *values* in their own
 * state so the rest of the page (KPI strips, exports) can read them too.
 */

export interface SelectFilter {
  kind: 'select'
  key: string
  label: string
  options: { value: string; label: string }[]
  /** Extra "— none —" style option for rows where the field is empty. */
  emptyOption?: { value: string; label: string }
}

export interface RangeFilter {
  kind: 'range'
  key: string
  label: string
  /** 'number' renders two numeric inputs, 'date' renders two date inputs. */
  type: 'number' | 'date'
  placeholderMin?: string
  placeholderMax?: string
}

export interface ToggleFilter {
  kind: 'toggle'
  key: string
  label: string
  icon?: React.FC<{ size?: number; style?: React.CSSProperties }>
}

export type FilterDef = SelectFilter | RangeFilter | ToggleFilter

/** All filter state for a page, keyed by `FilterDef.key`. */
export interface FilterValues {
  search: string
  select: Record<string, string>
  /** `[min, max]` as raw input strings; '' means unbounded on that side. */
  range: Record<string, [string, string]>
  toggle: Record<string, boolean>
}

export const emptyFilters: FilterValues = { search: '', select: {}, range: {}, toggle: {} }

export function countActive(values: FilterValues): number {
  let n = values.search.trim() ? 1 : 0
  for (const v of Object.values(values.select)) if (v && v !== 'All') n++
  for (const [min, max] of Object.values(values.range)) if (min || max) n++
  for (const v of Object.values(values.toggle)) if (v) n++
  return n
}

/** How a page maps one row onto the filterable dimensions. */
export interface RowAccessors<T> {
  /** Free-text haystack for the search box. */
  search: (row: T) => (string | null | undefined)[]
  /**
   * Value for a `select` filter — return '' when the field is empty. An array
   * matches if any element equals the selection (deal owners, tags, …).
   */
  select: Record<string, (row: T) => string | string[]>
  /** Numeric value, or an ISO/date string for date ranges. Null skips the row. */
  range?: Record<string, (row: T) => number | string | null | undefined>
  /** True when the row satisfies the toggle. */
  toggle?: Record<string, (row: T) => boolean>
}

function rangeMatches(raw: number | string | null | undefined, min: string, max: string, type: 'number' | 'date'): boolean {
  if (!min && !max) return true
  if (raw == null || raw === '') return false
  if (type === 'date') {
    const t = new Date(raw).getTime()
    if (Number.isNaN(t)) return false
    // Date inputs are inclusive at both ends; the max day runs to its midnight.
    if (min && t < new Date(min).getTime()) return false
    if (max && t > new Date(max).getTime() + 86_399_999) return false
    return true
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isNaN(n)) return false
  if (min !== '' && n < Number(min)) return false
  if (max !== '' && n > Number(max)) return false
  return true
}

export function applyFilters<T>(rows: T[], values: FilterValues, accessors: RowAccessors<T>): T[] {
  const q = values.search.trim().toLowerCase()
  return rows.filter(row => {
    if (q) {
      const hay = accessors.search(row).filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    for (const [key, selected] of Object.entries(values.select)) {
      if (!selected || selected === 'All') continue
      const actual = accessors.select[key]?.(row)
      if (Array.isArray(actual) ? !actual.includes(selected) : actual !== selected) return false
    }
    for (const [key, [min, max]] of Object.entries(values.range)) {
      if (!min && !max) continue
      const def = accessors.range?.[key]
      if (!def) continue
      // The page's filter definition carries the type; default to number.
      const raw = def(row)
      const isDate = typeof raw === 'string' && Number.isNaN(Number(raw))
      if (!rangeMatches(raw, min, max, isDate ? 'date' : 'number')) return false
    }
    for (const [key, on] of Object.entries(values.toggle)) {
      if (!on) continue
      if (!accessors.toggle?.[key]?.(row)) return false
    }
    return true
  })
}

export default function FilterPanel({
  filters, values, onChange, searchPlaceholder, hideSearch, children,
}: {
  filters: FilterDef[]
  values: FilterValues
  onChange: (next: FilterValues) => void
  searchPlaceholder?: string
  /** Set when the page already renders its own search box (e.g. a Toolbar). */
  hideSearch?: boolean
  /** Page-specific actions rendered at the right edge (e.g. "New Deal"). */
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const active = useMemo(() => countActive(values), [values])

  const selects = filters.filter((f): f is SelectFilter => f.kind === 'select')
  const ranges = filters.filter((f): f is RangeFilter => f.kind === 'range')
  const toggles = filters.filter((f): f is ToggleFilter => f.kind === 'toggle')

  // Selects and toggles stay visible; ranges hide behind "More" so the bar does
  // not dominate the page when a table already has little vertical room.
  const hasAdvanced = ranges.length > 0

  function setSelect(key: string, value: string) {
    onChange({ ...values, select: { ...values.select, [key]: value } })
  }
  function setRange(key: string, idx: 0 | 1, value: string) {
    const current = values.range[key] ?? ['', '']
    const next: [string, string] = idx === 0 ? [value, current[1]] : [current[0], value]
    onChange({ ...values, range: { ...values.range, [key]: next } })
  }
  function toggle(key: string) {
    onChange({ ...values, toggle: { ...values.toggle, [key]: !values.toggle[key] } })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {!hideSearch && (
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B1B1BE' }} />
            <input
              value={values.search}
              onChange={e => onChange({ ...values, search: e.target.value })}
              placeholder={searchPlaceholder ?? 'Search…'}
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11, color: '#374557', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {selects.map(f => (
          <select key={f.key} value={values.select[f.key] ?? 'All'} onChange={e => setSelect(f.key, e.target.value)} style={selectStyle}>
            <option value="All">{f.label}: All</option>
            {f.emptyOption && <option value={f.emptyOption.value}>{f.emptyOption.label}</option>}
            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}

        {toggles.map(f => {
          const Icon = f.icon
          const on = !!values.toggle[f.key]
          return (
            <button key={f.key} onClick={() => toggle(f.key)}
              style={{ ...chip, background: on ? '#EEF2FF' : '#F4F5F9', color: on ? '#5D78FF' : '#8C8C8C', borderColor: on ? '#5D78FF' : 'transparent' }}>
              {Icon && <Icon size={12} />}{f.label}
            </button>
          )
        })}

        {hasAdvanced && (
          <button onClick={() => setExpanded(v => !v)} style={{ ...chip, background: expanded ? '#EEF2FF' : '#F4F5F9', color: expanded ? '#5D78FF' : '#8C8C8C' }}>
            <SlidersHorizontal size={12} />{expanded ? 'Less' : 'More'}
          </button>
        )}

        {active > 0 && (
          <button onClick={() => onChange(emptyFilters)} style={{ ...chip, background: '#fff', color: '#5D78FF', borderColor: '#E8EDFF' }}>
            <X size={12} />Clear ({active})
          </button>
        )}

        {children && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{children}</div>}
      </div>

      {expanded && hasAdvanced && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingTop: 10, borderTop: '1px solid #F4F5F9' }}>
          {ranges.map(f => {
            const [min, max] = values.range[f.key] ?? ['', '']
            return (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#B1B1BE', fontWeight: 600 }}>{f.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type={f.type} value={min} onChange={e => setRange(f.key, 0, e.target.value)}
                    placeholder={f.placeholderMin ?? 'Min'} style={rangeInput} />
                  <span style={{ fontSize: 10, color: '#C4C4CF' }}>to</span>
                  <input type={f.type} value={max} onChange={e => setRange(f.key, 1, e.target.value)}
                    placeholder={f.placeholderMax ?? 'Max'} style={rangeInput} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 11,
  color: '#374557', outline: 'none', background: '#fff', cursor: 'pointer', maxWidth: 190,
}
const chip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
  fontSize: 11, fontWeight: 600, border: '1px solid transparent', cursor: 'pointer',
}
const rangeInput: React.CSSProperties = {
  width: 110, padding: '6px 9px', borderRadius: 8, border: '1px solid #F0F1F5',
  fontSize: 11, color: '#374557', outline: 'none', boxSizing: 'border-box',
}
