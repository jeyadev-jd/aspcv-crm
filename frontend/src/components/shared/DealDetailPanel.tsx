import { X, Briefcase, ExternalLink, Edit2, DollarSign, Calendar, TrendingUp, Users, Building2 } from 'lucide-react'
import type { DealAPI } from '@/hooks/useDeals'
import DiscussionPanel from './DiscussionPanel'
import TimelinePanel from './TimelinePanel'
import { useAuthStore } from '@/lib/authStore'
import { useCurrency } from '@/lib/currencyContext'

const STAGE_STYLE: Record<string, { color: string; bg: string }> = {
  LeadIn:      { color: '#5D78FF', bg: '#E8EDFF' },
  Proposal:    { color: '#FF9B52', bg: '#FFF5EE' },
  Negotiation: { color: '#F59E0B', bg: '#FFF8E0' },
  OrderWon:    { color: '#2BC155', bg: '#E7FAF0' },
  OrderLost:   { color: '#FF5353', bg: '#FFEEEE' },
}

const STAGE_LABEL: Record<string, string> = {
  LeadIn: 'Lead In', Proposal: 'Proposal', Negotiation: 'Negotiation',
  OrderWon: 'Closed Won', OrderLost: 'Closed Lost',
}

interface Props {
  deal: DealAPI
  onClose: () => void
  onEdit: () => void
  symbol?: string
}

const fmt = (date: string) => new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function DealDetailPanel({ deal, onClose, onEdit, symbol = '₹' }: Props) {
  const user = useAuthStore(s => s.user)
  const { symbol: currencySymbol } = useCurrency()
  const canEdit = ['SuperAdmin', 'Manager', 'ProjectHead', 'BusinessHead', 'SalesHead'].includes(user?.role ?? '')
  const stageStyle = STAGE_STYLE[deal.stage] ?? { color: '#8C8C8C', bg: '#F4F5F9' }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 50 }}
        onClick={onClose}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: '100%', maxWidth: 520,
        background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        zIndex: 51,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: stageStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={18} style={{ color: stageStyle.color }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', lineHeight: 1.3 }}>{deal.title}</p>
                <p style={{ fontSize: 12, color: '#B1B1BE', marginTop: 2 }}>{deal.company?.name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {canEdit && (
                <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>
                  <Edit2 size={12} /> Edit
                </button>
              )}
              <button onClick={onClose} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stage + key info chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20, background: stageStyle.bg, color: stageStyle.color }}>
              {STAGE_LABEL[deal.stage] ?? deal.stage}
            </span>
            {deal.value != null && (
              <span style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557', fontWeight: 600 }}>
                {symbol}{Number(deal.value).toLocaleString()}
              </span>
            )}
            {deal.probability != null && (
              <span style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>
                {deal.probability}% probability
              </span>
            )}
            {deal.closeDate && (
              <span style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>
                Close: {new Date(deal.closeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <InfoCard icon={<DollarSign size={12} style={{ color: '#2BC155' }} />} label="Value" iconBg="#E7FAF0">
              {deal.value ? <span style={{ fontSize: 14, fontWeight: 700, color: '#2BC155' }}>{currencySymbol}{deal.value.toLocaleString()}</span> : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
            </InfoCard>
            <InfoCard icon={<Calendar size={12} style={{ color: '#5D78FF' }} />} label="Close Date" iconBg="#EEF2FF">
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{deal.closeDate ? fmt(deal.closeDate) : '—'}</span>
            </InfoCard>
            <InfoCard icon={<TrendingUp size={12} style={{ color: '#F59E0B' }} />} label="Probability" iconBg="#FFF8E0">
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{deal.probability != null ? `${deal.probability}%` : '—'}</span>
            </InfoCard>
          </div>

          {/* Team assignments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {deal.assignedPM && (
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDFF' }}>
                <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Project Manager</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.assignedPM.name}</p>
              </div>
            )}
            {deal.assignedSE && (
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDFF' }}>
                <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Service Engineer</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.assignedSE.name}</p>
              </div>
            )}
            {deal.department && (
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDFF' }}>
                <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Department</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.department.name}</p>
              </div>
            )}
            {deal.owners.length > 0 && (
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDFF' }}>
                <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Owners</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.owners.map(o => o.user.name).join(', ')}</p>
              </div>
            )}
          </div>

          {/* Origin lead link */}
          {deal.lead && (
            <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #C7D2FE' }}>
              <p style={{ fontSize: 10, color: '#5D78FF', fontWeight: 600, marginBottom: 2 }}>Origin Lead</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.lead.title}</p>
            </div>
          )}

          {/* Handover info */}
          {deal.handoverNotes && (
            <div style={{ background: '#E7FAF0', borderRadius: 10, padding: '12px 14px', border: '1px solid #BBF7D0' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2BC155', marginBottom: 6 }}>Handover Notes</p>
              <p style={{ fontSize: 12, color: '#374557', lineHeight: 1.6 }}>{deal.handoverNotes}</p>
              {deal.handoverAttachmentUrl && (
                <a href={deal.handoverAttachmentUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5D78FF', marginTop: 8, textDecoration: 'none', fontWeight: 600 }}>
                  <ExternalLink size={11} /> View Attachment
                </a>
              )}
            </div>
          )}

          {/* Notes */}
          {deal.notes && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6 }}>Notes</p>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{deal.notes}</p>
            </div>
          )}

          {/* Activity Timeline */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <TimelinePanel entityType="Deal" entityId={deal.id} />
          </div>

          {/* Deal Discussions */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <DiscussionPanel entityType="Deal" entityId={deal.id} />
          </div>

          {/* Lead Discussions (if deal has origin lead) */}
          {deal.lead && (
            <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={13} style={{ color: '#5D78FF' }} /> Lead Discussions
              </p>
              <DiscussionPanel entityType="Lead" entityId={deal.lead.id} readOnly />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InfoCard({ icon, label, iconBg, children }: { icon: React.ReactNode; label: string; iconBg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FAFBFF', borderRadius: 10, border: '1px solid #F0F1F5', padding: '10px 12px' }}>
      <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        {label}
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{children}</p>
    </div>
  )
}
