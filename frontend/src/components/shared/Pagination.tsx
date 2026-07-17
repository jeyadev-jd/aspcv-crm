import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}
      >
        <ChevronLeft size={13} /> Prev
      </button>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
          <button
            key={pg}
            onClick={() => onChange(pg)}
            style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}
          >
            {pg}
          </button>
        ))}
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
