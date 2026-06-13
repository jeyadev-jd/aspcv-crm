import { X, Edit2, Users, MapPin, Globe, Phone, Mail, MessageCircle, Calendar, DollarSign, Tag, Building2, TrendingUp, Hash } from 'lucide-react'
import { useCurrency } from '@/lib/currencyContext'
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

interface Props {
  lead: Lead
  onClose: () => void
  onEdit: (lead: Lead) => void
}

export default function LeadDetailPanel({ lead, onClose, onEdit }: Props) {
  const { symbol } = useCurrency()
  const s = statusStyle[lead.status] ?? statusStyle.Enquiry
  const sg = stageStyle[lead.stage] ?? stageStyle.Lead
  const isIndia = lead.company?.customerType === 'Indian' || lead.company?.customerType === 'India'
  const address = [
    isIndia ? lead.company?.region : lead.company?.['country'],
    lead.company?.state !== 'None' ? lead.company?.state : null,
    lead.company?.city,
    lead.company?.area,
  ].filter(Boolean).join(', ')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ width: 520, maxWidth: '100vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#374557', lineHeight: 1.3 }}>{lead.title}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{lead.company?.name}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
            <button onClick={() => onEdit(lead)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', background: '#fff', color: '#374557', cursor: 'pointer' }}>
              <Edit2 size={12} />Edit
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B1B1BE', display: 'flex' }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Ref + Status + Stage row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {lead.refNumber && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#5D78FF', background: '#EEF2FF', padding: '4px 12px', borderRadius: 20, fontFamily: 'monospace', letterSpacing: 0.5, border: '1px solid #C7D2FE' }}>
                <Hash size={10} />{lead.refNumber}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: s.bg, color: s.color }}>
              {STATUS_LABEL[lead.status] ?? lead.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: sg.bg, color: sg.color }}>
              {stageLabel[lead.stage] ?? lead.stage}
            </span>
            {lead.leadDate && (
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>Age: <strong style={{ color: '#374557' }}>{age(lead.leadDate)} day{age(lead.leadDate) !== 1 ? 's' : ''}</strong></span>
            )}
          </div>

          {/* Key metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <InfoCard icon={<DollarSign size={13} style={{ color: '#2BC155' }} />} label="Est. Value" iconBg="#E7FAF0">
              {lead.estimatedValue
                ? <span style={{ fontSize: 15, fontWeight: 800, color: '#2BC155' }}>{symbol}{lead.estimatedValue.toLocaleString()}</span>
                : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}
            </InfoCard>
            <InfoCard icon={<Calendar size={13} style={{ color: '#5D78FF' }} />} label="Lead Date" iconBg="#EEF2FF">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{lead.leadDate ? fmt(lead.leadDate) : '—'}</span>
            </InfoCard>
            <InfoCard icon={<Calendar size={13} style={{ color: '#FF9B52' }} />} label="Close Date" iconBg="#FFF5EE">
              {lead.closeDate
                ? <span style={{ fontSize: 12, fontWeight: 600, color: new Date(lead.closeDate) < new Date() ? '#FF5353' : '#374557' }}>{fmt(lead.closeDate)}</span>
                : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}
            </InfoCard>
            <InfoCard icon={<MapPin size={13} style={{ color: '#8B5CF6' }} />} label="Region" iconBg="#F3EEFF">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{lead.region || '—'}</span>
            </InfoCard>
            <InfoCard icon={<Tag size={13} style={{ color: '#F59E0B' }} />} label="Commercial" iconBg="#FFF8E0">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{lead.commercialType || '—'}</span>
            </InfoCard>
            <InfoCard icon={<TrendingUp size={13} style={{ color: '#06B6D4' }} />} label="State" iconBg="#E0F7FA">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>
                {(lead.company?.state && lead.company.state !== 'None') ? lead.company.state : '—'}
              </span>
            </InfoCard>
          </div>

          {/* Sources */}
          {(lead.sources?.length > 0 || lead.source) && (
            <Section title="Sources">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lead.sources?.length > 0
                  ? lead.sources.map(s => (
                    <span key={s.id} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557', border: '1px solid #E8EAED' }}>
                      {s.source}{s.sourceName ? <span style={{ color: '#9CA3AF' }}> · {s.sourceName}</span> : ''}
                    </span>
                  ))
                  : <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: '#F4F5F9', color: '#374557' }}>{lead.source}</span>
                }
              </div>
            </Section>
          )}

          {/* Sales Persons / Owners */}
          {lead.owners?.length > 0 && (
            <Section title="Sales Person(s)">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lead.owners.map(o => (
                  <div key={o.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F9FF', borderRadius: 10, padding: '7px 12px', border: '1px solid #E8EDFF' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#5D78FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(o.user?.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{o.user?.name ?? '—'}</p>
                      <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 }}>{o.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* People / Contacts */}
          <Section title={`People / Contacts (${lead.contacts?.length ?? 0})`} icon={<Users size={13} style={{ color: '#5D78FF' }} />}>
            {(lead.contacts?.length ?? 0) === 0
              ? <p style={{ fontSize: 11, color: '#B1B1BE' }}>No contacts added.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lead.contacts.map(c => (
                  <div key={c.id} style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDFF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: c.email || c.phone || c.whatsapp ? 8 : 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#5D78FF', flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.name}
                          {c.isPrimary && <span style={{ fontSize: 9, background: '#E8EDFF', color: '#5D78FF', borderRadius: 6, padding: '1px 6px', fontWeight: 600 }}>Primary</span>}
                        </p>
                        {c.designation && <p style={{ fontSize: 10, color: '#9CA3AF' }}>{c.designation}</p>}
                      </div>
                    </div>
                    {(c.email || c.phone || c.whatsapp) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingLeft: 40 }}>
                        {c.email && <ContactInfo icon={<Mail size={11} style={{ color: '#FF9B52' }} />} text={c.email} />}
                        {c.phone && <ContactInfo icon={<Phone size={11} style={{ color: '#5D78FF' }} />} text={c.phone} />}
                        {c.whatsapp && <ContactInfo icon={<MessageCircle size={11} style={{ color: '#25D366' }} />} text={c.whatsapp} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </Section>

          {/* Company */}
          <Section title="Company" icon={<Building2 size={13} style={{ color: '#5D78FF' }} />}>
            <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{lead.company?.name}</p>
                {lead.company?.customerType && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: isIndia ? '#E7FAF0' : '#E8EDFF', color: isIndia ? '#2BC155' : '#5D78FF', fontWeight: 600 }}>
                    {isIndia ? 'India' : lead.company.customerType}
                  </span>
                )}
              </div>
              {address ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  {isIndia ? <MapPin size={11} style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }} /> : <Globe size={11} style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }} />}
                  <p style={{ fontSize: 11, color: '#374557' }}>{address}</p>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>No address on file</p>
              )}
              {lead.refNumber && (
                <div style={{ borderTop: '1px solid #E8EDFF', paddingTop: 8 }}>
                  <p style={{ fontSize: 9, color: '#B1B1BE', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ref Number</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#5D78FF', fontFamily: 'monospace', letterSpacing: 0.5 }}>{lead.refNumber}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Notes */}
          {lead.notes && (
            <Section title="Description">
              <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.7, background: '#F8F9FF', borderRadius: 8, padding: '10px 12px' }}>{lead.notes}</p>
            </Section>
          )}

          {/* Monthly remarks */}
          {lead.monthlyRemarks && (
            <Section title="Month-on-Month Remarks">
              <p style={{ fontSize: 11, color: '#374557', lineHeight: 1.7, background: '#FFF8E0', borderRadius: 8, padding: '10px 12px', border: '1px solid #FDE68A' }}>{lead.monthlyRemarks}</p>
            </Section>
          )}

          {/* Discussions */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <DiscussionPanel
              entityType="Lead"
              entityId={lead.id}
              contacts={lead.contacts?.map(c => ({ id: c.id, name: c.name, designation: c.designation }))}
            />
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{title}
      </p>
      {children}
    </div>
  )
}

function InfoCard({ icon, label, iconBg, children }: { icon: React.ReactNode; label: string; iconBg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FAFBFF', borderRadius: 10, padding: '10px 12px', border: '1px solid #F0F1F5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</p>
      </div>
      {children}
    </div>
  )
}

function ContactInfo({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon}
      <span style={{ fontSize: 10, color: '#374557' }}>{text}</span>
    </div>
  )
}
