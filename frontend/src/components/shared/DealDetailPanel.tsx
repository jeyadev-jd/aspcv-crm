import { useState } from 'react'
import { X, Briefcase, ExternalLink, Edit2, DollarSign, Calendar, TrendingUp, Users, Building2, FileText, Plus, Trash2, Check, Send, Link as LinkIcon, Hash } from 'lucide-react'
import type { DealAPI } from '@/hooks/useDeals'
import { API_ORIGIN } from '@/lib/api'
import { useQuotations, useCreateQuotation, useUpdateQuotation, useSubmitQuotationForApproval, useApproveQuotation, useRejectQuotation, useSendQuotation } from '@/hooks/useSales'
import { useCreateLinkAttachment, useAttachments, useDeleteAttachment } from '@/hooks/useAttachments'
import DiscussionPanel from './DiscussionPanel'
import TimelinePanel from './TimelinePanel'
import EntityReimbursements from './EntityReimbursements'
import ScopeItemsPanel from './ScopeItemsPanel'
import { useAuthStore } from '@/lib/authStore'
import { useCurrency } from '@/lib/currencyContext'
import { toast } from '@/lib/toast'

const QUOTE_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  Draft:           { color: '#8C8C8C', bg: '#F4F5F9' },
  PendingApproval: { color: '#F59E0B', bg: '#FFF8E0' },
  Approved:        { color: '#2BC155', bg: '#E7FAF0' },
  Sent:            { color: '#5D78FF', bg: '#E8EDFF' },
  Accepted:        { color: '#2BC155', bg: '#E7FAF0' },
  Rejected:        { color: '#FF5353', bg: '#FFEEEE' },
  Expired:         { color: '#B1B1BE', bg: '#F4F5F9' },
}

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

  const isAdmin = ['SuperAdmin', 'BusinessHead'].includes(user?.role ?? '')

  const { data: quotations = [] } = useQuotations(deal.id)
  const createQuotation = useCreateQuotation()
  const submitForApproval = useSubmitQuotationForApproval()
  const approveQuotation = useApproveQuotation()
  const rejectQuotation = useRejectQuotation()
  const sendQuotation = useSendQuotation()
  const createLink = useCreateLinkAttachment()

  const updateQuotation = useUpdateQuotation()
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteTitle, setQuoteTitle] = useState('')
  const [quoteCost, setQuoteCost] = useState('')
  const [quoteLinks, setQuoteLinks] = useState<string[]>([''])
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  const [docLinkFor, setDocLinkFor] = useState<string | null>(null)
  const [docLinkUrl, setDocLinkUrl] = useState('')
  const [editingCostFor, setEditingCostFor] = useState<string | null>(null)
  const [editCostValue, setEditCostValue] = useState('')

  function updateQuoteLink(i: number, value: string) {
    setQuoteLinks(links => links.map((l, idx) => idx === i ? value : l))
  }
  function addQuoteLinkField() { setQuoteLinks(links => [...links, '']) }
  function removeQuoteLinkField(i: number) { setQuoteLinks(links => links.filter((_, idx) => idx !== i)) }

  async function submitQuote() {
    if (!quoteTitle.trim()) { toast.error('Quotation title required'); return }
    const links = quoteLinks.map(l => l.trim()).filter(Boolean)
    const q = await createQuotation.mutateAsync({
      companyId: deal.companyId,
      dealId: deal.id,
      title: quoteTitle.trim(),
      totalAmount: parseFloat(quoteCost) || 0,
    })
    for (const url of links) {
      await createLink.mutateAsync({ entityType: 'Quotation', entityId: q.id, url })
    }
    toast.success('Quotation created as Draft')
    setShowQuoteForm(false)
    setQuoteTitle('')
    setQuoteCost('')
    setQuoteLinks([''])
  }

  async function attachDoc(quotationId: string) {
    if (!docLinkUrl.trim()) return
    await createLink.mutateAsync({ entityType: 'Quotation', entityId: quotationId, url: docLinkUrl.trim() })
    setDocLinkUrl('')
  }

  async function saveCost(quotationId: string) {
    await updateQuotation.mutateAsync({ id: quotationId, totalAmount: parseFloat(editCostValue) || 0 })
    setEditingCostFor(null)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 50 }}
        onClick={onClose}
      />
      {/* Panel */}
      <div role="dialog" aria-modal="true" aria-label="Deal details" style={{
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
            {deal.leadNumber && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#2BC155', background: '#E7FAF0', padding: '3px 10px', borderRadius: 20, fontFamily: 'monospace', border: '1px solid #A7F3D0' }}>
                <Hash size={9} />{deal.leadNumber}
              </span>
            )}
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
                <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Sales Manager</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{deal.assignedPM.name}</p>
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

          {/* Quotations */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} style={{ color: '#5D78FF' }} /> Quotations
              </p>
              {canEdit && (
                <button onClick={() => setShowQuoteForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus size={12} /> New Quotation
                </button>
              )}
            </div>

            {showQuoteForm && (
              <div style={{ background: '#F8F9FF', borderRadius: 10, padding: 12, border: '1px solid #E8EDFF', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={quoteTitle}
                  onChange={e => setQuoteTitle(e.target.value)}
                  placeholder="Quotation title"
                  style={{ width: '100%', border: '1px solid #E8E9F0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <input
                  type="number"
                  value={quoteCost}
                  onChange={e => setQuoteCost(e.target.value)}
                  placeholder={`Project cost (${currencySymbol})`}
                  style={{ width: '100%', border: '1px solid #E8E9F0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#B1B1BE' }}>Document Links</p>
                  {quoteLinks.map((link, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={link}
                        onChange={e => updateQuoteLink(i, e.target.value)}
                        placeholder="https://... (any shareable link)"
                        style={{ flex: 1, border: '1px solid #E8E9F0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                      {quoteLinks.length > 1 && (
                        <button onClick={() => removeQuoteLinkField(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: '0 4px' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addQuoteLinkField} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={11} /> Add another link
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowQuoteForm(false)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitQuote} disabled={createQuotation.isPending} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#5D78FF', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    {createQuotation.isPending ? 'Creating…' : 'Create Draft'}
                  </button>
                </div>
              </div>
            )}

            {quotations.length === 0 ? (
              <p style={{ fontSize: 11, color: '#B1B1BE' }}>No quotations yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quotations.map(q => {
                  const s = QUOTE_STATUS_STYLE[q.status] ?? QUOTE_STATUS_STYLE.Draft
                  const isOpen = expandedQuoteId === q.id
                  return (
                    <div key={q.id} style={{ background: '#FAFBFF', borderRadius: 8, border: '1px solid #F0F1F5', overflow: 'hidden' }}>
                      <div onClick={() => setExpandedQuoteId(isOpen ? null : q.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{q.refNumber} — {q.title}</p>
                          <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{currencySymbol}{q.totalAmount.toLocaleString()}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                          {q.status === 'PendingApproval' ? 'Pending Approval' : q.status}
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #F0F1F5' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                            <p style={{ fontSize: 10, color: '#B1B1BE' }}>Project Cost</p>
                            {editingCostFor === q.id ? (
                              <>
                                <input
                                  type="number" autoFocus value={editCostValue}
                                  onChange={e => setEditCostValue(e.target.value)}
                                  style={{ width: 110, border: '1px solid #E8E9F0', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' }}
                                />
                                <button onClick={() => saveCost(q.id)} style={{ fontSize: 11, fontWeight: 600, color: '#2BC155', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingCostFor(null)} style={{ fontSize: 11, color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{currencySymbol}{q.totalAmount.toLocaleString()}</span>
                                {q.status === 'Draft' && canEdit && (
                                  <button onClick={() => { setEditingCostFor(q.id); setEditCostValue(String(q.totalAmount)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5D78FF', padding: 0, display: 'flex' }}>
                                    <Edit2 size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          {q.rejectionReason && (
                            <p style={{ fontSize: 10, color: '#FF5353', marginTop: 8 }}><strong>Rejected:</strong> {q.rejectionReason}</p>
                          )}

                          <QuotationDocs quotationId={q.id} editable={q.status === 'Draft' && canEdit} />

                          {q.status === 'Draft' && canEdit && (
                            docLinkFor === q.id ? (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <input
                                  value={docLinkUrl}
                                  onChange={e => setDocLinkUrl(e.target.value)}
                                  placeholder="https://... (any shareable link)"
                                  style={{ flex: 1, border: '1px solid #E8E9F0', borderRadius: 6, padding: '6px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <button onClick={() => attachDoc(q.id)} disabled={!docLinkUrl.trim() || createLink.isPending} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#5D78FF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Add</button>
                                <button onClick={() => { setDocLinkFor(null); setDocLinkUrl('') }} style={{ padding: '6px 10px', fontSize: 11, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                              </div>
                            ) : (
                              <button onClick={() => setDocLinkFor(q.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>
                                <LinkIcon size={11} /> Add document link
                              </button>
                            )
                          )}

                          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            {q.status === 'Draft' && canEdit && (
                              <button onClick={() => submitForApproval.mutate(q.id)} disabled={submitForApproval.isPending} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#F59E0B', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                Submit for Approval
                              </button>
                            )}
                            {q.status === 'PendingApproval' && isAdmin && (
                              <>
                                <button onClick={() => approveQuotation.mutate(q.id)} disabled={approveQuotation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#2BC155', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                  <Check size={11} /> Approve
                                </button>
                                <button onClick={() => { const reason = prompt('Reason for rejection?') ?? undefined; rejectQuotation.mutate({ id: q.id, reason }) }} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#FF5353', background: '#FFEEEE', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                  Reject
                                </button>
                              </>
                            )}
                            {q.status === 'PendingApproval' && !isAdmin && (
                              <p style={{ fontSize: 10, color: '#B1B1BE' }}>Waiting on SuperAdmin/BusinessHead sign-off</p>
                            )}
                            {q.status === 'Approved' && canEdit && (
                              <button onClick={() => sendQuotation.mutate(q.id)} disabled={sendQuotation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#5D78FF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                <Send size={11} /> Send to Customer
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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

          {/* Technical spec inherited from the originating lead */}
          {(deal.capacityValue != null || deal.tempRangeMin != null || deal.tempRangeMax != null) && (
            <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 10 }}>Specification</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Capacity</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>
                    {deal.capacityValue != null ? `${deal.capacityValue} ${deal.capacityUnit?.name ?? ''}`.trim() : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Temp Range (°C)</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>
                    {deal.tempRangeMin != null || deal.tempRangeMax != null
                      ? `${deal.tempRangeMin ?? '—'} to ${deal.tempRangeMax ?? '—'}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scope of supply carried into the deal */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <ScopeItemsPanel entityType="Deal" entityId={deal.id} />
          </div>

          {/* Reimbursements booked against this deal */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374557', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} style={{ color: '#5D78FF' }} /> Reimbursements
            </p>
            <EntityReimbursements entityType="Deal" entityId={deal.id} />
          </div>

          {/* Activity Timeline */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <TimelinePanel entityType="Deal" entityId={deal.id} />
          </div>

          {/* Deal Discussions */}
          <div style={{ borderTop: '1px solid #F0F1F5', paddingTop: 16 }}>
            <DiscussionPanel entityType="Deal" entityId={deal.id} linkableProjects={deal.projects ?? []} />
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

function QuotationDocs({ quotationId, editable }: { quotationId: string; editable: boolean }) {
  const { data: docs = [] } = useAttachments('Quotation', quotationId)
  const deleteAttachment = useDeleteAttachment()
  if (docs.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      {docs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href={d.externalUrl ?? `${API_ORIGIN}${d.url}`} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5D78FF', textDecoration: 'none', flex: 1 }}>
            <LinkIcon size={11} /> {d.fileName}
          </a>
          {editable && (
            <button onClick={() => deleteAttachment.mutate(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5353', padding: 0, display: 'flex' }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
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
