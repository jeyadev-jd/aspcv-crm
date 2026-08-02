import { useState } from 'react'
import { ClipboardList, Store } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'
import MaterialRequests from './MaterialRequests'
import Procurement from './Procurement'

type Tab = 'material_requests' | 'procurement'

export default function Warehouse() {
  const can = useAuthStore(s => s.can)
  const canMR = can('material_request', 'read_own') || can('material_request', 'read_all')
  const canProcurement = can('purchase_order', 'read_all')

  const tabs = [
    canMR && { key: 'material_requests' as Tab, label: 'Material Requests', icon: ClipboardList },
    canProcurement && { key: 'procurement' as Tab, label: 'Procurement', icon: Store },
  ].filter(Boolean) as { key: Tab; label: string; icon: typeof ClipboardList }[]

  const [tab, setTab] = useState<Tab | null>(tabs[0]?.key ?? null)
  const activeTab = tab && tabs.some(t => t.key === tab) ? tab : tabs[0]?.key ?? null

  if (!activeTab) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 14, color: '#8A8B9F' }}>You don't have access to any warehouse module.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#23263B', margin: 0 }}>Warehouse</h1>
        <p style={{ fontSize: 14, color: '#8A8B9F', margin: '4px 0 0' }}>Material requests and procurement in one place</p>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #F0F1F5' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 14, fontWeight: 500,
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === t.key ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === t.key ? '#2563EB' : '#8A8B9F',
              }}
            >
              <t.icon style={{ width: 16, height: 16 }} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'material_requests' && <MaterialRequests />}
      {activeTab === 'procurement' && <Procurement />}
    </div>
  )
}
