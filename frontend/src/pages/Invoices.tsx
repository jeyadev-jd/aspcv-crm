import { useState } from 'react'
import { MoreHorizontal, X, Paperclip, ChevronLeft, ChevronRight, Plus, FileText } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

interface Invoice {
  id: string; number: string; date: string; customer: string
  status: 'Paid' | 'Unpaid' | 'Scheduled' | 'Processing'; amount: number
  avatarColor: string
}

const initInvoices: Invoice[] = [
  { id: '1', number: 'AA-04-19-1890', date: '18 May 2026', customer: 'Sophia Wagner',    status: 'Paid',       amount: 157805, avatarColor: '#5D78FF' },
  { id: '2', number: 'AA-04-19-1090', date: '07 Jul 2026', customer: 'Daniel Gonzales',  status: 'Scheduled',  amount: 182865, avatarColor: '#FF9B52' },
  { id: '3', number: 'AA-04-12-2830', date: '24 Jan 2026', customer: 'Jesus Hughes',     status: 'Unpaid',     amount: 204575, avatarColor: '#FF5353' },
  { id: '4', number: 'AA-04-15-2132', date: '12 Jul 2026', customer: 'Theresa Walters',  status: 'Paid',       amount: 158650, avatarColor: '#2BC155' },
  { id: '5', number: 'AA-04-19-1567', date: '26 Oct 2026', customer: 'Jeanette Hines',   status: 'Processing', amount: 296425, avatarColor: '#8B5CF6' },
  { id: '6', number: 'AA-04-19-1983', date: '22 Jul 2026', customer: 'Mason Arnold',     status: 'Paid',       amount: 139445, avatarColor: '#FF9B52' },
  { id: '7', number: 'AA-04-11-3550', date: '12 Mar 2026', customer: 'Nicholas Cross',   status: 'Paid',       amount: 400800, avatarColor: '#5D78FF' },
]

const statusStyle: Record<string, { bg: string; color: string }> = {
  Paid:       { bg: '#E7FAF0', color: '#2BC155' },
  Unpaid:     { bg: '#FFF3F3', color: '#FF5353' },
  Scheduled:  { bg: '#E8EDFF', color: '#5D78FF' },
  Processing: { bg: '#FFF5EE', color: '#FF9B52' },
}

const avatarColors = ['#5D78FF', '#FF9B52', '#FF5353', '#2BC155', '#8B5CF6']
const PAGE_SIZE = 5

const blankForm = {
  customer: '', date: '', amount: '', status: 'Unpaid' as Invoice['status'],
}

function fmtAmt(inr: number, symbol: string, currency: string): string {
  const v = currency === 'USD' ? inr / 83.5 : inr
  if (currency === 'INR') {
    if (v >= 100000) return `${symbol}${(v / 100000).toFixed(1)}L`
    if (v >= 1000)   return `${symbol}${(v / 1000).toFixed(1)}k`
  } else {
    if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}k`
  }
  return `${symbol}${Math.round(v).toLocaleString()}`
}

export default function Invoices() {
  const isMobile = useIsMobile()
  const { symbol, currency } = useCurrency()
  const [invoices, setInvoices] = useState(initInvoices)
  const [tab, setTab]         = useState<'All' | 'Draft' | 'Scheduled' | 'Paid'>('All')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [comment, setComment]   = useState('')
  const [page, setPage]         = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(blankForm)
  const [formErr, setFormErr]   = useState<Record<string, string>>({})

  const filtered   = tab === 'All' ? invoices : invoices.filter(i => i.status === tab)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function changeTab(t: typeof tab) { setTab(t); setPage(1) }
  function selectedIndex() { return filtered.findIndex(i => i.id === selected?.id) }
  function goModalPrev() { const idx = selectedIndex(); if (idx > 0) setSelected(filtered[idx - 1]) }
  function goModalNext() { const idx = selectedIndex(); if (idx < filtered.length - 1) setSelected(filtered[idx + 1]) }
  function sendComment() { if (!comment.trim()) return; setComment('') }

  function openAdd() { setForm(blankForm); setFormErr({}); setShowModal(true) }

  function submitAdd() {
    const e: Record<string, string> = {}
    if (!form.customer.trim()) e.customer = 'Customer name required'
    if (!form.date) e.date = 'Date required'
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Valid amount required'
    if (Object.keys(e).length) { setFormErr(e); return }

    const num = `AA-${Date.now().toString().slice(-8)}`
    const inrAmt = currency === 'USD' ? Math.round(Number(form.amount) * 83.5) : Math.round(Number(form.amount))
    setInvoices(prev => [...prev, {
      id: Date.now().toString(), number: num,
      date: form.date, customer: form.customer.trim(),
      status: form.status, amount: inrAmt,
      avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    }])
    setShowModal(false)
  }

  const inp = (err?: boolean): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${err ? '#FF5353' : '#F0F1F5'}`,
    fontSize: 12, outline: 'none', boxSizing: 'border-box', color: '#374557',
  })

  const totalInr   = invoices.reduce((s, i) => s + i.amount, 0)
  const scheduledInr = invoices.filter(i => i.status === 'Scheduled').reduce((s, i) => s + i.amount, 0)
  const unpaidInr  = invoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + i.amount, 0)
  const paidInr    = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)

  const sideStats = [
    { label: 'All Invoices', sub: 'Total value',    value: fmtAmt(totalInr, symbol, currency),     bar: '#5D78FF', pct: 65 },
    { label: 'Scheduled',    sub: 'Upcoming',        value: fmtAmt(scheduledInr, symbol, currency), bar: '#FF9B52', pct: 45 },
    { label: 'Unpaid',       sub: 'Outstanding',     value: fmtAmt(unpaidInr, symbol, currency),    bar: '#FF5353', pct: 30 },
    { label: 'Paid',         sub: 'Collected',       value: fmtAmt(paidInr, symbol, currency),      bar: '#2BC155', pct: 55 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: 'flex-start', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 200, flexShrink: 0 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Invoices breakdown</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Summary by status</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sideStats.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#374557' }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: '#B1B1BE' }}>{s.sub}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{s.value}</p>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#F4F5F9' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${s.pct}%`, background: s.bar }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #F0F1F5' }}>
            {(['All', 'Draft', 'Scheduled', 'Paid'] as const).map(t => (
              <button key={t} onClick={() => changeTab(t)} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #5D78FF' : '2px solid transparent',
                marginBottom: -2,
                color: tab === t ? '#5D78FF' : '#B1B1BE', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            <Plus size={13} /> New Invoice
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', minHeight: 'calc(100vh - 200px)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>
              No invoices — click "New Invoice" to create one
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map((inv) => (
                <div key={inv.id} onClick={() => setSelected(inv)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={14} style={{ color: '#5D78FF' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>#{inv.number}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{inv.customer}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg, color: statusStyle[inv.status]?.color }}>{inv.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Amount</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{fmtAmt(inv.amount, symbol, currency)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: '#B1B1BE' }}>Date</p>
                      <p style={{ fontSize: 11, color: '#374557' }}>{inv.date}</p>
                    </div>
                  </div>
                </div>
              ))}
              {paginated.length === 0 && <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 24 }}>No records found.</p>}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Number', 'Date', 'Customer', 'Status', `Amount (${currency})`, ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((inv, i) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelected(inv)}
                    style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={14} style={{ color: '#5D78FF' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#374557' }}>#{inv.number}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: '#374557' }}>{inv.date}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: inv.avatarColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#374557' }}>{inv.customer}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[inv.status]?.bg, color: statusStyle[inv.status]?.color }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                      {fmtAmt(inv.amount, symbol, currency)}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <button style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}>
                <ChevronLeft size={13} /> PREV
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setPage(pg)}
                    style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>
                NEXT <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: 740, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>Invoice #{selected.number}</p>
              <button onClick={() => setSelected(null)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} style={{ color: '#5D78FF' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>{selected.customer}</p>
                    <p style={{ fontSize: 11, color: '#B1B1BE' }}>{selected.date}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[selected.status]?.bg, color: statusStyle[selected.status]?.color }}>
                    {selected.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontSize: 12 }}>
                  <div>
                    <p style={{ fontWeight: 500, color: '#B1B1BE', marginBottom: 4 }}>From:</p>
                    <p style={{ fontWeight: 600, color: '#374557' }}>Aspiration Cleantech Ventures</p>
                    {['Leeds Business Park', 'Leeds, LS1 1BA', 'admin@aspcv.co.uk', '+44 113 000 1234'].map((l, i) => (
                      <p key={i} style={{ color: '#B1B1BE' }}>{l}</p>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, color: '#B1B1BE', marginBottom: 4 }}>Bill to:</p>
                    <p style={{ fontWeight: 600, color: '#374557' }}>{selected.customer}</p>
                  </div>
                </div>

                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Summary</p>
                <div style={{ border: '1px solid #F0F1F5', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374557', fontWeight: 700 }}>
                      <span>Total</span>
                      <span>{fmtAmt(selected.amount, symbol, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 16 }}>Activities</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { text: `Created invoice #${selected.number}`, date: selected.date },
                    { badge: true, date: selected.status === 'Paid' ? selected.date : '—' },
                  ].map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5D78FF', flexShrink: 0 }} />
                      <div>
                        {a.badge ? (
                          <>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: selected.status === 'Paid' ? '#E7FAF0' : '#F4F5F9', color: selected.status === 'Paid' ? '#2BC155' : '#8C8C8C' }}>
                              {selected.status === 'Paid' ? 'Invoice paid' : selected.status}
                            </span>
                            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 4 }}>{a.date}</p>
                          </>
                        ) : (
                          <>
                            <p style={{ fontSize: 12, color: '#374557' }}>{(a as { text: string }).text}</p>
                            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{a.date}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '8px 12px', border: '1px solid #F0F1F5' }}>
                  <input
                    value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendComment()}
                    placeholder="Add a comment..."
                    style={{ flex: 1, fontSize: 12, color: '#374557', background: 'transparent', border: 'none', outline: 'none' }}
                  />
                  <button style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><Paperclip size={14} /></button>
                  <button onClick={sendComment} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid #F0F1F5' }}>
              <button onClick={goModalPrev} disabled={selectedIndex() <= 0}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: selectedIndex() <= 0 ? '#D5D5D5' : '#374557', background: 'none', border: 'none', cursor: selectedIndex() <= 0 ? 'default' : 'pointer' }}>
                <ChevronLeft size={14} /> PREV
              </button>
              <span style={{ fontSize: 11, color: '#B1B1BE' }}>{selectedIndex() + 1} / {filtered.length}</span>
              <button onClick={goModalNext} disabled={selectedIndex() >= filtered.length - 1}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: selectedIndex() >= filtered.length - 1 ? '#D5D5D5' : '#374557', background: 'none', border: 'none', cursor: selectedIndex() >= filtered.length - 1 ? 'default' : 'pointer' }}>
                NEXT <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>New Invoice</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Customer Name *</p>
                <input autoFocus value={form.customer} onChange={e => { setForm(f => ({ ...f, customer: e.target.value })); setFormErr(p => ({ ...p, customer: '' })) }}
                  placeholder="Customer or company name..."
                  style={inp(!!formErr.customer)} />
                {formErr.customer && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 4 }}>{formErr.customer}</p>}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Invoice Date *</p>
                <input type="date" value={form.date} onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormErr(p => ({ ...p, date: '' })) }}
                  style={inp(!!formErr.date)} />
                {formErr.date && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 4 }}>{formErr.date}</p>}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Amount ({currency} — {symbol}) *</p>
                <input type="number" min="0" value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormErr(p => ({ ...p, amount: '' })) }}
                  placeholder={currency === 'INR' ? 'e.g. 150000' : 'e.g. 1800'}
                  style={inp(!!formErr.amount)} />
                {formErr.amount && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 4 }}>{formErr.amount}</p>}
                {form.amount && !isNaN(Number(form.amount)) && (
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginTop: 4 }}>
                    {currency === 'INR'
                      ? `= $${(Number(form.amount) / 83.5).toFixed(0)} USD`
                      : `= ₹${(Number(form.amount) * 83.5).toFixed(0)} INR`}
                  </p>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Status</p>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Invoice['status'] }))}
                  style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Processing">Processing</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F4F5F9', color: '#374557', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitAdd} style={{ padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
