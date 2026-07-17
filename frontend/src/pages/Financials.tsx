import { useState } from 'react'
import { useFinancials, useFinancialSummary, useCreateFinancialEntry, useDeleteFinancialEntry } from '../hooks/useFinancials'
import { useExpenses, useExpenseSummary, useCreateExpense, useDeleteExpense } from '../hooks/useExpenses'
import { useAuthStore } from '../lib/authStore'
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

const EXPENSE_CATEGORIES = ['travel', 'utilities', 'salary', 'materials', 'other']
const EXPENSE_COLORS: Record<string, string> = { travel: '#3B82F6', utilities: '#F59E0B', salary: '#8B5CF6', materials: '#EF4444', other: '#6B7280' }

export default function Financials() {
  const user = useAuthStore(s => s.user)
  const canEdit = user && ['SuperAdmin', 'BusinessHead', 'Accountant'].includes(user.role)

  const [tab, setTab] = useState<'overview' | 'assets' | 'liabilities' | 'expenses'>('overview')
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)

  const [entryForm, setEntryForm] = useState({ type: 'asset', name: '', amount: '', category: '', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'other', date: new Date().toISOString().slice(0, 10), notes: '' })

  const { data: summary } = useFinancialSummary()
  const { data: assets = [] } = useFinancials('asset')
  const { data: liabilities = [] } = useFinancials('liability')
  const { data: expenses = [] } = useExpenses()
  const { data: expenseSummary = [] } = useExpenseSummary(6)

  const createEntry = useCreateFinancialEntry()
  const deleteEntry = useDeleteFinancialEntry()
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()

  // Expense bar chart data — group by month+category
  const monthlyExpenses: Record<string, Record<string, number>> = {}
  expenseSummary.forEach(e => {
    const month = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (!monthlyExpenses[month]) monthlyExpenses[month] = {}
    monthlyExpenses[month][e.category] = (monthlyExpenses[month][e.category] ?? 0) + e.amount
  })
  const monthKeys = Object.keys(monthlyExpenses)
  const maxMonth = Math.max(1, ...monthKeys.map(m => Object.values(monthlyExpenses[m]).reduce((a, b) => a + b, 0)))

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' as const }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1D23', margin: '0 0 24px' }}>Assets, Liabilities & Expenses</h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Assets', value: summary?.totalAssets ?? 0, color: '#2BC155', icon: TrendingUp },
          { label: 'Total Liabilities', value: summary?.totalLiabilities ?? 0, color: '#EF4444', icon: TrendingDown },
          { label: 'Net Worth', value: summary?.netWorth ?? 0, color: (summary?.netWorth ?? 0) >= 0 ? '#5D78FF' : '#EF4444', icon: DollarSign },
          { label: 'Monthly Expenses', value: expenses.filter(e => new Date(e.date).getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0), color: '#F59E0B', icon: BarChart2 },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{fmt(s.value)}</div>
                  <div style={{ fontSize: 12, color: '#8A8FA8', marginTop: 3 }}>{s.label}</div>
                </div>
                <Icon size={18} color={s.color} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Expense bar chart */}
      {monthKeys.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Monthly Expenses (last 6 months)</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 120, overflowX: 'auto', minWidth: 0 }}>
            {monthKeys.slice(-6).map(m => {
              const total = Object.values(monthlyExpenses[m]).reduce((a, b) => a + b, 0)
              const pct = (total / maxMonth) * 100
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: '#8A8FA8', fontWeight: 600 }}>{fmt(total)}</div>
                  <div style={{ width: '100%', height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    {EXPENSE_CATEGORIES.filter(cat => monthlyExpenses[m][cat]).map(cat => (
                      <div key={cat} title={`${cat}: ${fmt(monthlyExpenses[m][cat])}`} style={{ width: '100%', height: `${(monthlyExpenses[m][cat] / total) * pct}%`, background: EXPENSE_COLORS[cat], minHeight: 3 }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#8A8FA8' }}>{m}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {EXPENSE_CATEGORIES.map(cat => (
              <div key={cat} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: '#6B7280' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: EXPENSE_COLORS[cat] }} />
                {cat}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 10, padding: 3, width: 'fit-content', minWidth: '100%' }}>
        {(['overview', 'assets', 'liabilities', 'expenses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1A1D23' : '#6B7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>
      </div>

      {/* Overview tab — combined snapshot */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            { title: 'Top Assets', rows: assets.slice(0, 5), color: '#2BC155', empty: 'No assets yet — add from Assets tab', goto: 'assets' as const },
            { title: 'Top Liabilities', rows: liabilities.slice(0, 5), color: '#EF4444', empty: 'No liabilities recorded', goto: 'liabilities' as const },
          ].map(block => (
            <div key={block.title} style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{block.title}</div>
                <button onClick={() => setTab(block.goto)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
              </div>
              {block.rows.length === 0 ? (
                <div style={{ fontSize: 12, color: '#8A8FA8' }}>{block.empty}</div>
              ) : block.rows.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F8F9FF' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                    {e.category && <div style={{ fontSize: 11, color: '#8A8FA8' }}>{e.category}</div>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: block.color }}>{fmt(e.amount)}</div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Recent Expenses</div>
              <button onClick={() => setTab('expenses')} style={{ background: 'none', border: 'none', fontSize: 12, color: '#5D78FF', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
            </div>
            {expenses.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8A8FA8' }}>No expenses recorded yet</div>
            ) : expenses.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F8F9FF' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: '#8A8FA8' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {e.category}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{fmt(e.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets / Liabilities list */}
      {(tab === 'assets' || tab === 'liabilities') && (
        <>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => { setEntryForm(p => ({ ...p, type: tab === 'assets' ? 'asset' : 'liability' })); setShowAddEntry(v => !v) }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Plus size={13} />Add {tab === 'assets' ? 'Asset' : 'Liability'}
              </button>
            </div>
          )}
          {showAddEntry && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { key: 'name', placeholder: 'Name' },
                { key: 'amount', placeholder: 'Amount (₹)' },
                { key: 'category', placeholder: 'Category (optional)' },
              ].map(f => (
                <input key={f.key} value={(entryForm as any)[f.key]} onChange={e => setEntryForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, flex: '1 1 140px' }} />
              ))}
              <button onClick={() => { createEntry.mutate({ ...entryForm, amount: Number(entryForm.amount), type: entryForm.type as any, asOf: new Date().toISOString() }); setShowAddEntry(false); setEntryForm({ type: 'asset', name: '', amount: '', category: '', notes: '' }) }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                  {['Name', 'Category', 'Amount', 'As Of', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tab === 'assets' ? assets : liabilities).map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{e.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#6B7280' }}>{e.category ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: tab === 'assets' ? '#2BC155' : '#EF4444' }}>{fmt(e.amount)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{new Date(e.asOf).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {canEdit && <button onClick={() => { if (confirm('Delete this entry?')) deleteEntry.mutate(e.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
                {(tab === 'assets' ? assets : liabilities).length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Expenses list */}
      {tab === 'expenses' && (
        <>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setShowAddExpense(v => !v)} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Plus size={13} />Add Expense
              </button>
            </div>
          )}
          {showAddExpense && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input value={expenseForm.title} onChange={e => setExpenseForm(p => ({ ...p, title: e.target.value }))} placeholder="Title *" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, flex: '2 1 160px' }} />
              <input value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} placeholder="Amount ₹ *" style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, width: 110 }} />
              <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} style={{ border: '1.5px solid #E8E9F0', borderRadius: 7, padding: '7px 10px', fontSize: 13 }} />
              <button onClick={() => { createExpense.mutate({ ...expenseForm, amount: Number(expenseForm.amount) } as any); setShowAddExpense(false); setExpenseForm({ title: '', amount: '', category: 'other', date: new Date().toISOString().slice(0, 10), notes: '' }) }} style={{ background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F1F5' }}>
                  {['Title', 'Category', 'Amount', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#8A8FA8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{e.title}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: `${EXPENSE_COLORS[e.category]}22`, color: EXPENSE_COLORS[e.category], fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{e.category}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#EF4444' }}>{fmt(e.amount)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {canEdit && <button onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(e.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#8A8FA8', fontSize: 13 }}>No expenses yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
