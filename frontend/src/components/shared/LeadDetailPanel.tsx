import { useState } from 'react'
import { X, Edit2, Users, MapPin, Globe, Phone, Mail, MessageCircle, Calendar, DollarSign, Tag, Building2, TrendingUp, Hash } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
import { useIsMobile } from '@/lib/useIsMobile'
import DiscussionPanel from '@/components/shared/DiscussionPanel'
import type { Lead } from '@/hooks/useLeads'
import type React from 'react'

const STATUS_LABEL: Record<string, string> = {
  Enquiry: 'Enquiry', ProspectiveLead: 'Prospective Lead', ProjectHold: 'Project Hold',
  Hibernated: 'Hibernated', OrderWon: 'Order Won', OrderLost: 'Order Lost',
}
const statusStyle: Record<string, { bg: string; color: string }> = {
  Enquiry: { bg: '#E8EDFF', color: '#5D78FF' }, ProspectiveLead: { bg: '#FFF5EE', color: '#FF9B52' },
  ProjectHold: { bg: '#F3EEFF', color: '#8B5CF6' }, Hibernated: { bg: '#F4F5F9', color: '#8C8C8C' },
  OrderWon: { bg: '#E7FAF0', color: '#2BC155' }, OrderLost: { bg: '#FFEEEE', color: '#FF5353' },
}
const stageLabel: Record<string, string> = {
  Lead: 'Lead', QualifiedLead: 'Qualified Lead', Deal: 'Deal',
  Project: 'Project', Installation: 'Installation', Support: 'Support',
}
const stageStyle: Record<string, { bg: string; color: string }> = {
  Lead: { bg: '#EEF2FF', color: '#5D78FF' }, QualifiedLead: { bg: '#FFF5EE', color: '#FF9B52' },
  Deal: { bg: '#FFF8E0', color: '#F59E0B' }, Project: { bg: '#E7FAF0', color: '#2BC155' },
  Installation: { bg: '#F3EEFF', color: '#8B5CF6' }, Support: { bg: '#FFF3F3', color: '#FF5353' },
}

function fmt(date: string) { return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function age(date: string) { return Math.floor((Date.now() - new Date(date).getTime()) / 86400000) }

interface Props { lead: Lead; onClose: () => void; onEdit: (lead: Lead) => void }

export default function LeadDetailPanel({ lead, onClose, onEdit }: Props) {
  const { symbol } = useCurrency()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'discussion'>('overview')
  const s = statusStyle[lead.status] ?? statusStyle.Enquiry
  const sg = stageStyle[lead.stage] ?? stageStyle.Lead
  const isIndia = lead.company?.customerType === 'Indian' || lead.company?.customerType === 'India'
  const address = [
    isIndia ? lead.company?.region : lead.company?.['country'],
    lead.company?.state !== 'None' ? lead.company?.state : null,
    lead.company?.city, lead.company?.area,
  ].filter(Boolean).join(', ')

  const header = (
    <div style={{ padding: isMobile ? '10px 14px' : '18px 24px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fff', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: '#374557', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.title}</p>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{lead.company?.name}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
        <button onClick={() => onEdit(lead)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
          <Edit2 size={12} />Edit
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', display: 'flex' }}><X size={16} /></button>
      </div>
    </div>
  )

  const tabs = (
    <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F5', background: '#fff', flexShrink: 0 }}>
      {(['overview', 'contacts', 'discussion'] as const).map(tab => (
        <button key={tab} onClick={() => setActiveTab(tab)} style={{
          flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
          color: activeTab === tab ? '#5D78FF' : '#9CA3AF', background: 'none', border: 'none',
          borderBottom: `2px solid ${activeTab === tab ? '#5D78FF' : 'transparent'}`,
          cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
        }}>
          {tab === 'contacts' ? `Contacts (${lead.contacts?.length ?? 0})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  )

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: isMobile ? '10px 14px' : '20px 24px' }}>
      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {lead.refNumber && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#5D78FF', background: '#EEF2FF', padding: '3px 10px', borderRadius: 20, fontFamily: 'monospace', border: '1px solid #C7D2FE' }}>
            <Hash size={9} />{lead.refNumber}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: sg.bg, color: sg.color }}>{stageLabel[lead.stage] ?? lead.stage}</span>
        {lead.leadDate && <span style={{ fontSize: 10, color: '#9CA3AF' }}>Age: <strong style={{ color: '#374557' }}>{age(lead.leadDate)}d</strong></span>}
      </div>

      {/* Metrics — 2 col on mobile, 3 on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 6 }}>
        <InfoCard icon={<DollarSign size={12} style={{ color: '#2BC155' }} />} label="Est. Value" iconBg="#E7FAF0">
          {lead.estimatedValue ? <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: '#2BC155' }}>{symbol}{lead.estimatedValue.toLocaleString()}</span> : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
        </InfoCard>
        <InfoCard icon={<Calendar size={12} style={{ color: '#5D78FF' }} />} label="Lead Date" iconBg="#EEF2FF">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{lead.leadDate ? fmt(lead.leadDate) : '—'}</span>
        </InfoCard>
        <InfoCard icon={<Calendar size={12} style={{ color: '#FF9B52' }} />} label="Close Date" iconBg="#FFF5EE">
          {lead.closeDate ? <span style={{ fontSize: 11, fontWeight: 600, color: new Date(lead.closeDate) < new Date() ? '#FF5353' : '#374557' }}>{fmt(lead.closeDate)}</span> : <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span>}
        </InfoCard>
        <InfoCard icon={<MapPin size={12} style={{ color: '#8B5CF6' }} />} label="Region" iconBg="#F3EEFF">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{lead.region || '—'}</span>
        </InfoCard>
        <InfoCard icon={<Tag size={12} style={{ color: '#F59E0B' }} />} label="Commercial" iconBg="#FFF8E0">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{lead.commercialType || '—'}</span>
        </InfoCard>
        <InfoCard icon={<TrendingUp size={12} style={{ color: '#06B6D4' }} />} label="State" iconBg="#E0F7FA">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{(lead.company?.state && lead.company.state !== 'None') ? lead.company.state : '—'}</span>
        </InfoCard>
      </div>

      {/* Sources */}
      {(lead.sources?.length > 0 || lead.source) && (
        <Section title="Sources">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lead.sources?.length > 0
              ? lead.sources.map(s => <span key={s.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F4F5F9', color: '#374557', border: '1px solid #E8EAED' }}>{s.source}{s.sourceName ? <span style={{ color: '#9CA3AF' }}> · {s.sourceName}</span> : ''}</span>)
              : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{lead.source}</span>}
          </div>
        </Section>
      )}

      {/* Owners */}
      {lead.owners?.length > 0 && (
        <Section title="Sales Person(s)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lead.owners.map(o => (
              <div key={o.userId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8F9FF', borderRadius: 8, padding: '5px 10px', border: '1px solid #E8EDFF' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#5D78FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(o.user?.name ?? '?').charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374557' }}>{o.user?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Company */}
      <Section title="Company" icon={<Building2 size={12} style={{ color: '#5D78FF' }} />}>
        <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '8px 10px', border: '1px solid #E8EDFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>{lead.company?.name}</p>
            {lead.company?.customerType && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: isIndia ? '#E7FAF0' : '#E8EDFF', color: isIndia ? '#2BC155' : '#5D78FF', fontWeight: 600 }}>{isIndia ? 'India' : lead.company.customerType}</span>}
          </div>
          {address ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              {isIndia ? <MapPin size={10} style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }} /> : <Globe size={10} style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }} />}
              <p style={{ fontSize: 11, color: '#374557' }}>{address}</p>
            </div>
          ) : <p style={{ fontSize: 11, color: '#B1B1BE' }}>No address on file</p>}
        </div>
      </Section>

      {lead.notes && <Section title="Description"><p style={{ fontSize: 11, color: '#374557', lineHeight: 1.7, background: '#F8F9FF', borderRadius: 8, padding: '8px 10px' }}>{lead.notes}</p></Section>}
      {lead.monthlyRemarks && <Section title="Remarks"><p style={{ fontSize: 11, color: '#374557', lineHeight: 1.7, background: '#FFF8E0', borderRadius: 8, padding: '8px 10px', border: '1px solid #FDE68A' }}>{lead.monthlyRemarks}</p></Section>}
    </div>
  )

  const contactsContent = (
    <div style={{ padding: isMobile ? '10px 14px' : '20px 24px' }}>
      {(lead.contacts?.length ?? 0) === 0
        ? <p style={{ fontSize: 12, color: '#B1B1BE' }}>No contacts added.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lead.contacts.map(c => (
            <div key={c.id} style={{ background: '#F8F9FF', borderRadius: 10, padding: '8px 10px', border: '1px solid #E8EDFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#5D78FF', flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {c.name}
                    {c.isPrimary && <span style={{ fontSize: 9, background: '#E8EDFF', color: '#5D78FF', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>Primary</span>}
                  </p>
                  {c.designation && <p style={{ fontSize: 10, color: '#9CA3AF' }}>{c.designation}</p>}
                </div>
              </div>
              {(c.email || c.phone || c.whatsapp) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 38 }}>
                  {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={11} style={{ color: '#FF9B52', flexShrink: 0 }} /><span style={{ fontSize: 11, color: '#374557', wordBreak: 'break-all' }}>{c.email}</span></div>}
                  {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={11} style={{ color: '#5D78FF', flexShrink: 0 }} /><span style={{ fontSize: 11, color: '#374557' }}>{c.phone}</span></div>}
                  {c.whatsapp && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MessageCircle size={11} style={{ color: '#25D366', flexShrink: 0 }} /><span style={{ fontSize: 11, color: '#374557' }}>{c.whatsapp}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>}
    </div>
  )

  const discussionContent = (
    <div style={{ padding: isMobile ? '10px 14px' : '20px 24px' }}>
      <DiscussionPanel entityType="Lead" entityId={lead.id} contacts={lead.contacts?.map(c => ({ id: c.id, name: c.name, designation: c.designation }))} />
    </div>
  )

  const tabContent = activeTab === 'overview' ? overviewContent : activeTab === 'contacts' ? contactsContent : discussionContent

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {header}
          {tabs}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {tabContent}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ width: 520, maxWidth: '100vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
        {header}
        {tabs}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tabContent}
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#374557', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{icon}{title}</p>
      {children}
    </div>
  )
}

function InfoCard({ icon, label, iconBg, children }: { icon: React.ReactNode; label: string; iconBg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FAFBFF', borderRadius: 10, padding: '8px 10px', border: '1px solid #F0F1F5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</p>
      </div>
      {children}
    </div>
  )
}
