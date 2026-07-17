import Pagination from '@/components/shared/Pagination'
import Spinner from '@/components/shared/Spinner'
import EmptyState from '@/components/shared/EmptyState'
import KpiCard from '@/components/shared/KpiCard'
import Toolbar from '@/components/shared/Toolbar'
import FilterChips from '@/components/shared/FilterChips'
import SectionHeader from '@/components/shared/SectionHeader'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrency } from '@/lib/currencyContext'
import { MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, FolderOpen, Edit2, Trash2, CheckCircle2, Play, Pause, Loader2, Download, Check, RefreshCw, ClipboardList, Cpu, Shield, XCircle, Wrench, AlertTriangle, FolderKanban, Wallet, TrendingUp, AlertOctagon } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { api } from '@/lib/api'
import { useProjects, useCreateProject, useUpdateProject, useUpdateProjectStatus, useDeleteProject, STATUS_LABEL } from '@/hooks/useProjects'
import { useDepartments } from '@/hooks/useDepartments'
import type { ProjectAPI } from '@/hooks/useProjects'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'
import { useProjectERP, useCompleteProject, useCancelProject, useAssignProject } from '@/hooks/useERP'
import { useInstallations, useCreateInstallation, useUpdateInstallationStatus, useDeleteInstallation } from '@/hooks/useInstallations'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/lib/authStore'
import { toast } from '@/lib/toast'
import TaskPanel from '@/components/shared/TaskPanel'
import { useProjectBilling, useGenerateProjectInvoice, useRecordPayment, useSendInvoice, useCancelInvoice, type BillingInvoice } from '@/hooks/useProjectBilling'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { PurchaseOrderPDF } from '@/components/pdf/PurchaseOrderPDF'

// ─── Types ────────────────────────────────────────────────────────────────────

type UIStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed'
type ProjectWithUI = ProjectAPI & { uiStatus: UIStatus; clientName: string }
interface Milestone { id: string; text: string; done: boolean; dueDate?: string }
interface GanttTask { id: string; name: string; start: string; end: string; progress: number; color: string }
interface ProjData { progress: number; milestones: Milestone[]; ganttTasks: GanttTask[] }

// ─── CSV ──────────────────────────────────────────────────────────────────────

const PROJ_CSV_COLS: CsvColDef<ProjectAPI>[] = [
  { header: 'Title', accessor: r => r.title },
  { header: 'Company', accessor: r => r.company?.name ?? '' },
  { header: 'Status', accessor: r => STATUS_LABEL[r.status] ?? r.status },
  { header: 'StartDate', accessor: r => r.startDate ?? '' },
  { header: 'EndDate', accessor: r => r.endDate ?? '' },
  { header: 'Budget', accessor: r => r.budget != null ? String(r.budget) : '' },
  { header: 'Notes', accessor: r => r.notes ?? '' },
]
const PROJ_STATUS_MAP: Record<string, ProjectAPI['status']> = {
  planning: 'Planning', active: 'Active', 'on hold': 'OnHold', onhold: 'OnHold', completed: 'Completed',
}
const PROJ_CSV_TEMPLATE = { Title: 'Solar Installation Project', Company: 'Acme Corp', Status: 'Planning', StartDate: '2026-07-01', EndDate: '2026-12-31', Budget: '1000000', Notes: '' }

// ─── Style constants ──────────────────────────────────────────────────────────

const statusStyle: Record<UIStatus, { bg: string; color: string }> = {
  Planning: { bg: '#E8EDFF', color: '#5D78FF' },
  Active: { bg: '#E7FAF0', color: '#2BC155' },
  'On Hold': { bg: '#FFF5EE', color: '#FF9B52' },
  Completed: { bg: '#F4F5F9', color: '#8C8C8C' },
}
const apiToUI: Record<string, UIStatus> = {
  Planning: 'Planning', Active: 'Active', OnHold: 'On Hold', Completed: 'Completed',
  Engineering: 'Active', Procurement: 'Active', Manufacturing: 'Active',
  Installation: 'Active', Testing: 'Active', Cancelled: 'On Hold',
}
const uiToAPI: Record<UIStatus, ProjectAPI['status']> = {
  Planning: 'Planning', Active: 'Active', 'On Hold': 'OnHold', Completed: 'Completed',
}
const uiStatuses: UIStatus[] = ['Planning', 'Active', 'On Hold', 'Completed']
const blankForm = { name: '', client: '', startDate: '', endDate: '', status: 'Planning' as UIStatus, budget: '', description: '', departmentId: '' }
const PAGE_SIZE = 5
const GANTT_COLORS = ['#5D78FF', '#2BC155', '#FF9B52', '#FF5353', '#A855F7', '#EC4899', '#06B6D4', '#84CC16']

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadProjData(id: string, proj?: ProjectWithUI): ProjData {
  try { const r = localStorage.getItem(`proj_${id}`); if (r) return JSON.parse(r) } catch { }
  if (proj) {
    const startStr = proj.startDate || '2026-01-01'
    const endStr = proj.endDate || '2026-12-31'
    const start = new Date(startStr)
    const end = new Date(endStr)
    const durationDays = Math.max(15, Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)))
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    const addDays = (d: Date, days: number) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() + days)
      return nd
    }
    const progress = proj.progress ?? 0
    const milestones: Milestone[] = [
      { id: 'm1', text: 'Site Survey & Engineering Design', done: progress >= 20, dueDate: formatDate(addDays(start, Math.floor(durationDays * 0.15))) },
      { id: 'm2', text: 'Procurement of Core Materials', done: progress >= 40, dueDate: formatDate(addDays(start, Math.floor(durationDays * 0.35))) },
      { id: 'm3', text: 'Component Assembly & Fabrication', done: progress >= 60, dueDate: formatDate(addDays(start, Math.floor(durationDays * 0.6))) },
      { id: 'm4', text: 'On-site Installation & Electrical Wiring', done: progress >= 80, dueDate: formatDate(addDays(start, Math.floor(durationDays * 0.85))) },
      { id: 'm5', text: 'Testing, Commissioning & Handover', done: progress >= 100, dueDate: formatDate(end) }
    ]
    const ganttTasks: GanttTask[] = [
      {
        id: 't1',
        name: 'Structural engineering design approval',
        start: formatDate(start),
        end: formatDate(addDays(start, Math.max(5, Math.floor(durationDays * 0.2)))),
        progress: progress >= 20 ? 100 : Math.min(100, Math.floor(progress * 5)),
        color: GANTT_COLORS[0]
      },
      {
        id: 't2',
        name: 'Procuring solar modules and inverters',
        start: formatDate(addDays(start, Math.floor(durationDays * 0.15))),
        end: formatDate(addDays(start, Math.floor(durationDays * 0.4))),
        progress: progress >= 40 ? 100 : progress < 15 ? 0 : Math.min(100, Math.floor((progress - 15) * 4)),
        color: GANTT_COLORS[1]
      },
      {
        id: 't3',
        name: 'In-house panel assembly and layout wiring',
        start: formatDate(addDays(start, Math.floor(durationDays * 0.35))),
        end: formatDate(addDays(start, Math.floor(durationDays * 0.65))),
        progress: progress >= 70 ? 100 : progress < 35 ? 0 : Math.min(100, Math.floor((progress - 35) * 3)),
        color: GANTT_COLORS[2]
      },
      {
        id: 't4',
        name: 'Physical civil installation on site',
        start: formatDate(addDays(start, Math.floor(durationDays * 0.6))),
        end: formatDate(addDays(start, Math.floor(durationDays * 0.85))),
        progress: progress >= 90 ? 100 : progress < 60 ? 0 : Math.min(100, Math.floor((progress - 60) * 3.3)),
        color: GANTT_COLORS[3]
      },
      {
        id: 't5',
        name: 'Testing, diagnostics and grid integration',
        start: formatDate(addDays(start, Math.floor(durationDays * 0.8))),
        end: formatDate(end),
        progress: progress >= 100 ? 100 : progress < 80 ? 0 : Math.min(100, Math.floor((progress - 80) * 5)),
        color: GANTT_COLORS[4]
      }
    ]
    const seededData = { progress, milestones, ganttTasks }
    localStorage.setItem(`proj_${id}`, JSON.stringify(seededData))
    return seededData
  }
  return { progress: 0, milestones: [], ganttTasks: [] }
}
function saveProjData(id: string, data: ProjData) {
  localStorage.setItem(`proj_${id}`, JSON.stringify(data))
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawGantt(canvas: HTMLCanvasElement, tasks: GanttTask[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const LW = 180, HEADER = 52, ROW = 42

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  if (!tasks.length) {
    ctx.fillStyle = '#B1B1BE'
    ctx.font = '13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Add tasks below to build the Gantt chart', W / 2, H / 2)
    return
  }

  const minMs = Math.min(...tasks.map(t => +new Date(t.start))) - 7 * 864e5
  const maxMs = Math.max(...tasks.map(t => +new Date(t.end))) + 7 * 864e5
  const span = maxMs - minMs
  const x2d = (ms: number) => LW + ((ms - minMs) / span) * (W - LW)

  // Header bg
  ctx.fillStyle = '#F4F5F9'
  ctx.fillRect(0, 0, W, HEADER)

  // Month lines + labels
  const mc = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1)
  while (+mc <= maxMs) {
    const x = x2d(+mc)
    ctx.fillStyle = '#374557'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(mc.toLocaleDateString('en', { month: 'short', year: '2-digit' }), Math.max(LW + 4, x + 3), 20)
    ctx.strokeStyle = '#D5D5D5'; ctx.lineWidth = 1; ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(x, HEADER); ctx.lineTo(x, H); ctx.stroke()
    mc.setMonth(mc.getMonth() + 1)
  }

  // Week ticks
  const wc = new Date(minMs); wc.setDate(wc.getDate() - wc.getDay())
  while (+wc <= maxMs) {
    const x = x2d(+wc)
    if (x >= LW) {
      ctx.fillStyle = '#B1B1BE'; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(String(wc.getDate()), x, 38)
      ctx.strokeStyle = '#F0F1F5'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(x, HEADER); ctx.lineTo(x, H); ctx.stroke()
    }
    wc.setDate(wc.getDate() + 7)
  }

  // Today line
  const now = Date.now()
  if (now >= minMs && now <= maxMs) {
    const tx = x2d(now)
    ctx.strokeStyle = '#FF5353'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(tx, HEADER); ctx.lineTo(tx, H); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#FF5353'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('TODAY', tx, HEADER - 4)
  }

  // Left panel
  ctx.fillStyle = '#FAFBFF'; ctx.fillRect(0, HEADER, LW, H - HEADER)
  ctx.strokeStyle = '#E8EAED'; ctx.lineWidth = 1; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(LW, HEADER); ctx.lineTo(LW, H); ctx.stroke()
  ctx.fillStyle = '#B1B1BE'; ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('TASK', 12, HEADER - 10)

  tasks.forEach((task, i) => {
    const ry = HEADER + i * ROW
    ctx.strokeStyle = '#F4F5F9'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, ry + ROW); ctx.lineTo(W, ry + ROW); ctx.stroke()
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(93,120,255,0.02)'; ctx.fillRect(LW, ry, W - LW, ROW) }

    ctx.fillStyle = '#374557'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(task.name.length > 22 ? task.name.slice(0, 21) + '…' : task.name, 12, ry + ROW / 2 + 4)

    const bx = x2d(+new Date(task.start))
    const bw = Math.max(12, x2d(+new Date(task.end)) - bx)
    const by = ry + ROW * 0.18, bh = ROW * 0.64

    ctx.fillStyle = task.color + '33'; rrect(ctx, bx, by, bw, bh, 5); ctx.fill()
    const pw = bw * (task.progress / 100)
    if (pw > 0) { ctx.fillStyle = task.color; rrect(ctx, bx, by, pw, bh, 5); ctx.fill() }
    if (bw > 36) {
      ctx.fillStyle = task.progress > 55 ? '#fff' : task.color
      ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`${task.progress}%`, bx + bw / 2, by + bh / 2 + 3)
    }
  })
}

// ─── GanttCanvas component ────────────────────────────────────────────────────

function GanttCanvas({ tasks, projectId }: { tasks: GanttTask[]; projectId: string }) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const H = 52 + Math.max(tasks.length, 4) * 42 + 8

  const redraw = useCallback(() => {
    const cv = cvRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    cv.width = Math.max(wrap.clientWidth, 720)
    cv.height = H
    drawGantt(cv, tasks)
  }, [tasks, H])

  useEffect(() => { redraw() }, [redraw])

  function exportPNG() {
    const cv = cvRef.current; if (!cv) return
    const a = document.createElement('a')
    a.download = `gantt-${projectId.slice(0, 8)}.png`
    a.href = cv.toDataURL('image/png')
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={exportPNG} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid #5D78FF', color: '#5D78FF', background: '#EEF2FF', cursor: 'pointer' }}>
          <Download size={13} /> Export PNG
        </button>
      </div>
      <div ref={wrapRef} style={{ width: '100%', overflowX: 'auto', borderRadius: 10, border: '1px solid #F0F1F5' }}>
        <canvas ref={cvRef} style={{ display: 'block' }} />
      </div>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 10, color, marginBottom: 4, fontWeight: 600 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color }}>{value}</p>
    </div>
  )
}

// ─── Editable Costs / Warranty / Assignment panel ────────────────────────────
// Every field is editable. SuperAdmin (project edit auto-approved) saves directly;
// anyone else's save returns 403 approval_required → we file an ApprovalRequest with
// the exact payload, which an admin approves to apply (payload-based, no retry).
function EditableProjectPanel({ proj, symbol, onApplied }: { proj: ProjectWithUI; symbol: string; onApplied: (p: Partial<ProjectAPI>) => void }) {
  const can = useAuthStore(s => s.can)
  const { data: departments = [] } = useDepartments()
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))
  const [saving, setSaving] = useState(false)
  const num = (v: number | null | undefined) => (v != null ? String(v) : '')
  const [f, setF] = useState({
    purchaseCost: num(proj.purchaseCost), manufacturingCost: num(proj.manufacturingCost),
    labourCost: num(proj.labourCost), serviceCost: num(proj.serviceCost), installationCost: num(proj.installationCost),
    warrantyPeriod: num(proj.warrantyPeriod),
    warrantyStart: proj.warrantyStart?.slice(0, 10) ?? '', warrantyEnd: proj.warrantyEnd?.slice(0, 10) ?? '',
    startDate: proj.startDate?.slice(0, 10) ?? '', endDate: proj.endDate?.slice(0, 10) ?? '',
    departmentId: proj.department?.id ?? '', assignedPMId: (proj as any).assignedPMId ?? '',
  })
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))

  function buildPayload() {
    const p: Record<string, unknown> = {}
    const nk: (keyof typeof f)[] = ['purchaseCost', 'manufacturingCost', 'labourCost', 'serviceCost', 'installationCost', 'warrantyPeriod']
    for (const k of nk) if (f[k] !== '') p[k] = Number(f[k])
    for (const k of ['warrantyStart', 'warrantyEnd', 'startDate', 'endDate'] as const) if (f[k]) p[k] = f[k]
    if (f.departmentId) p.departmentId = f.departmentId
    if (f.assignedPMId) p.assignedPMId = f.assignedPMId
    return p
  }

  async function save() {
    const payload = buildPayload()
    if (!Object.keys(payload).length) { toast.error('Nothing to save'); return }
    setSaving(true)
    try {
      const { data } = await api.put(`/projects/${proj.id}`, payload)
      onApplied(data)
      toast.success('Project updated')
    } catch (e: any) {
      if (e?.response?.status === 403 && e.response.data?.error === 'approval_required') {
        // Not allowed to apply directly — file the change for admin approval.
        await api.post('/approval-requests', { entityType: 'project', entityId: proj.id, action: 'edit', payload, reason: `Project cost/detail edit on ${proj.title}` })
        toast.success('Sent to admin for approval')
      } else {
        toast.error(e?.response?.data?.error ?? 'Save failed')
      }
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', outline: 'none', boxSizing: 'border-box', background: '#fff' }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#B1B1BE', marginBottom: 3, display: 'block' }
  const costFields: [keyof typeof f, string][] = [['purchaseCost', 'Purchase'], ['manufacturingCost', 'Manufacturing'], ['labourCost', 'Labour'], ['installationCost', 'Installation'], ['serviceCost', 'Service']]

  return (
    <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8 }}>EDIT COSTS · WARRANTY · ASSIGNMENT</p>
        {!can('project', 'edit') && <span style={{ fontSize: 10, color: '#B1B1BE' }}>view only</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
        {costFields.map(([k, label]) => (
          <div key={k}><label style={lbl}>{label} ({symbol})</label>
            <input type="number" min="0" value={f[k]} onChange={e => set(k, e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div><label style={lbl}>Start Date</label><input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        <div><label style={lbl}>End Date</label><input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        <div><label style={lbl}>Warranty (months)</label><input type="number" min="0" value={f.warrantyPeriod} onChange={e => set('warrantyPeriod', e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        <div><label style={lbl}>Warranty Start</label><input type="date" value={f.warrantyStart} onChange={e => set('warrantyStart', e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        <div><label style={lbl}>Warranty End</label><input type="date" value={f.warrantyEnd} onChange={e => set('warrantyEnd', e.target.value)} style={inp} disabled={!can('project', 'edit')} /></div>
        <div><label style={lbl}>Department</label>
          <select value={f.departmentId} onChange={e => set('departmentId', e.target.value)} style={inp} disabled={!can('project', 'edit')}>
            <option value="">— None —</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div><label style={lbl}>Project Manager</label>
          <select value={f.assignedPMId} onChange={e => set('assignedPMId', e.target.value)} style={inp} disabled={!can('project', 'edit')}>
            <option value="">— None —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></div>
      </div>
      {can('project', 'edit') && (
        <button onClick={save} disabled={saving} style={{ width: '100%', padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : useAuthStore.getState().user?.roleName === 'SuperAdmin' ? 'Save changes' : 'Propose changes (needs admin approval)'}
        </button>
      )}
    </div>
  )
}

// ─── ProjectDetailModal ───────────────────────────────────────────────────────

function ProjectDetailModal({ proj, symbol, onClose, onEdit, onSaveMeta, onApplied, saving }: {
  proj: ProjectWithUI; symbol: string; onClose: () => void; onEdit: () => void
  onSaveMeta: (v: { actualBudget: number; progress: number }) => Promise<void>
  onApplied: (p: Partial<ProjectAPI>) => void; saving: boolean
}) {
  const [tab, setTab] = useState<'overview' | 'milestones' | 'gantt' | 'erp' | 'installations' | 'billing'>('overview')
  const [data, setData] = useState<ProjData>(() => loadProjData(proj.id))
  const [actualBudget, setActualBudget] = useState<string>(proj.actualBudget != null ? String(proj.actualBudget) : '')
  const [savedOk, setSavedOk] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const { data: mrData } = useQuery<{ totalEstimated?: number | null; status: string }[]>({
    queryKey: ['material-requests', proj.id],
    queryFn: () => api.get(`/material-requests?projectId=${proj.id}&pageSize=1000`).then(r => r.data.data),
    staleTime: 30_000,
  })
  const mrTotal = mrData?.reduce((s, r) => s + (r.totalEstimated ?? 0), 0) ?? 0
  const mrPaid = mrData?.filter(r => r.status === 'paid').reduce((s, r) => s + (r.totalEstimated ?? 0), 0) ?? 0

  const [msText, setMsText] = useState('')
  const [msDate, setMsDate] = useState('')

  const defaultStart = proj.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const defaultEnd = proj.endDate?.slice(0, 10) ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  const [gtForm, setGtForm] = useState({ name: '', start: defaultStart, end: defaultEnd, progress: 0, color: GANTT_COLORS[0] })
  const [editGtId, setEditGtId] = useState<string | null>(null)

  function update(next: ProjData) { setData(next); saveProjData(proj.id, next) }

  // milestones
  function addMs() {
    if (!msText.trim()) return
    update({ ...data, milestones: [...data.milestones, { id: crypto.randomUUID(), text: msText.trim(), done: false, dueDate: msDate || undefined }] })
    setMsText(''); setMsDate('')
  }
  function toggleMs(id: string) { update({ ...data, milestones: data.milestones.map(m => m.id === id ? { ...m, done: !m.done } : m) }) }
  function deleteMs(id: string) { update({ ...data, milestones: data.milestones.filter(m => m.id !== id) }) }

  // gantt tasks
  function saveGt() {
    if (!gtForm.name.trim() || !gtForm.start || !gtForm.end) return
    if (editGtId) {
      update({ ...data, ganttTasks: data.ganttTasks.map(t => t.id === editGtId ? { ...t, ...gtForm } : t) })
      setEditGtId(null)
    } else {
      update({ ...data, ganttTasks: [...data.ganttTasks, { id: crypto.randomUUID(), ...gtForm }] })
    }
    setGtForm({ name: '', start: defaultStart, end: defaultEnd, progress: 0, color: GANTT_COLORS[0] })
  }
  function editGt(t: GanttTask) { setEditGtId(t.id); setGtForm({ name: t.name, start: t.start, end: t.end, progress: t.progress, color: t.color }) }
  function deleteGt(id: string) { update({ ...data, ganttTasks: data.ganttTasks.filter(t => t.id !== id) }) }

  const doneMs = data.milestones.filter(m => m.done).length
  const autoProgress = data.milestones.length > 0 ? Math.round((doneMs / data.milestones.length) * 100) : data.progress
  const daysLeft = proj.endDate ? Math.ceil((new Date(proj.endDate).getTime() - Date.now()) / 864e5) : null
  const ageStart = proj.startDate ?? proj.createdAt
  const ageD = Math.floor((Date.now() - new Date(ageStart).getTime()) / 864e5)
  const ss = statusStyle[proj.uiStatus]

  const budget = proj.budget ?? 0
  const spent = Number(actualBudget) || 0
  const spentPctRaw = budget > 0 ? (spent / budget) * 100 : 0
  const spentPct = Math.round(spentPctRaw)
  const spentPctDisplay = spentPctRaw > 0 && spentPctRaw < 1 ? spentPctRaw.toFixed(1) : String(spentPct)
  const overrunTier = spentPct >= 100 ? 100 : spentPct >= 75 ? 75 : spentPct >= 50 ? 50 : 0
  const lagging = overrunTier > 0 && autoProgress < overrunTier
  const overBudget = spentPct >= 100
  const showAlert = overBudget || lagging
  const alertColor = overBudget || overrunTier >= 75 ? '#FF5353' : '#FF9B52'

  async function saveMeta() {
    setSavedOk(false); setSaveErr('')
    try {
      await onSaveMeta({ actualBudget: spent, progress: autoProgress })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed')
      setTimeout(() => setSaveErr(''), 4000)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(840px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FolderOpen size={16} style={{ color: ss.color }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>{proj.title}</p>
              <p style={{ fontSize: 11, color: '#B1B1BE' }}>{proj.clientName}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={onClose} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '10px 24px 0', borderBottom: '1px solid #F0F1F5', flexShrink: 0, overflowX: 'auto' }}>
          {([
            ['overview', 'Overview'],
            ['milestones', `Milestones (${data.milestones.length})`],
            ['gantt', 'Gantt Chart'],
            ['installations', 'Installations'],
            ['erp', 'ERP / Manufacturing'],
            ['billing', 'Billing'],
          ] as [typeof tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#5D78FF' : '#B1B1BE', borderBottom: `2px solid ${tab === t ? '#5D78FF' : 'transparent'}`, whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Overview */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Overrun alert banner */}
              {showAlert && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: alertColor + '14', border: `1px solid ${alertColor}40` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: alertColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>!</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: alertColor }}>
                      {overBudget ? 'Over budget' : `Spend crossed ${overrunTier}% of budget`}
                    </p>
                    <p style={{ fontSize: 11, color: '#374557', marginTop: 2 }}>
                      Spent {spentPct}% of {symbol}{budget.toLocaleString()} while progress is {autoProgress}%. Saving notifies Admin, Project Head & Business Head.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <StatCard label="Status" value={proj.uiStatus} color={ss.color} bg={ss.bg} />
                <StatCard label="Lead Age" value={`${ageD}d`} color="#5D78FF" bg="#E8EDFF" />
                <StatCard label="Time Left" value={daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`} color={daysLeft !== null && daysLeft < 0 ? '#FF5353' : '#2BC155'} bg={daysLeft !== null && daysLeft < 0 ? '#FFF0F0' : '#E7FAF0'} />
                <StatCard label="Progress" value={`${autoProgress}%`} color="#FF9B52" bg="#FFF5EE" />
              </div>

              {/* Budget: planned vs actual */}
              <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Budget vs Actual Spend</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: alertColor }}>{spentPctDisplay}% spent</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Planned (PO)</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#374557' }}>{budget ? `${symbol}${budget.toLocaleString()}` : '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Actual Spend</p>
                    <input type="number" min="0" value={actualBudget} onChange={e => setActualBudget(e.target.value)} placeholder="0"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 13, fontWeight: 700, color: '#374557', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {mrData && mrData.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={() => setActualBudget(String(mrPaid))} style={{ flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid #E8EDFF', background: '#F4F5F9', fontSize: 11, color: '#5D78FF', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <RefreshCw size={11} /> Auto-fill: Paid MRs ({symbol}{mrPaid.toLocaleString()})
                    </button>
                    {mrTotal !== mrPaid && (
                      <button onClick={() => setActualBudget(String(mrTotal))} style={{ flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid #F0F1F5', background: '#F4F5F9', fontSize: 11, color: '#374557', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={11} /> All MRs ({symbol}{mrTotal.toLocaleString()})
                      </button>
                    )}
                  </div>
                )}
                <div style={{ height: 8, borderRadius: 8, background: '#F0F1F5', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${Math.min(spentPctRaw, 100)}%`, background: spentPctRaw >= 100 ? '#FF5353' : spentPctRaw >= 75 ? '#FF9B52' : '#2BC155', borderRadius: 8, transition: 'width 0.3s' }} />
                </div>
                {saveErr && <p style={{ fontSize: 11, color: '#FF5353', marginBottom: 6, textAlign: 'center' }}>{saveErr}</p>}
                <button onClick={saveMeta} disabled={saving} style={{ width: '100%', padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: savedOk ? '#2BC155' : '#5D78FF', color: '#fff', cursor: 'pointer', transition: 'background 0.3s' }}>
                  {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save budget & progress'}
                </button>
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Overall Progress</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#5D78FF' }}>{autoProgress}%</p>
                </div>
                <div style={{ height: 10, borderRadius: 10, background: '#F0F1F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${autoProgress}%`, background: 'linear-gradient(90deg,#5D78FF,#2BC155)', borderRadius: 10, transition: 'width 0.3s' }} />
                </div>
                {data.milestones.length === 0 && (
                  <div style={{ marginTop: 10 }}>
                    <input type="range" min={0} max={100} value={data.progress}
                      onChange={e => update({ ...data, progress: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#5D78FF' }} />
                    <p style={{ fontSize: 10, color: '#B1B1BE', textAlign: 'center', marginTop: 2 }}>Drag to set manually · Add milestones for auto-tracking</p>
                  </div>
                )}
              </div>

              {/* Key info grid */}
              <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Start Date</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p></div>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>End Date</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.endDate?.slice(0, 10) ?? '—'}</p></div>
                <div style={{ gridColumn: '1 / -1' }}><AssignPMSE proj={proj} /></div>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Department</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.department?.name ?? '—'}</p></div>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Linked Deal</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.deal?.title ?? '—'}</p></div>
                {proj.warrantyPeriod && <>
                  <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Warranty Period</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.warrantyPeriod} months</p></div>
                  <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Warranty</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.warrantyStart?.slice(0, 10) ?? '?'} → {proj.warrantyEnd?.slice(0, 10) ?? '?'}</p></div>
                </>}
                {proj.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Notes</p>
                    <p style={{ fontSize: 12, color: '#374557', lineHeight: 1.6 }}>{proj.notes}</p>
                  </div>
                )}
              </div>

              {/* Cost breakdown (ERP fields) */}
              {(proj.purchaseCost || proj.manufacturingCost || proj.serviceCost || proj.totalExpenses) ? (
                <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 12 }}>COST BREAKDOWN</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                    {[
                      { label: 'Purchase', value: proj.purchaseCost, color: '#5D78FF', bg: '#E8EDFF' },
                      { label: 'Manufacturing', value: proj.manufacturingCost, color: '#A855F7', bg: '#F3E8FF' },
                      { label: 'Labour', value: proj.labourCost, color: '#06B6D4', bg: '#E0F7FA' },
                      { label: 'Installation', value: proj.installationCost, color: '#FF9B52', bg: '#FFF5EE' },
                      { label: 'Service', value: proj.serviceCost, color: '#EC4899', bg: '#FDF2F8' },
                    ].filter(i => i.value).map(item => (
                      <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: item.color, marginBottom: 3 }}>{item.label.toUpperCase()}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{symbol}{(item.value ?? 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {(proj.totalExpenses != null || proj.profit != null) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      {proj.totalExpenses != null && <div style={{ background: '#FFF0F0', borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#FF5353', marginBottom: 3 }}>TOTAL EXPENSES</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#FF5353' }}>{symbol}{proj.totalExpenses.toLocaleString()}</p>
                      </div>}
                      {proj.profit != null && <div style={{ background: proj.profit >= 0 ? '#E7FAF0' : '#FFF0F0', borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: proj.profit >= 0 ? '#2BC155' : '#FF5353', marginBottom: 3 }}>PROFIT</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: proj.profit >= 0 ? '#2BC155' : '#FF5353' }}>{symbol}{proj.profit.toLocaleString()}</p>
                      </div>}
                    </div>
                  )}
                </div>
              ) : null}

              <EditableProjectPanel proj={proj} symbol={symbol} onApplied={onApplied} />

              <TaskPanel entityType="Project" entityId={proj.id} title="Project Tasks" compact />

              {data.milestones.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Milestone Progress</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 8, background: '#F0F1F5', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${doneMs / data.milestones.length * 100}%`, background: '#2BC155', borderRadius: 8, transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ fontSize: 12, color: '#374557', whiteSpace: 'nowrap' }}>{doneMs} / {data.milestones.length} done</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestones */}
          {tab === 'milestones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: '#374557', marginBottom: 4 }}>Milestone</p>
                  <input value={msText} onChange={e => setMsText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMs()}
                    placeholder="e.g. Site survey complete" style={inp(false)} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#374557', marginBottom: 4 }}>Due date</p>
                  <input type="date" value={msDate} onChange={e => setMsDate(e.target.value)} style={{ ...inp(false), width: 148 }} />
                </div>
                <button onClick={addMs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <Plus size={13} /> Add
                </button>
              </div>

              {data.milestones.length === 0
                ? <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 32 }}>No milestones yet.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.milestones.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${m.done ? '#2BC155' : '#F0F1F5'}`, background: m.done ? '#F0FDF7' : '#FAFBFF' }}>
                        <button onClick={() => toggleMs(m.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${m.done ? '#2BC155' : '#D5D5D5'}`, background: m.done ? '#2BC155' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          {m.done && <Check size={12} color="#fff" />}
                        </button>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: '#374557', textDecoration: m.done ? 'line-through' : 'none', opacity: m.done ? 0.5 : 1 }}>{m.text}</p>
                          {m.dueDate && <p style={{ fontSize: 10, color: '#B1B1BE' }}>Due {m.dueDate}</p>}
                        </div>
                        <button onClick={() => deleteMs(m.id)} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* Gantt */}
          {tab === 'gantt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <GanttCanvas tasks={data.ganttTasks} projectId={proj.id} />

              {data.ganttTasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.ganttTasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', background: '#FAFBFF' }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{t.name}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{t.start} → {t.end} · {t.progress}%</p>
                      </div>
                      <button onClick={() => editGt(t)} style={{ color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={12} /></button>
                      <button onClick={() => deleteGt(t.id)} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/edit task form */}
              <div style={{ background: '#F8F9FF', borderRadius: 12, padding: 16, border: '1px solid #E8EDFF' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>{editGtId ? 'Edit Task' : 'Add Task'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={gtForm.name} onChange={e => setGtForm({ ...gtForm, name: e.target.value })} placeholder="Task name" style={inp(false)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 3 }}>Start</p>
                      <input type="date" value={gtForm.start} onChange={e => setGtForm({ ...gtForm, start: e.target.value })} style={inp(false)} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 3 }}>End</p>
                      <input type="date" value={gtForm.end} onChange={e => setGtForm({ ...gtForm, end: e.target.value })} style={inp(false)} />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Progress — {gtForm.progress}%</p>
                    <input type="range" min={0} max={100} value={gtForm.progress} onChange={e => setGtForm({ ...gtForm, progress: Number(e.target.value) })} style={{ width: '100%', accentColor: gtForm.color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 6 }}>Color</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {GANTT_COLORS.map(c => (
                        <button key={c} onClick={() => setGtForm({ ...gtForm, color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: `3px solid ${gtForm.color === c ? '#374557' : 'transparent'}`, cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editGtId && (
                      <button onClick={() => { setEditGtId(null); setGtForm({ name: '', start: defaultStart, end: defaultEnd, progress: 0, color: GANTT_COLORS[0] }) }}
                        style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                    )}
                    <button onClick={saveGt} style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      {editGtId ? 'Update Task' : '+ Add Task'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Installations */}
          {tab === 'installations' && (
            <InstallationsTab projectId={proj.id} />
          )}

          {/* ERP / Manufacturing */}
          {tab === 'erp' && (
            <ProjectERPTab projectId={proj.id} symbol={symbol} />
          )}

          {/* Billing */}
          {tab === 'billing' && (
            <ProjectBillingTab projectId={proj.id} symbol={symbol} />
          )}

        </div>
      </div>
    </div>
  )
}

// ─── AssignPMSE ───────────────────────────────────────────────────────────────

function AssignPMSE({ proj }: { proj: ProjectWithUI }) {
  const can = useAuthStore(s => s.can)
  const { data: users = [] } = useUsers(can('hr_user', 'read_all'))
  const assign = useAssignProject()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [pmId, setPmId] = useState(proj.assignedPMId ?? '')
  const [seId, setSeId] = useState(proj.assignedSEId ?? '')

  const engineers = users.filter((u: any) => ['Engineer', 'SeniorEngineer', 'ServiceEngineer'].includes(u.role))
  const managers = users.filter((u: any) => ['Manager', 'ProjectHead', 'SuperAdmin', 'BusinessHead'].includes(u.role))

  async function save() {
    await assign.mutateAsync({ id: proj.id, assignedPMId: pmId || null, assignedSEId: seId || null })
    qc.invalidateQueries({ queryKey: ['projects'] })
    setEditing(false)
  }

  if (!editing) return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Project Manager</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.assignedPM?.name ?? '—'}</p>
          <button onClick={() => setEditing(true)} style={{ fontSize: 10, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Service Engineer</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.assignedSE?.name ?? '—'}</p>
          {!proj.assignedPM && <button onClick={() => setEditing(true)} style={{ fontSize: 10, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>Assign PM & Engineer</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Project Manager</p>
          <select value={pmId} onChange={e => setPmId(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}>
            <option value="">— None —</option>
            {managers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Service Engineer</p>
          <select value={seId} onChange={e => setSeId(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}>
            <option value="">— None —</option>
            {engineers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={assign.isPending} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{assign.isPending ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

// ─── InstallationsTab ─────────────────────────────────────────────────────────

const INST_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Scheduled: { bg: '#E8EDFF', color: '#5D78FF' },
  InProgress: { bg: '#FFF5EE', color: '#FF9B52' },
  Completed: { bg: '#E7FAF0', color: '#2BC155' },
  OnHold: { bg: '#F4F5F9', color: '#8C8C8C' },
}
const INST_STATUS_LABEL: Record<string, string> = { Scheduled: 'Scheduled', InProgress: 'In Progress', Completed: 'Completed', OnHold: 'On Hold' }

function InstallationsTab({ projectId }: { projectId: string }) {
  const { data: installs = [], isLoading } = useInstallations({ projectId })
  const updateStatus = useUpdateInstallationStatus()
  const deleteInstall = useDeleteInstallation()
  const createInstall = useCreateInstallation()
  const { accounts } = useCrmData()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', scheduledDate: '', notes: '' })

  async function handleCreate() {
    if (!form.title.trim()) return
    const proj = accounts[0]
    await createInstall.mutateAsync({ title: form.title, projectId, scheduledDate: form.scheduledDate || undefined, notes: form.notes || undefined, companyId: proj?.id ?? '' })
    setForm({ title: '', scheduledDate: '', notes: '' }); setShowForm(false)
  }

  if (isLoading) return <div style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 32 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={13} /> New Installation
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#F8F9FF', borderRadius: 12, padding: 16, border: '1px solid #E8EDFF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, color: '#374557', marginBottom: 4 }}>Title *</p>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Site A Installation" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#374557', marginBottom: 4 }}>Scheduled Date</p>
              <input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: '#374557', marginBottom: 4 }}>Notes</p>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreate} disabled={createInstall.isPending} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{createInstall.isPending ? 'Adding…' : 'Add Installation'}</button>
          </div>
        </div>
      )}

      {installs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 32 }}>No installations for this project yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {installs.map(inst => {
            const ss = INST_STATUS_STYLE[inst.status] ?? INST_STATUS_STYLE.Scheduled
            return (
              <div key={inst.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #F0F1F5', background: '#FAFBFF', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: ss.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wrench size={13} style={{ color: ss.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{inst.title}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>{inst.scheduledDate?.slice(0, 10) ?? 'No date'}{inst.notes ? ` · ${inst.notes}` : ''}</p>
                </div>
                <select
                  value={inst.status}
                  onChange={e => updateStatus.mutate({ id: inst.id, status: e.target.value as any })}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, border: 'none', background: ss.bg, color: ss.color, cursor: 'pointer' }}
                >
                  {Object.entries(INST_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => { if (confirm('Delete this installation?')) deleteInstall.mutate(inst.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ProjectERPTab ────────────────────────────────────────────────────────────

const INVOICE_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#F4F5F9', color: '#8C8C8C' },
  Unpaid: { bg: '#FFF3F3', color: '#FF5353' },
  Sent: { bg: '#E8EDFF', color: '#5D78FF' },
  PartiallyPaid: { bg: '#FFF5EE', color: '#FF9B52' },
  Paid: { bg: '#E7FAF0', color: '#2BC155' },
  Overdue: { bg: '#FFF0F0', color: '#FF5353' },
  Scheduled: { bg: '#E8EDFF', color: '#5D78FF' },
  Processing: { bg: '#FFF5EE', color: '#FF9B52' },
  Cancelled: { bg: '#F4F5F9', color: '#B1B1BE' },
}

function ProjectBillingTab({ projectId, symbol }: { projectId: string; symbol: string }) {
  const can = useAuthStore(s => s.can)
  const { data: billing, isLoading, isError } = useProjectBilling(projectId)
  const generateInvoice = useGenerateProjectInvoice(projectId)
  const recordPayment = useRecordPayment(projectId)
  const sendInvoice = useSendInvoice(projectId)
  const cancelInvoice = useCancelInvoice(projectId)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [payFor, setPayFor] = useState<BillingInvoice | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const canGenerate = can('invoice', 'create')
  const canEdit = can('invoice', 'edit')
  const canCancel = can('invoice', 'delete')

  if (isLoading) return <div style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 40 }}>Loading billing data…</div>
  if (isError || !billing) return <div style={{ textAlign: 'center', color: '#FF5353', fontSize: 12, padding: 40 }}>Failed to load billing data.</div>

  const marginColor = billing.margin >= 20 ? '#2BC155' : billing.margin >= 0 ? '#FF9B52' : '#FF5353'
  const invoices = billing.invoices.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false
    if (search && !i.number.toLowerCase().includes(search.toLowerCase()) && !i.customer.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function doGenerate() {
    try {
      await generateInvoice.mutateAsync()
      toast.success('Draft invoice generated')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to generate invoice')
    }
  }

  async function doRecordPayment() {
    if (!payFor || !payAmount || Number(payAmount) <= 0) { toast.error('Enter a valid amount'); return }
    await recordPayment.mutateAsync({ invoiceId: payFor.id, amount: Number(payAmount) })
    toast.success('Payment recorded')
    setPayFor(null); setPayAmount('')
  }

  const kpi = (label: string, value: string, color: string) => (
    <div style={{ background: '#fff', border: '1px solid #F0F1F5', borderRadius: 12, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {kpi('Total Cost', `${symbol}${billing.costs.totalCost.toLocaleString()}`, '#374557')}
        {kpi('Revenue', `${symbol}${billing.revenue.toLocaleString()}`, '#5D78FF')}
        {kpi('Outstanding', `${symbol}${billing.outstanding.toLocaleString()}`, '#FF9B52')}
        {kpi('Profit', `${symbol}${billing.profit.toLocaleString()}`, billing.profit >= 0 ? '#2BC155' : '#FF5353')}
        {kpi('Margin', `${billing.margin.toFixed(1)}%`, marginColor)}
      </div>

      {/* Billable summary */}
      <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, border: '1px solid #F0F1F5' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 12 }}>BILLABLE SUMMARY</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
          {[
            ['Purchase', billing.costs.purchaseCost], ['Manufacturing', billing.costs.manufacturingCost],
            ['Labour', billing.costs.labourCost], ['Service', billing.costs.serviceCost],
            ['Installation', billing.costs.installationCost], ['Other', billing.costs.otherExpenses],
          ].filter(([, v]) => (v as number) > 0).map(([label, value]) => (
            <div key={label as string} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #F0F1F5' }}>
              <p style={{ fontSize: 10, color: '#8A8FA8', marginBottom: 3 }}>{label as string}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{symbol}{(value as number).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '10px 12px' }}><p style={{ fontSize: 10, color: '#5D78FF', marginBottom: 3 }}>UNINVOICED</p><p style={{ fontSize: 13, fontWeight: 700, color: '#5D78FF' }}>{symbol}{billing.uninvoiced.toLocaleString()}</p></div>
        </div>
        {canGenerate && billing.uninvoiced > 0 && (
          <button onClick={doGenerate} disabled={generateInvoice.isPending} style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: generateInvoice.isPending ? 0.6 : 1 }}>
            {generateInvoice.isPending ? 'Generating…' : `Generate Invoice for ${symbol}${billing.uninvoiced.toLocaleString()}`}
          </button>
        )}
      </div>

      {/* Invoices table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374557' }}>Project Invoices ({invoices.length})</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, outline: 'none' }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12 }}>
              <option value="">All statuses</option>
              {Object.keys(INVOICE_STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {invoices.length === 0 ? (
          <p style={{ fontSize: 12, color: '#B1B1BE', textAlign: 'center', padding: 24, background: '#fff', borderRadius: 10, border: '1px solid #F0F1F5' }}>No invoices yet for this project.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFBFF', textAlign: 'left' }}>
                  {['Number', 'Date', 'Status', 'Amount', 'Paid', 'Outstanding', 'Due', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', color: '#B1B1BE', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const ss = INVOICE_STATUS_STYLE[inv.status] ?? INVOICE_STATUS_STYLE.Draft
                  const outstandingAmt = inv.amount - inv.paidAmount
                  return (
                    <tr key={inv.id} style={{ borderTop: '1px solid #F4F5F9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374557' }}>{inv.number}</td>
                      <td style={{ padding: '8px 12px', color: '#8A8FA8' }}>{inv.date.slice(0, 10)}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>{inv.status}</span></td>
                      <td style={{ padding: '8px 12px', color: '#374557' }}>{symbol}{inv.amount.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: '#2BC155' }}>{symbol}{inv.paidAmount.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: outstandingAmt > 0 ? '#FF5353' : '#374557' }}>{symbol}{outstandingAmt.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: '#8A8FA8' }}>{inv.dueDate?.slice(0, 10) ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {canEdit && inv.status === 'Draft' && (
                            <button onClick={() => sendInvoice.mutate(inv.id)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#EEF2FF', color: '#5D78FF', cursor: 'pointer' }}>Send</button>
                          )}
                          {canEdit && !['Paid', 'Cancelled'].includes(inv.status) && (
                            <button onClick={() => { setPayFor(inv); setPayAmount(String(outstandingAmt)) }} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#E7FAF0', color: '#2BC155', cursor: 'pointer' }}>Pay</button>
                          )}
                          {canCancel && inv.status !== 'Cancelled' && (
                            <button onClick={() => { if (confirm('Cancel this invoice?')) cancelInvoice.mutate(inv.id) }} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#FFF0F0', color: '#FF5353', cursor: 'pointer' }}>Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #F0F1F5', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px', color: '#374557' }} colSpan={3}>Totals</td>
                  <td style={{ padding: '8px 12px', color: '#374557' }}>{symbol}{invoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#2BC155' }}>{symbol}{invoices.reduce((s, i) => s + i.paidAmount, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#FF5353' }}>{symbol}{invoices.reduce((s, i) => s + (i.amount - i.paidAmount), 0).toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Record payment modal */}
      {payFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, width: 'min(340px, 100%)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374557', marginBottom: 4 }}>Record Payment</p>
            <p style={{ fontSize: 12, color: '#8A8FA8', marginBottom: 14 }}>Invoice #{payFor.number} — outstanding {symbol}{(payFor.amount - payFor.paidAmount).toLocaleString()}</p>
            <input type="number" min="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Amount" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPayFor(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={doRecordPayment} disabled={recordPayment.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>{recordPayment.isPending ? 'Saving…' : 'Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectERPTab({ projectId, symbol }: { projectId: string; symbol: string }) {
  const { data: erp, isLoading } = useProjectERP(projectId)
  const complete = useCompleteProject()
  const cancel = useCancelProject()
  const qc = useQueryClient()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)

  if (isLoading) return <div style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 40 }}>Loading ERP data…</div>

  async function doComplete() {
    await complete.mutateAsync(projectId)
    qc.invalidateQueries({ queryKey: ['projects'] })
    setConfirmComplete(false)
  }
  async function doCancel() {
    await cancel.mutateAsync({ id: projectId, reason: cancelReason })
    qc.invalidateQueries({ queryKey: ['projects'] })
    setShowCancelModal(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setConfirmComplete(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#2BC155', color: '#fff', cursor: 'pointer' }}>
          <Shield size={14} /> Complete Project
        </button>
        <button onClick={() => setShowCancelModal(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1.5px solid #FF5353', background: '#FFF0F0', color: '#FF5353', cursor: 'pointer' }}>
          <XCircle size={14} /> Cancel Project
        </button>
      </div>

      {/* BOMs */}
      {erp?.boms?.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 8 }}>BILL OF MATERIALS</p>
          {erp.boms.map((bom: any) => (
            <div key={bom.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #F0F1F5', marginBottom: 6, background: '#FAFBFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{bom.refNumber}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>{bom.items?.length ?? 0} items · {bom.status}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bom.status === 'Approved' ? '#E7FAF0' : '#F4F5F9', color: bom.status === 'Approved' ? '#2BC155' : '#8C8C8C' }}>{bom.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Purchase Orders */}
      {erp?.boms?.flatMap((b: any) => b.purchaseOrders ?? []).length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 8 }}>PURCHASE ORDERS</p>
          {erp.boms.flatMap((b: any) => b.purchaseOrders ?? []).map((po: any) => (
            <div key={po.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #F0F1F5', marginBottom: 6, background: '#FAFBFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{po.refNumber} · {po.supplierName}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>{symbol}{po.totalAmount?.toLocaleString()} · {po.status}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: po.status === 'Delivered' ? '#E7FAF0' : po.status === 'Approved' ? '#E8EDFF' : '#F4F5F9', color: po.status === 'Delivered' ? '#2BC155' : po.status === 'Approved' ? '#5D78FF' : '#8C8C8C', whiteSpace: 'nowrap' as const }}>{po.status}</span>
                {['Approved', 'Delivered', 'Closed'].includes(po.status) && (
                  <PDFDownloadLink
                    document={<PurchaseOrderPDF refNumber={po.refNumber} date={po.createdAt ?? new Date().toISOString()} status={po.status} supplierName={po.supplierName} subtotal={po.subtotal ?? 0} taxAmount={(po.totalAmount ?? 0) - (po.subtotal ?? po.totalAmount ?? 0)} totalAmount={po.totalAmount ?? 0} items={(po.items ?? []).map((i: any) => ({ description: i.itemName ?? i.description ?? '', quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice ?? 0, totalPrice: i.amount ?? i.totalPrice ?? 0 }))} logoUrl={`${window.location.origin}/aspcv-logo.png`} />}
                    fileName={`PO-${po.refNumber}.pdf`}
                    style={{ textDecoration: 'none' }}
                  >
                    {({ loading }: { loading: boolean }) => (
                      <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: 'none', background: '#E8EDFF', color: '#5D78FF', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                        <Download size={11} /> {loading ? '…' : 'PDF'}
                      </button>
                    )}
                  </PDFDownloadLink>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Work Orders */}
      {erp?.workOrders?.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 8 }}>WORK ORDERS</p>
          {erp.workOrders.map((wo: any) => (
            <div key={wo.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #F0F1F5', marginBottom: 6, background: '#FAFBFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{wo.refNumber} · {wo.title}</p>
                  <p style={{ fontSize: 11, color: '#B1B1BE' }}>Material: {symbol}{(wo.materialCost ?? 0).toLocaleString()} · Labour: {symbol}{(wo.labourCost ?? 0).toLocaleString()}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: wo.status === 'Finished' ? '#E7FAF0' : '#E8EDFF', color: wo.status === 'Finished' ? '#2BC155' : '#5D78FF' }}>{wo.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service */}
      {erp?.serviceRecord && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#B1B1BE', letterSpacing: 0.8, marginBottom: 8 }}>SERVICE RECORD</p>
          <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #F0F1F5', background: '#FAFBFF' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>Warranty: {erp.serviceRecord.warrantyStart ? new Date(erp.serviceRecord.warrantyStart).toLocaleDateString() : '?'} → {erp.serviceRecord.warrantyEnd ? new Date(erp.serviceRecord.warrantyEnd).toLocaleDateString() : '?'}</p>
            <p style={{ fontSize: 11, color: '#B1B1BE', marginTop: 2 }}>{erp.serviceRecord.serviceRequests?.length ?? 0} service requests · Cost: {symbol}{(erp.serviceRecord.serviceCost ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {!erp?.boms?.length && !erp?.workOrders?.length && !erp?.serviceRecord && (
        <div style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 32 }}>
          <Cpu size={28} style={{ color: '#E0E0E0', marginBottom: 8 }} />
          <p>No ERP activity yet for this project.</p>
        </div>
      )}

      {/* Confirm Complete modal */}
      {confirmComplete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Complete Project?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>Project will be locked and moved to Completed archive and Service page.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmComplete(false)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={doComplete} disabled={complete.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#2BC155', color: '#fff', cursor: 'pointer' }}>{complete.isPending ? 'Completing…' : 'Yes, Complete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Cancel Project?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 12 }}>Components will be reclassified (semi-finished / finished goods) based on manufacturing stage.</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (optional)" rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Back</button>
              <button onClick={doCancel} disabled={cancel.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>{cancel.isPending ? 'Cancelling…' : 'Cancel Project'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Projects() {
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()
  const can = useAuthStore(s => s.can)
  const canCreate = can('project', 'create')
  const canEdit = can('project', 'edit')
  const canDelete = can('project', 'delete')

  const { data: rawProjects = [], isLoading, isError, refetch } = useProjects()
  const { data: departments = [] } = useDepartments()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const updateStatus = useUpdateProjectStatus()
  const completeProjectQuick = useCompleteProject()
  const deleteProject = useDeleteProject()
  const qc = useQueryClient()
  const createMR = useMutation({
    mutationFn: (data: any) => api.post('/material-requests', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['material-requests'] }); setMrProject(null) },
  })

  function submitMR() {
    if (!mrProject) return
    const items = mrForm.items.filter(i => i.name.trim())
    if (!items.length) return
    createMR.mutate({
      projectId: mrProject.id,
      notes: mrForm.notes,
      totalEstimated: items.reduce((s, i) => s + (i.estimatedCost * i.qty), 0),
      items: items.map(i => ({ itemName: i.name, quantity: i.qty, unit: i.unit, estimatedCost: i.estimatedCost })),
    })
  }

  async function importProjects(rows: Record<string, string>[]) {
    let success = 0; const errors: string[] = []
    for (const row of rows) {
      const co = accounts.find(a => a.name.toLowerCase() === (row.Company ?? '').toLowerCase())
      if (!co) { errors.push(`"${row.Title}": company "${row.Company}" not found`); continue }
      try {
        await createProject.mutateAsync({ title: row.Title, companyId: co.id, status: PROJ_STATUS_MAP[(row.Status ?? '').toLowerCase()] ?? 'Planning', startDate: row.StartDate || undefined, endDate: row.EndDate || undefined, budget: row.Budget ? Number(row.Budget) : undefined, notes: row.Notes || undefined })
        success++
      } catch (e: unknown) { errors.push(`"${row.Title}": ${e instanceof Error ? e.message : 'Error'}`) }
    }
    return { total: rows.length, success, errors }
  }

  const [filter, setFilter] = useState<'All' | UIStatus>('All')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedProj, setSelectedProj] = useState<ProjectWithUI | null>(null)
  const [mrProject, setMrProject] = useState<ProjectWithUI | null>(null)
  const [mrForm, setMrForm] = useState({ notes: '', items: [{ name: '', qty: 1, unit: '', estimatedCost: 0 }] })

  const projects = rawProjects.map(p => ({
    ...p, uiStatus: apiToUI[p.status] ?? 'Planning', clientName: p.company?.name ?? '',
  }))

  const searched = search.trim()
    ? projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase()))
    : projects
  const filtered = filter === 'All' ? searched : searched.filter(p => p.uiStatus === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)
  const activeCount = projects.filter(p => p.uiStatus === 'Active').length
  const atRiskCount = projects.filter(p => (p.alertTier ?? 0) > 0 && p.uiStatus !== 'Completed').length
  const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length) : 0

  function openCreate() {
    setEditId(null)
    setForm({ ...blankForm, client: accounts[0]?.name ?? '' })
    setFormErrors({}); setShowModal(true)
  }
  function openEdit(proj: ProjectWithUI) {
    setSelectedProj(null)
    setEditId(proj.id)
    setForm({ name: proj.title, client: proj.clientName, startDate: proj.startDate?.slice(0, 10) ?? '', endDate: proj.endDate?.slice(0, 10) ?? '', status: proj.uiStatus, budget: String(proj.budget ?? ''), description: proj.notes ?? '', departmentId: proj.departmentId ?? proj.department?.id ?? '' })
    setFormErrors({}); setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditId(null); setForm(blankForm); setFormErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Project name required'
    if (!form.client.trim()) e.client = 'Client required'
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'End must be after start'
    if (form.budget && (isNaN(Number(form.budget)) || Number(form.budget) < 0)) e.budget = 'Valid budget required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setFormErrors(e); return }
    const co = accounts.find(a => a.name.toLowerCase() === form.client.toLowerCase())
    if (!co) { setFormErrors({ client: 'Company not found — create it in Accounts first' }); return }
    const payload = { companyId: co.id, title: form.name, status: uiToAPI[form.status], startDate: form.startDate || undefined, endDate: form.endDate || undefined, budget: form.budget ? Number(form.budget) : undefined, notes: form.description || undefined, departmentId: form.departmentId || undefined }
    if (editId) await updateProject.mutateAsync({ id: editId, ...payload })
    else await createProject.mutateAsync(payload)
    closeModal()
  }

  async function handleDelete(id: string) { await deleteProject.mutateAsync(id); setMenuOpen(null); setDeleteConfirm(null); setPage(1) }
  async function quickStatus(id: string, s: UIStatus) {
    if (s === 'Completed') await completeProjectQuick.mutateAsync(id)
    else await updateStatus.mutateAsync({ id, status: uiToAPI[s] })
    setMenuOpen(null)
  }
  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  if (isLoading) return <Spinner />
  if (isError) return (
    <EmptyState icon={AlertTriangle} title="Failed to load projects" subtitle="Something went wrong fetching this data."
      action={<button onClick={() => refetch()} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      <SectionHeader
        icon={FolderKanban}
        title="Projects"
        subtitle={`${projects.length} total · ${activeCount} active`}
        actions={
          <>
            <CsvImportExport data={rawProjects} columns={PROJ_CSV_COLS} filename="projects.csv" templateRow={PROJ_CSV_TEMPLATE} onImport={importProjects} compact={isMobile} />
            {canCreate && (
              <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Plus size={14} /> New Project
              </button>
            )}
          </>
        }
      />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard label="Total Budget" value={`${symbol}${(totalBudget / 1000).toFixed(0)}k`} icon={Wallet} accent="#5D78FF" />
        <KpiCard label="Active Projects" value={activeCount} icon={Play} accent="#2BC155"
          onClick={() => changeFilter(filter === 'Active' ? 'All' : 'Active')} active={filter === 'Active'} />
        <KpiCard label="Needs Attention" value={atRiskCount} icon={AlertOctagon} accent={atRiskCount > 0 ? '#FF5353' : '#8C93A6'}
          trend={atRiskCount > 0 ? { value: 'over budget', direction: 'down' } : undefined} />
        <KpiCard label="Avg. Progress" value={`${avgProgress}%`} icon={TrendingUp} accent="#FF9B52" />
      </div>

      <Toolbar
        search={search}
        onSearchChange={v => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search projects, clients…"
      >
        <FilterChips
          options={[
            { value: 'All', label: 'All', count: projects.length },
            ...uiStatuses.map(s => ({ value: s, label: s, count: projects.filter(p => p.uiStatus === s).length })),
          ]}
          value={filter}
          onChange={v => changeFilter(v as typeof filter)}
        />
      </Toolbar>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 340px)', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
              {paginated.map(proj => (
                <div key={proj.id} onClick={() => setSelectedProj(proj)} style={{ background: '#FAFBFF', borderRadius: 12, border: '1px solid #F0F1F5', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: statusStyle[proj.uiStatus].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FolderOpen size={14} style={{ color: statusStyle[proj.uiStatus].color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374557' }}>{proj.title}</p>
                        <p style={{ fontSize: 10, color: '#B1B1BE' }}>{proj.clientName}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[proj.uiStatus].bg, color: statusStyle[proj.uiStatus].color }}>{proj.uiStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Start</p><p style={{ fontSize: 11, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p></div>
                    <div><p style={{ fontSize: 9, color: '#B1B1BE' }}>Budget</p><p style={{ fontSize: 11, fontWeight: 700, color: '#374557' }}>{proj.budget ? `${symbol}${proj.budget.toLocaleString()}` : '—'}</p></div>
                  </div>
                </div>
              ))}
              {paginated.length === 0 && (
                <EmptyState icon={FolderKanban}
                  title={projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
                  subtitle={projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your search or status filter.'}
                />
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F4F5F9' }}>
                  {['Project', 'Client', 'Timeline', 'Budget', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#B1B1BE' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((proj, i) => (
                  <tr key={proj.id} onClick={() => setSelectedProj(proj)} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F4F5F9' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: statusStyle[proj.uiStatus].bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FolderOpen size={14} style={{ color: statusStyle[proj.uiStatus].color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{proj.title}</p>
                          <p style={{ fontSize: 10, color: '#B1B1BE' }}>{proj.notes ? proj.notes.substring(0, 40) + '…' : proj.deal?.title ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#374557' }}>{proj.clientName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 10, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p>
                      <p style={{ fontSize: 10, color: '#B1B1BE' }}>→ {proj.endDate?.slice(0, 10) ?? '—'}</p>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#374557' }}>
                      {proj.budget ? `${symbol}${proj.budget.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle[proj.uiStatus].bg, color: statusStyle[proj.uiStatus].color }}>{proj.uiStatus}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === proj.id ? null : proj.id) }} style={{ color: '#D5D5D5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {menuOpen === proj.id && (
                          <div style={dropdownStyle}>
                            {canEdit && <button onClick={() => openEdit(proj)} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>}
                            {canEdit && <button onClick={() => { setMrProject(proj); setMrForm({ notes: '', items: [{ name: '', qty: 1, unit: '', estimatedCost: 0 }] }); setMenuOpen(null) }} style={menuItem}><ClipboardList size={12} style={{ marginRight: 8 }} />Request Materials</button>}
                            {canEdit && <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />}
                            {canEdit && <button onClick={() => quickStatus(proj.id, 'Completed')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Completed</button>}
                            {canEdit && <button onClick={() => quickStatus(proj.id, 'Active')} style={menuItem}><Play size={12} style={{ marginRight: 6 }} />Mark Active</button>}
                            {canEdit && <button onClick={() => quickStatus(proj.id, 'On Hold')} style={menuItem}><Pause size={12} style={{ marginRight: 6 }} />Mark On Hold</button>}
                            {canDelete && <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />}
                            {canDelete && <button onClick={() => { setDeleteConfirm(proj.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>}
                            {!canEdit && !canDelete && <p style={{ padding: '8px 12px', fontSize: 11, color: '#B1B1BE' }}>View only</p>}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 0 }}>
                    <EmptyState icon={FolderKanban}
                      title={projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
                      subtitle={projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your search or status filter.'}
                      action={projects.length === 0 && canCreate ? <button onClick={openCreate} style={{ padding: '8px 16px', background: '#5D78FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>New Project</button> : undefined}
                    />
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {/* Detail modal */}
      {selectedProj && (
        <ProjectDetailModal
          proj={selectedProj}
          symbol={symbol}
          onClose={() => setSelectedProj(null)}
          onEdit={() => openEdit(selectedProj)}
          saving={updateProject.isPending}
          onSaveMeta={async ({ actualBudget, progress }) => {
            const updated = await updateProject.mutateAsync({ id: selectedProj.id, actualBudget, progress })
            setSelectedProj({ ...selectedProj, ...updated, uiStatus: apiToUI[(updated.status as ProjectAPI['status'])] ?? selectedProj.uiStatus, clientName: selectedProj.clientName })
          }}
          onApplied={(updated) => {
            qc.invalidateQueries({ queryKey: ['projects'] })
            setSelectedProj({ ...selectedProj, ...updated, uiStatus: apiToUI[(updated.status as ProjectAPI['status'])] ?? selectedProj.uiStatus, clientName: selectedProj.clientName })
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374557', marginBottom: 8 }}>Delete Project?</p>
            <p style={{ fontSize: 12, color: '#B1B1BE', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#FF5353', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374557' }}>{editId ? 'Edit Project' : 'New Project'}</p>
              <button onClick={closeModal} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Project Name *" error={formErrors.name}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ASHP Installation Phase 2" style={inp(!!formErrors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Client *" error={formErrors.client}>
                  <input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} list="proj-accounts-list" placeholder="Company name" style={inp(!!formErrors.client)} />
                  <datalist id="proj-accounts-list">{accounts.map(a => <option key={a.id} value={a.name} />)}</datalist>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as UIStatus })} style={inp(false)}>
                    {uiStatuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Start Date">
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} style={inp(false)} />
                </Field>
                <Field label="End Date" error={formErrors.endDate}>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} style={inp(!!formErrors.endDate)} />
                </Field>
              </div>
              <Field label={`Budget (${symbol})`} error={formErrors.budget}>
                <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="0" type="number" min="0" style={inp(!!formErrors.budget)} />
              </Field>
              <Field label="Department">
                <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} style={inp(false)}>
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Project description…" rows={3} style={{ ...inp(false), resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={createProject.isPending || updateProject.isPending} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer' }}>
                {(createProject.isPending || updateProject.isPending) ? 'Saving…' : editId ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Request Modal */}
      {mrProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374557' }}>Request Materials</p>
                <p style={{ fontSize: 11, color: '#B1B1BE' }}>{mrProject.title}</p>
              </div>
              <button onClick={() => setMrProject(null)} style={{ color: '#B1B1BE', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 12 }}>
              {mrForm.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    placeholder="Item name *"
                    value={item.name}
                    onChange={e => { const items = [...mrForm.items]; items[i] = { ...items[i], name: e.target.value }; setMrForm({ ...mrForm, items }) }}
                    style={{ flex: 2, padding: '7px 10px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}
                  />
                  <input
                    type="number" placeholder="Qty" min={1} value={item.qty}
                    onChange={e => { const items = [...mrForm.items]; items[i] = { ...items[i], qty: Number(e.target.value) }; setMrForm({ ...mrForm, items }) }}
                    style={{ width: 60, padding: '7px 8px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}
                  />
                  <input
                    placeholder="Unit"
                    value={item.unit}
                    onChange={e => { const items = [...mrForm.items]; items[i] = { ...items[i], unit: e.target.value }; setMrForm({ ...mrForm, items }) }}
                    style={{ width: 70, padding: '7px 8px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}
                  />
                  <input
                    type="number" placeholder="Est. Cost" min={0} value={item.estimatedCost || ''}
                    onChange={e => { const items = [...mrForm.items]; items[i] = { ...items[i], estimatedCost: Number(e.target.value) }; setMrForm({ ...mrForm, items }) }}
                    style={{ width: 90, padding: '7px 8px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557' }}
                  />
                  {mrForm.items.length > 1 && (
                    <button onClick={() => setMrForm({ ...mrForm, items: mrForm.items.filter((_, j) => j !== i) })} style={{ color: '#FF5353', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setMrForm({ ...mrForm, items: [...mrForm.items, { name: '', qty: 1, unit: '', estimatedCost: 0 }] })}
                style={{ fontSize: 11, color: '#5D78FF', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
              ><Plus size={12} /> Add Item</button>
            </div>

            <textarea
              placeholder="Notes (optional)"
              value={mrForm.notes}
              onChange={e => setMrForm({ ...mrForm, notes: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0F1F5', fontSize: 12, color: '#374557', resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setMrProject(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #F0F1F5', color: '#374557', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={submitMR}
                disabled={createMR.isPending}
                style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', background: '#5D78FF', color: '#fff', cursor: 'pointer', opacity: createMR.isPending ? 0.6 : 1 }}
              >{createMR.isPending ? 'Submitting…' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = { position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #F0F1F5', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden', padding: '4px 0' }
const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, color: '#374557', background: 'none', border: 'none', cursor: 'pointer' }

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
  return { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#FF5353' : '#F0F1F5'}`, fontSize: 12, color: '#374557', outline: 'none', background: '#fff', boxSizing: 'border-box' }
}
