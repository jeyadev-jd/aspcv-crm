import { useState } from 'react'
import { useCurrency } from '@/lib/currencyContext'
import { MoreHorizontal, Upload, X, Star, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, List, LayoutGrid, Thermometer, Wind, Settings2, Zap, Snowflake, Recycle, Package } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type React from 'react'

interface Product {
  id: string; name: string; sku: string; price: number
  qty: number; sales: number; rating: number; category: string; type?: string; unit: string; description?: string
}

const initProducts: Product[] = [
  { id: '1', name: 'Air Source Heat Pump 8kW',        sku: 'ASHP-8K-001',  price: 4200,  qty: 38,  sales: 72,  rating: 4.8, category: 'Heat Pump',     type: 'Air Source Heat Pump',     unit: 'per unit' },
  { id: '2', name: 'Water Source Heat Pump 12kW',     sku: 'WSHP-12K-002', price: 8900,  qty: 12,  sales: 18,  rating: 4.9, category: 'Heat Pump',     type: 'Water Source Heat Pump',   unit: 'per unit' },
  { id: '3', name: 'Swimming Pool Heat Pump 200L',    sku: 'SPHP-200L-003',price: 2100,  qty: 55,  sales: 94,  rating: 4.7, category: 'Heat Pump',     type: 'Swimming Pool Heat Pump',  unit: 'per unit' },
  { id: '4', name: 'Solar Tunnel Dryer 10kWp',        sku: 'STD-10KWP-004',price: 6500,  qty: 22,  sales: 31,  rating: 4.6, category: 'Pump Dryer',    type: 'Solar Tunnel Dryer',       unit: 'per array' },
  { id: '5', name: 'Sludge Dryer Unit 10kWh',         sku: 'SLDU-10KWH-005',price: 5800, qty: 19,  sales: 25,  rating: 4.8, category: 'Pump Dryer',    type: 'Sludge Dryer',             unit: 'per unit' },
  { id: '6', name: 'Process Chiller 7kW',             sku: 'CHL-7KW-006',  price: 1200,  qty: 84,  sales: 145, rating: 4.5, category: 'Chiller',       unit: 'per unit' },
  { id: '7', name: 'Waste Heat Recovery Unit',        sku: 'WHR-UNIT-007', price: 3400,  qty: 28,  sales: 47,  rating: 4.7, category: 'Waste Heat Recovery', unit: 'per unit' },
  { id: '8', name: 'ORC Power Module 50kW',           sku: 'ORC-50KW-008', price: 12500, qty: 9,   sales: 14,  rating: 4.6, category: 'ORC',           unit: 'per unit' },
  { id: '9', name: 'BLDC Ceiling Fan + LED Kit',      sku: 'LBF-KIT-009',  price: 145,   qty: 320, sales: 412, rating: 4.4, category: 'LED Lights & BLDC Fans', unit: 'per unit' },
]

const categoriesMeta = [
  { name: 'Heat Pump',                value: 184,  color: '#5D78FF' },
  { name: 'Pump Dryer',               value: 56,   color: '#22C55E' },
  { name: 'Chiller',                  value: 145,  color: '#FF9B52' },
  { name: 'Waste Heat Recovery',      value: 47,   color: '#06B6D4' },
  { name: 'ORC',                      value: 14,   color: '#8B5CF6' },
  { name: 'LED Lights & BLDC Fans',   value: 412,  color: '#FFAE00' },
]

const pieData = categoriesMeta.map(c => ({ value: c.value, color: c.color }))

const catIconMap: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  'Heat Pump': Thermometer, 'Pump Dryer': Wind, Chiller: Snowflake, 'Waste Heat Recovery': Recycle, ORC: Settings2, 'LED Lights & BLDC Fans': Zap,
}

const productTypes: Record<string, string[]> = {
  'Heat Pump': ['Air Source Heat Pump', 'Water Source Heat Pump', 'Swimming Pool Heat Pump'],
  'Pump Dryer': ['Heat Pump Dryer', 'Solar Dryer', 'Solar Tunnel Dryer', 'Sludge Dryer'],
}

const blankForm = { name: '', sku: '', quantity: '', price: '', category: 'Heat Pump', type: productTypes['Heat Pump'][0], unit: 'per unit', description: '' }
const PAGE_SIZE = 5

export default function Products() {
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const [products, setProducts] = useState(initProducts)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const catList = ['All', ...Object.keys(catIconMap)]
  const filtered = filter === 'All' ? products : products.filter(p => p.category === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalSales = products.reduce((s, p) => s + p.sales, 0)

  function openCreate() {
    setEditItem(null); setForm(blankForm); setErrors({}); setShowModal(true)
  }

  function openEdit(prod: Product) {
    setEditItem(prod)
    setForm({ name: prod.name, sku: prod.sku, quantity: String(prod.qty), price: String(prod.price), category: prod.category, type: prod.type ?? '', unit: prod.unit, description: prod.description ?? '' })
    setErrors({})
    setShowModal(true)
  }

  function changeCategory(category: string) {
    setForm(f => ({ ...f, category, type: productTypes[category]?.[0] ?? '' }))
  }

  function closeModal() {
    setShowModal(false); setEditItem(null); setForm(blankForm); setErrors({})
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Product name required'
    if (!form.sku.trim()) e.sku = 'SKU required'
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'Valid price required'
    if (form.quantity && (isNaN(Number(form.quantity)) || Number(form.quantity) < 0)) e.quantity = 'Valid quantity required'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (editItem) {
      setProducts(prev => prev.map(p => p.id === editItem.id ? { ...p, name: form.name, sku: form.sku, qty: Number(form.quantity) || 0, price: Number(form.price), category: form.category, type: form.type || undefined, unit: form.unit, description: form.description } : p))
    } else {
      const newProd: Product = {
        id: String(Date.now()), name: form.name, sku: form.sku,
        price: Number(form.price), qty: Number(form.quantity) || 0,
        sales: 0, rating: 0, category: form.category, type: form.type || undefined, unit: form.unit, description: form.description,
      }
      setProducts(prev => [newProd, ...prev])
    }
    closeModal()
  }

  function handleDelete(id: string) {
    setProducts(p => p.filter(prod => prod.id !== id))
    setMenuOpen(null); setDeleteConfirm(null)
    setPage(1)
  }

  function changeFilter(cat: string) {
    setFilter(cat); setPage(1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'stretch' : 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>Product Categories</p>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 16 }}>Units sold by category</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categoriesMeta.map(cat => (
              <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {(() => { const Icon = catIconMap[cat.name] ?? Package; return <Icon size={16} style={{ color: '#8C8C8C' }} /> })()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{cat.value}</p>
                  <p style={{ fontSize: 10, color: '#B1B1BE' }}>{cat.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>Sales by Category</p>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={52} dataKey="value" strokeWidth={0}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{totalSales}</p>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {categoriesMeta.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <p style={{ fontSize: 10, color: '#B1B1BE' }}>{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catList.map(cat => (
              <button key={cat} onClick={() => changeFilter(cat)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: filter === cat ? '#5D78FF' : '#F4F5F9',
                color: filter === cat ? '#fff' : '#B1B1BE',
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', border: '1px solid #F0F1F5', borderRadius: 8, overflow: 'hidden' }}>
              {(['list', 'grid'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === mode ? '#5D78FF' : '#fff',
                  color: viewMode === mode ? '#fff' : '#B1B1BE',
                }}>
                  {mode === 'list' ? <List size={13}/> : <LayoutGrid size={13}/>}
                </button>
              ))}
            </div>
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={13} /> Add Product
            </button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                {paginated.map((p) => (
                  <div key={p.id} onClick={() => openEdit(p)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(() => { const Icon = catIconMap[p.category] ?? Package; return <Icon size={16} style={{ color: '#8C8C8C' }} /> })()}
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{p.name}</p>
                          <p style={{ fontSize: 10, color: '#B1B1BE' }}>{p.category}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: p.qty < 20 ? '#FF9B52' : '#2BC155' }}>{p.qty} units</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 9, color: '#B1B1BE' }}>Price</p>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{symbol}{p.price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: '#B1B1BE' }}>Stock</p>
                        <p style={{ fontSize: 11, color: '#374557' }}>{p.qty} {p.unit}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: '#B1B1BE' }}>Sold</p>
                        <p style={{ fontSize: 11, color: '#374557' }}>{p.sales}</p>
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
                  {['Product', 'Category', 'Rating', 'Price', 'Stock', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((p, i) => (
                  <tr key={p.id} onClick={() => openEdit(p)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(() => { const Icon = catIconMap[p.category] ?? Package; return <Icon size={16} style={{ color: '#8C8C8C' }} /> })()}
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{p.name}</p>
                          <p style={{ fontSize: 10, color: '#B1B1BE' }}>{p.sku} · {p.sales} sold</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#E8EDFF', color: '#5D78FF' }}>{p.category}</span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={11} style={{ color: '#FFAE00', fill: '#FFAE00' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{p.rating}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>{symbol}{p.price.toLocaleString()}</p>
                      <p style={{ fontSize: 10, color: '#B1B1BE' }}>{p.unit}</p>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: p.qty < 20 ? '#FF9B52' : '#2BC155' }}>{p.qty} units</span>
                    </td>
                    <td style={{ padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id) }}
                          style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === p.id && (
                          <div style={dropdownStyle}>
                            <button onClick={() => { openEdit(p); setMenuOpen(null) }} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            <button onClick={() => { setDeleteConfirm(p.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No products found.</td></tr>
                )}
              </tbody>
            </table>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}>
                <ChevronLeft size={13} /> Prev
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => openEdit(p)} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <div style={{ width: '100%', height: 90, borderRadius: 10, background: '#F4F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    {(() => { const Icon = catIconMap[p.category] ?? Package; return <Icon size={28} style={{ color: '#8C8C8C' }} /> })()}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 2 }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 8 }}>{p.sku}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{symbol}{p.price.toLocaleString()}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={11} style={{ color: '#FFAE00', fill: '#FFAE00' }} />
                      <span style={{ fontSize: 11, color: '#374557' }}>{p.rating}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E8EDFF', color: '#5D78FF', marginTop: 6, display: 'inline-block' }}>{p.category}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}>Prev</button>
              <span style={{ fontSize: 11, color: '#B1B1BE' }}>{filtered.length} products</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>Next</button>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Product?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editItem ? 'Edit Product' : 'Add Product'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {!editItem && (
              <div style={{ border: '2px dashed #E8EDFF', borderRadius: 12, height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#FAFBFF', marginBottom: 16 }}>
                <Upload size={20} style={{ color: '#5D78FF' }} />
                <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 6 }}>Click to upload product image</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Product Name *" error={errors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Air Source Heat Pump 8kW" style={inp(!!errors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="SKU *" error={errors.sku}>
                  <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="e.g. ASHP-8K-009" style={inp(!!errors.sku)} />
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={e => changeCategory(e.target.value)} style={inp(false)}>
                    {Object.keys(catIconMap).map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              {productTypes[form.category]?.length > 0 && (
                <Field label="Type">
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp(false)}>
                    {productTypes[form.category].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label={`Price (${symbol}) *`} error={errors.price}>
                  <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!errors.price)} />
                </Field>
                <Field label="Stock Qty" error={errors.quantity}>
                  <input value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!errors.quantity)} />
                </Field>
                <Field label="Unit">
                  <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="per unit" style={inp(false)} />
                </Field>
              </div>
              <Field label="Description">
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Product spec or notes..." rows={3} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{editItem ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: '100%', marginTop: 4,
  background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100,
  minWidth: 160, overflow: 'hidden', padding: '4px 0',
}

const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
  padding: '8px 14px', fontSize: 12, color: '#374557',
  background: 'none', border: 'none', cursor: 'pointer',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#374557', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 10, color: '#FF5353', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

function inp(hasError: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`,
    fontSize: 12, color: '#374557', outline: 'none', background: '#fff',
  }
}
