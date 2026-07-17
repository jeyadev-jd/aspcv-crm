import { useState } from 'react'
import { Zap, ChevronDown, ChevronUp, Play, Clock } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'
import { useBusinessRules, useUpdateBusinessRule, useRunBusinessRules, useRuleTriggers, type BusinessRule } from '@/hooks/useBusinessRules'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'

const SEVERITY_COLOR: Record<string, { color: string; bg: string }> = {
  info:     { color: '#5D78FF', bg: '#EEF2FF' },
  warning:  { color: '#F59E0B', bg: '#FFFBEB' },
  critical: { color: '#EF4444', bg: '#FEF2F2' },
}

function ConfigEditor({ rule, onSave }: { rule: BusinessRule; onSave: (config: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(JSON.stringify(rule.config, null, 2))
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setError(null) }}
        rows={8}
        style={{
          width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 12,
          border: '1px solid #E2E4EA', borderRadius: 8, padding: 10, resize: 'vertical',
        }}
      />
      {error && <p style={{ color: '#EF4444', fontSize: 11, margin: '4px 0' }}>{error}</p>}
      <button
        onClick={() => {
          try {
            const parsed = JSON.parse(draft)
            onSave(parsed)
          } catch {
            setError('Invalid JSON')
          }
        }}
        style={{ marginTop: 8, padding: '6px 14px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Save Config
      </button>
    </div>
  )
}

function RuleRow({ rule, canEdit }: { rule: BusinessRule; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const update = useUpdateBusinessRule()
  const { data: triggers = [] } = useRuleTriggers(expanded ? rule.id : null)

  return (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#94A3B8' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{rule.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F4F5F9', color: '#94A3B8' }}>
              {rule.module}
            </span>
          </div>
          {rule.description && <p style={{ fontSize: 11, color: '#94A3B8', margin: '3px 0 0' }}>{rule.description}</p>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: canEdit ? 'pointer' : 'default' }}>
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={!canEdit || update.isPending}
            onChange={e => update.mutate({ id: rule.id, enabled: e.target.checked })}
          />
          {rule.enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #F0F1F5', padding: 16, background: '#FAFBFC' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 8px', textTransform: 'uppercase' }}>Configuration</p>
          {canEdit ? (
            <ConfigEditor rule={rule} onSave={config => update.mutate({ id: rule.id, config })} />
          ) : (
            <pre style={{ fontSize: 12, background: '#fff', border: '1px solid #E2E4EA', borderRadius: 8, padding: 10, overflow: 'auto' }}>
              {JSON.stringify(rule.config, null, 2)}
            </pre>
          )}

          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '16px 0 8px', textTransform: 'uppercase' }}>Recent Triggers</p>
          {triggers.length === 0 ? (
            <p style={{ fontSize: 12, color: '#B1B1BE' }}>No triggers fired yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {triggers.map(t => {
                const sc = SEVERITY_COLOR[t.severity] ?? SEVERITY_COLOR.info
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 10px', background: '#fff', border: '1px solid #F0F1F5', borderRadius: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: sc.bg, color: sc.color }}>{t.severity}</span>
                    <span style={{ color: '#374557', flex: 1 }}>{t.message}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 11 }}>
                      <Clock size={10} />
                      {new Date(t.firedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BusinessRules() {
  const can = useAuthStore(s => s.can)
  const canEdit = can('business_rule', 'edit')
  const { data: rules = [], isLoading } = useBusinessRules()
  const runNow = useRunBusinessRules()

  const grouped = rules.reduce<Record<string, BusinessRule[]>>((acc, r) => {
    (acc[r.module] ??= []).push(r)
    return acc
  }, {})

  if (isLoading) return <Spinner label="Loading business rules…" />

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Zap size={20} color="#5D78FF" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#374557', margin: 0 }}>Business Rules</h1>
        {canEdit && (
          <button
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', background: '#5D78FF', color: '#fff', border: 'none',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: runNow.isPending ? 0.6 : 1,
            }}
          >
            <Play size={13} /> Run Now
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Zap} title="No business rules configured" subtitle="Seed defaults or add rule handlers." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(grouped).map(([module, moduleRules]) => (
            <div key={module}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>{module}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {moduleRules.map(rule => <RuleRow key={rule.id} rule={rule} canEdit={canEdit} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
