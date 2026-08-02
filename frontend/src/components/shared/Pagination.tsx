import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

// Windows the page list around the current page (with edge anchors + ellipsis)
// so a large totalPages never overflows the bar the way a flat 1..N list would.
function pageWindow(page: number, totalPages: number): (number | 'ellipsis')[] {
  const SIBLINGS = 1
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const left = Math.max(2, page - SIBLINGS)
  const right = Math.min(totalPages - 1, page + SIBLINGS)
  const pages: (number | 'ellipsis')[] = [1]
  if (left > 2) pages.push('ellipsis')
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < totalPages - 1) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9', flexWrap: 'wrap', gap: 8 }}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}
      >
        <ChevronLeft size={13} /> Prev
      </button>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {pageWindow(page, totalPages).map((pg, i) =>
          pg === 'ellipsis' ? (
            <span key={`e${i}`} style={{ width: 20, textAlign: 'center', fontSize: 12, color: '#D5D5D5' }}>…</span>
          ) : (
            <button
              key={pg}
              onClick={() => onChange(pg)}
              style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}
            >
              {pg}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}
      >
        Next <ChevronRight size={13} />
      </button>
    </div>
  )
}
