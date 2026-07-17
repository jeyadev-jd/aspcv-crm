import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Building2, Users, UserCheck, Handshake, FolderOpen, FileText, LifeBuoy, Wrench,
  Calendar as CalendarIcon, Paperclip, MessageSquare, Clock, Plus, Trash2, Download, ArrowLeft,
} from 'lucide-react'
import Pagination from '@/components/shared/Pagination'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import DiscussionPanel from '@/components/shared/DiscussionPanel'
import TimelinePanel from '@/components/shared/TimelinePanel'
import AttachmentUploader from '@/components/shared/AttachmentUploader'
import { useCompany } from '@/hooks/useCompanies'
import {
  useCompanyContacts, useCompanyLeads, useCompanyDeals, useCompanyProjects,
  useCompanyInvoices, useCompanyTickets, useCompanyInstallations,
} from '@/hooks/useCustomer360'
import { useAttachments, useDeleteAttachment } from '@/hooks/useAttachments'
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from '@/hooks/useCalendarEvents'
import { toast } from '@/lib/toast'

const CARD = { background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5' }
const SECTION_TITLE = { fontSize: 13, fontWeight: 700, color: '#1A1D23', display: 'flex', alignItems: 'center', gap: 8 }

const TABS = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'records', label: 'Related Records', icon: FolderOpen },
  { key: 'documents', label: 'Documents', icon: Paperclip },
  { key: 'notes', label: 'Notes & Discussions', icon: MessageSquare },
  { key: 'calendar', label: 'Meetings & Follow-ups', icon: CalendarIcon },
  { key: 'timeline', label: 'Timeline', icon: Clock },
] as const
type TabKey = typeof TABS[number]['key']

const CALENDAR_CATEGORIES = ['FollowUp', 'Meeting', 'CustomerReview', 'Other'] as const

// RelatedList: one independently-paginated section — its own query, its own page state,
// its own loading/empty/error states. Not a slice of one big payload.
function RelatedList<T>({ title, icon: Icon, page, setPage, query, renderRow, emptyLabel, viewAllPath, navigate }: {
  title: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  page: number
  setPage: (p: number) => void
  query: { data?: { data: T[]; totalPages: number; total: number }; isLoading: boolean; isError: boolean }
  renderRow: (row: T) => React.ReactNode
  emptyLabel: string
  viewAllPath: string
  navigate: (path: string) => void
}) {
  return (
    <div style={{ ...CARD, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={SECTION_TITLE}><Icon size={14} style={{ color: '#5D78FF' }} />{title} {query.data?.total != null && <span style={{ color: '#B1B1BE', fontWeight: 500 }}>({query.data.total})</span>}</div>
        <button onClick={() => navigate(viewAllPath)} style={{ fontSize: 11, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
      </div>
      {query.isLoading ? <Spinner /> : query.isError ? (
        <p style={{ fontSize: 12, color: '#FF5353' }}>Failed to load.</p>
      ) : !query.data?.data.length ? (
        <p style={{ fontSize: 12, color: '#B1B1BE', padding: '8px 0' }}>{emptyLabel}</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {query.data.data.map((row, i) => <div key={i}>{renderRow(row)}</div>)}
          </div>
          {query.data.totalPages > 1 && <Pagination page={page} totalPages={query.data.totalPages} onChange={setPage} />}
        </>
      )}
    </div>
  )
}

export default function Customer360() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const companyId = id ?? ''
  const [tab, setTab] = useState<TabKey>('overview')

  const { data: company, isLoading: companyLoading } = useCompany(companyId)

  const [contactsPage, setContactsPage] = useState(1)
  const [leadsPage, setLeadsPage] = useState(1)
  const [dealsPage, setDealsPage] = useState(1)
  const [projectsPage, setProjectsPage] = useState(1)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [ticketsPage, setTicketsPage] = useState(1)
  const [installationsPage, setInstallationsPage] = useState(1)

  const contactsQ = useCompanyContacts(companyId, contactsPage)
  const leadsQ = useCompanyLeads(companyId, leadsPage)
  const dealsQ = useCompanyDeals(companyId, dealsPage)
  const projectsQ = useCompanyProjects(companyId, projectsPage)
  const invoicesQ = useCompanyInvoices(companyId, invoicesPage)
  const ticketsQ = useCompanyTickets(companyId, ticketsPage)
  const installationsQ = useCompanyInstallations(companyId, installationsPage)

  const attachmentsQ = useAttachments('Company', companyId)
  const deleteAttachment = useDeleteAttachment()

  const calendarQ = useCalendarEvents({ entityType: 'Company', entityId: companyId })
  const createEvent = useCreateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()
  const [eventForm, setEventForm] = useState({ title: '', date: '', startTime: '10:00', endTime: '11:00', category: 'FollowUp' as string })

  if (companyLoading) return <Spinner />
  if (!company) return <EmptyState title="Company not found" />

  async function scheduleEvent() {
    if (!eventForm.title.trim() || !eventForm.date) { toast.error('Title and date required'); return }
    try {
      await createEvent.mutateAsync({ ...eventForm, entityType: 'Company', entityId: companyId })
      setEventForm({ title: '', date: '', startTime: '10:00', endTime: '11:00', category: 'FollowUp' })
      toast.success('Event scheduled')
    } catch { toast.error('Failed to schedule') }
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Header — this IS the customer's home page, not a static summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/accounts')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}><ArrowLeft size={18} /></button>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={20} style={{ color: '#5D78FF' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1D23' }}>{company.name}</h1>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            {[company.industry, company.customerType, company.city?.name, company.phone, company.email].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      {/* Tabs — every module reachable from here */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid #F0F1F5', paddingBottom: 8 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? '#5D78FF' : '#F4F5F9', color: active ? '#fff' : '#6B7280' }}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Contacts', value: contactsQ.data?.total, icon: Users },
            { label: 'Leads', value: leadsQ.data?.total, icon: UserCheck },
            { label: 'Deals', value: dealsQ.data?.total, icon: Handshake },
            { label: 'Projects', value: projectsQ.data?.total, icon: FolderOpen },
            { label: 'Invoices', value: invoicesQ.data?.total, icon: FileText },
            { label: 'Support Tickets', value: ticketsQ.data?.total, icon: LifeBuoy },
            { label: 'Installations', value: installationsQ.data?.total, icon: Wrench },
            { label: 'Documents', value: attachmentsQ.data?.length, icon: Paperclip },
          ].map(k => (
            <div key={k.label} onClick={() => setTab(k.label === 'Documents' ? 'documents' : 'records')} style={{ ...CARD, padding: 14, cursor: 'pointer' }}>
              <k.icon size={16} style={{ color: '#5D78FF', marginBottom: 6 }} />
              <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1D23' }}>{k.value ?? '—'}</p>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'records' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <RelatedList title="Contacts" icon={Users} page={contactsPage} setPage={setContactsPage} query={contactsQ as any} viewAllPath="/contacts" navigate={navigate}
            emptyLabel="No contacts yet." renderRow={(c: any) => <div style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB' }}>{c.name}{c.designation ? ` · ${c.designation}` : ''}</div>} />
          <RelatedList title="Leads" icon={UserCheck} page={leadsPage} setPage={setLeadsPage} query={leadsQ as any} viewAllPath="/leads" navigate={navigate}
            emptyLabel="No leads yet." renderRow={(l: any) => <div onClick={() => navigate('/leads')} style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB', cursor: 'pointer' }}>{l.title} <span style={{ color: '#9CA3AF' }}>· {l.pipelineStage}</span></div>} />
          <RelatedList title="Deals" icon={Handshake} page={dealsPage} setPage={setDealsPage} query={dealsQ as any} viewAllPath="/deals" navigate={navigate}
            emptyLabel="No deals yet." renderRow={(d: any) => <div onClick={() => navigate('/deals')} style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB', cursor: 'pointer' }}>{d.title} <span style={{ color: '#9CA3AF' }}>· {d.stage}</span></div>} />
          <RelatedList title="Projects" icon={FolderOpen} page={projectsPage} setPage={setProjectsPage} query={projectsQ as any} viewAllPath="/projects" navigate={navigate}
            emptyLabel="No projects yet." renderRow={(p: any) => <div onClick={() => navigate('/projects')} style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB', cursor: 'pointer' }}>{p.title} <span style={{ color: '#9CA3AF' }}>· {p.status}</span></div>} />
          <RelatedList title="Invoices" icon={FileText} page={invoicesPage} setPage={setInvoicesPage} query={invoicesQ as any} viewAllPath="/invoices" navigate={navigate}
            emptyLabel="No invoices yet." renderRow={(inv: any) => <div onClick={() => navigate('/invoices')} style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB', cursor: 'pointer' }}>{inv.number} <span style={{ color: '#9CA3AF' }}>· {inv.status} · ₹{inv.amount?.toLocaleString()}</span></div>} />
          <RelatedList title="Support Tickets" icon={LifeBuoy} page={ticketsPage} setPage={setTicketsPage} query={ticketsQ as any} viewAllPath="/support" navigate={navigate}
            emptyLabel="No tickets yet." renderRow={(t: any) => <div onClick={() => navigate('/support')} style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB', cursor: 'pointer' }}>{t.subject ?? t.title} <span style={{ color: '#9CA3AF' }}>· {t.status}</span></div>} />
          <RelatedList title="Installations" icon={Wrench} page={installationsPage} setPage={setInstallationsPage} query={installationsQ as any} viewAllPath="/projects" navigate={navigate}
            emptyLabel="No installations yet." renderRow={(inst: any) => <div style={{ fontSize: 12, color: '#374557', padding: '6px 0', borderBottom: '1px solid #F8F9FB' }}>{inst.title} <span style={{ color: '#9CA3AF' }}>· {inst.status}</span></div>} />
        </div>
      )}

      {tab === 'documents' && (
        <div style={{ ...CARD, padding: 16 }}>
          <div style={SECTION_TITLE}><Paperclip size={14} style={{ color: '#5D78FF' }} />Documents</div>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 12px' }}>Company-level documents. Lead/Deal/Project documents remain on their own records and are pulled in automatically wherever that lifecycle chain is viewed — no re-upload needed.</p>
          <AttachmentUploader entityType="Company" entityId={companyId} onUploaded={() => attachmentsQ.refetch()} />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attachmentsQ.isLoading ? <Spinner /> : !attachmentsQ.data?.length ? (
              <p style={{ fontSize: 12, color: '#B1B1BE' }}>No documents uploaded yet.</p>
            ) : attachmentsQ.data.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FAFBFF', border: '1px solid #F0F1F5', borderRadius: 8 }}>
                <FileText size={14} style={{ color: '#5D78FF' }} />
                <a href={`http://localhost:4000${a.url}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#374557', flex: 1, textDecoration: 'none' }}>{a.fileName}</a>
                {a.version > 1 && <span style={{ fontSize: 10, background: '#FFF8E0', color: '#F59E0B', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>v{a.version}</span>}
                {a.documentType && <span style={{ fontSize: 10, background: '#EEF2FF', color: '#5D78FF', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>{a.documentType}</span>}
                <a href={`http://localhost:4000${a.url}`} target="_blank" rel="noreferrer" style={{ color: '#9CA3AF', display: 'flex' }}><Download size={13} /></a>
                <button onClick={() => deleteAttachment.mutate(a.id, { onSuccess: () => { attachmentsQ.refetch(); toast.success('Deleted') } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', display: 'flex' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div style={{ ...CARD, padding: 16 }}>
          <DiscussionPanel entityType="Company" entityId={companyId} />
        </div>
      )}

      {tab === 'calendar' && (
        <div style={{ ...CARD, padding: 16 }}>
          <div style={SECTION_TITLE}><CalendarIcon size={14} style={{ color: '#5D78FF' }} />Meetings & Follow-ups</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0', alignItems: 'center' }}>
            <input placeholder="Title" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 8, border: '1px solid #E8EAED', fontSize: 12 }} />
            <input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8EAED', fontSize: 12 }} />
            <input type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8EAED', fontSize: 12, width: 90 }} />
            <select value={eventForm.category} onChange={e => setEventForm(f => ({ ...f, category: e.target.value }))} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E8EAED', fontSize: 12 }}>
              {CALENDAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={scheduleEvent} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}><Plus size={13} />Schedule</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {calendarQ.isLoading ? <Spinner /> : !calendarQ.data?.length ? (
              <p style={{ fontSize: 12, color: '#B1B1BE' }}>No meetings or follow-ups scheduled.</p>
            ) : calendarQ.data.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FAFBFF', border: '1px solid #F0F1F5', borderRadius: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ev.source === 'Auto' ? '#FFF8E0' : '#EEF2FF', color: ev.source === 'Auto' ? '#F59E0B' : '#5D78FF' }}>{ev.category ?? 'Event'}</span>
                <span style={{ fontSize: 12, color: '#374557', flex: 1 }}>{ev.title}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(ev.date).toLocaleDateString()} {ev.startTime}</span>
                <button onClick={() => deleteEvent.mutate(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', display: 'flex' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div style={{ ...CARD, padding: 16 }}>
          <TimelinePanel entityType="Company" entityId={companyId} />
        </div>
      )}
    </div>
  )
}
