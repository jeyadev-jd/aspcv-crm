import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrency } from '@/lib/currencyContext'
import { MoreHorizontal, X, Plus, ChevronLeft, ChevronRight, FolderOpen, Edit2, Trash2, CheckCircle2, Play, Pause, Loader2, Download, Check, RefreshCw } from 'lucide-react'
import type React from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useCrmData } from '@/lib/crmDataContext'
import { api } from '@/lib/api'
import { useProjects, useCreateProject, useUpdateProject, useUpdateProjectStatus, useDeleteProject, STATUS_LABEL } from '@/hooks/useProjects'
import type { ProjectAPI } from '@/hooks/useProjects'
import { CsvImportExport } from '@/components/shared/CsvImportExport'
import type { CsvColDef } from '@/components/shared/CsvImportExport'

// ─── Types ────────────────────────────────────────────────────────────────────

type UIStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed'
type ProjectWithUI = ProjectAPI & { uiStatus: UIStatus; clientName: string }
interface Milestone { id: string; text: string; done: boolean; dueDate?: string }
interface GanttTask  { id: string; name: string; start: string; end: string; progress: number; color: string }
interface ProjData   { progress: number; milestones: Milestone[]; ganttTasks: GanttTask[] }

// ─── CSV ──────────────────────────────────────────────────────────────────────

const PROJ_CSV_COLS: CsvColDef<ProjectAPI>[] = [
  { header: 'Title',     accessor: r => r.title },
  { header: 'Company',   accessor: r => r.company?.name ?? '' },
  { header: 'Status',    accessor: r => STATUS_LABEL[r.status] ?? r.status },
  { header: 'StartDate', accessor: r => r.startDate ?? '' },
  { header: 'EndDate',   accessor: r => r.endDate ?? '' },
  { header: 'Budget',    accessor: r => r.budget != null ? String(r.budget) : '' },
  { header: 'Notes',     accessor: r => r.notes ?? '' },
]
const PROJ_STATUS_MAP: Record<string, ProjectAPI['status']> = {
  planning: 'Planning', active: 'Active', 'on hold': 'OnHold', onhold: 'OnHold', completed: 'Completed',
}
const PROJ_CSV_TEMPLATE = { Title: 'Solar Installation Project', Company: 'Acme Corp', Status: 'Planning', StartDate: '2026-07-01', EndDate: '2026-12-31', Budget: '1000000', Notes: '' }

// ─── Style constants ──────────────────────────────────────────────────────────

const statusStyle: Record<UIStatus, { bg: string; color: string }> = {
  Planning:  { bg: '#E8EDFF', color: '#5D78FF' },
  Active:    { bg: '#E7FAF0', color: '#2BC155' },
  'On Hold': { bg: '#FFF5EE', color: '#FF9B52' },
  Completed: { bg: '#F4F5F9', color: '#8C8C8C' },
}
const apiToUI: Record<ProjectAPI['status'], UIStatus> = {
  Planning: 'Planning', Active: 'Active', OnHold: 'On Hold', Completed: 'Completed',
}
const uiToAPI: Record<UIStatus, ProjectAPI['status']> = {
  Planning: 'Planning', Active: 'Active', 'On Hold': 'OnHold', Completed: 'Completed',
}
const uiStatuses: UIStatus[] = ['Planning', 'Active', 'On Hold', 'Completed']
const blankForm = { name: '', client: '', startDate: '', endDate: '', status: 'Planning' as UIStatus, budget: '', description: '' }
const PAGE_SIZE = 5
const GANTT_COLORS = ['#5D78FF', '#2BC155', '#FF9B52', '#FF5353', '#A855F7', '#EC4899', '#06B6D4', '#84CC16']

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadProjData(id: string): ProjData {
  try { const r = localStorage.getItem(`proj_${id}`); if (r) return JSON.parse(r) } catch {}
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
  const maxMs = Math.max(...tasks.map(t => +new Date(t.end)))   + 7 * 864e5
  const span  = maxMs - minMs
  const x2d   = (ms: number) => LW + ((ms - minMs) / span) * (W - LW)

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
  const cvRef  = useRef<HTMLCanvasElement>(null)
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

// ─── ProjectDetailModal ───────────────────────────────────────────────────────

function ProjectDetailModal({ proj, symbol, onClose, onEdit, onSaveMeta, saving }: {
  proj: ProjectWithUI; symbol: string; onClose: () => void; onEdit: () => void
  onSaveMeta: (v: { actualBudget: number; progress: number }) => Promise<void>; saving: boolean
}) {
  const [tab, setTab] = useState<'overview' | 'milestones' | 'gantt'>('overview')
  const [data, setData] = useState<ProjData>(() => loadProjData(proj.id))
  const [actualBudget, setActualBudget] = useState<string>(proj.actualBudget != null ? String(proj.actualBudget) : '')
  const [savedOk, setSavedOk] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const { data: mrData } = useQuery<{ totalEstimated?: number | null; status: string }[]>({
    queryKey: ['material-requests', proj.id],
    queryFn: () => api.get(`/material-requests?projectId=${proj.id}`).then(r => r.data),
    staleTime: 30_000,
  })
  const mrTotal = mrData?.reduce((s, r) => s + (r.totalEstimated ?? 0), 0) ?? 0
  const mrPaid  = mrData?.filter(r => r.status === 'paid').reduce((s, r) => s + (r.totalEstimated ?? 0), 0) ?? 0

  const [msText, setMsText] = useState('')
  const [msDate, setMsDate] = useState('')

  const defaultStart = proj.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const defaultEnd   = proj.endDate?.slice(0, 10)   ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
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
  function deleteMs(id: string)  { update({ ...data, milestones: data.milestones.filter(m => m.id !== id) }) }

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
  function deleteGt(id: string)  { update({ ...data, ganttTasks: data.ganttTasks.filter(t => t.id !== id) }) }

  const doneMs  = data.milestones.filter(m => m.done).length
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
        <div style={{ display: 'flex', padding: '10px 24px 0', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          {(['overview', 'milestones', 'gantt'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#5D78FF' : '#B1B1BE', borderBottom: `2px solid ${tab === t ? '#5D78FF' : 'transparent'}`, whiteSpace: 'nowrap' }}>
              {t === 'overview' ? 'Overview' : t === 'milestones' ? `Milestones (${data.milestones.length})` : 'Gantt Chart'}
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
                <StatCard label="Status"    value={proj.uiStatus} color={ss.color} bg={ss.bg} />
                <StatCard label="Lead Age"  value={`${ageD}d`} color="#5D78FF" bg="#E8EDFF" />
                <StatCard label="Time Left" value={daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`} color={daysLeft !== null && daysLeft < 0 ? '#FF5353' : '#2BC155'} bg={daysLeft !== null && daysLeft < 0 ? '#FFF0F0' : '#E7FAF0'} />
                <StatCard label="Progress"  value={`${autoProgress}%`} color="#FF9B52" bg="#FFF5EE" />
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

              {/* Key info */}
              <div style={{ background: '#FAFBFF', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>Start Date</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.startDate?.slice(0, 10) ?? '—'}</p></div>
                <div><p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 2 }}>End Date</p><p style={{ fontSize: 13, fontWeight: 600, color: '#374557' }}>{proj.endDate?.slice(0, 10) ?? '—'}</p></div>
                {proj.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: 10, color: '#B1B1BE', marginBottom: 4 }}>Notes</p>
                    <p style={{ fontSize: 12, color: '#374557', lineHeight: 1.6 }}>{proj.notes}</p>
                  </div>
                )}
              </div>

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

        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Projects() {
  const isMobile = useIsMobile()
  const { symbol } = useCurrency()
  const { accounts } = useCrmData()

  const { data: rawProjects = [], isLoading } = useProjects()
  const createProject  = useCreateProject()
  const updateProject  = useUpdateProject()
  const updateStatus   = useUpdateProjectStatus()
  const deleteProject  = useDeleteProject()

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

  const [filter,        setFilter]        = useState<'All' | UIStatus>('All')
  const [showModal,     setShowModal]     = useState(false)
  const [editId,        setEditId]        = useState<string | null>(null)
  const [form,          setForm]          = useState(blankForm)
  const [formErrors,    setFormErrors]    = useState<Record<string, string>>({})
  const [menuOpen,      setMenuOpen]      = useState<string | null>(null)
  const [page,          setPage]          = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedProj,  setSelectedProj]  = useState<ProjectWithUI | null>(null)

  const projects = rawProjects.map(p => ({
    ...p, uiStatus: apiToUI[p.status], clientName: p.company?.name ?? '',
  }))

  const filtered   = filter === 'All' ? projects : projects.filter(p => p.uiStatus === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)

  function openCreate() {
    setEditId(null)
    setForm({ ...blankForm, client: accounts[0]?.name ?? '' })
    setFormErrors({}); setShowModal(true)
  }
  function openEdit(proj: ProjectWithUI) {
    setSelectedProj(null)
    setEditId(proj.id)
    setForm({ name: proj.title, client: proj.clientName, startDate: proj.startDate?.slice(0, 10) ?? '', endDate: proj.endDate?.slice(0, 10) ?? '', status: proj.uiStatus, budget: String(proj.budget ?? ''), description: proj.notes ?? '' })
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
    const payload = { companyId: co.id, title: form.name, status: uiToAPI[form.status], startDate: form.startDate || undefined, endDate: form.endDate || undefined, budget: form.budget ? Number(form.budget) : undefined, notes: form.description || undefined }
    if (editId) await updateProject.mutateAsync({ id: editId, ...payload })
    else await createProject.mutateAsync(payload)
    closeModal()
  }

  async function handleDelete(id: string) { await deleteProject.mutateAsync(id); setMenuOpen(null); setDeleteConfirm(null); setPage(1) }
  async function quickStatus(id: string, s: UIStatus) { await updateStatus.mutateAsync({ id, status: uiToAPI[s] }); setMenuOpen(null) }
  function changeFilter(f: typeof filter) { setFilter(f); setPage(1) }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <Loader2 size={24} style={{ color: '#5D78FF', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'stretch' : 'flex-start', minHeight: 'calc(100vh - 120px)', flex: 1 }}>
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(null)} />}

      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky' as const, top: 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#B1B1BE', marginBottom: 4 }}>Total Budget</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#374557' }}>{symbol}{(totalBudget / 1000).toFixed(0)}k</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374557', marginBottom: 12 }}>By Status</p>
          {uiStatuses.map(s => {
            const count = projects.filter(p => p.uiStatus === s).length
            return (
              <div key={s} onClick={() => changeFilter(filter === s ? 'All' : s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyle[s].color }} />
                  <p style={{ fontSize: 11, color: '#374557' }}>{s}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374557' }}>{count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => changeFilter('All')} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === 'All' ? '#5D78FF' : '#F4F5F9', color: filter === 'All' ? '#fff' : '#B1B1BE' }}>All</button>
            {uiStatuses.map(s => <button key={s} onClick={() => changeFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === s ? '#5D78FF' : '#F4F5F9', color: filter === s ? '#fff' : '#B1B1BE' }}>{s}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CsvImportExport data={rawProjects} columns={PROJ_CSV_COLS} filename="projects.csv" templateRow={PROJ_CSV_TEMPLATE} onImport={importProjects} compact={isMobile} />
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#5D78FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> New Project
            </button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F1F5', overflow: 'hidden', flex: 1, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
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
              {paginated.length === 0 && <p style={{ textAlign: 'center', color: '#B1B1BE', fontSize: 12, padding: 24 }}>No projects found.</p>}
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
                            <button onClick={() => openEdit(proj)} style={menuItem}><Edit2 size={12} style={{ marginRight: 8 }} />Edit</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => quickStatus(proj.id, 'Completed')} style={menuItem}><CheckCircle2 size={12} style={{ marginRight: 6 }} />Mark Completed</button>
                            <button onClick={() => quickStatus(proj.id, 'Active')} style={menuItem}><Play size={12} style={{ marginRight: 6 }} />Mark Active</button>
                            <button onClick={() => quickStatus(proj.id, 'On Hold')} style={menuItem}><Pause size={12} style={{ marginRight: 6 }} />Mark On Hold</button>
                            <div style={{ borderTop: '1px solid #F4F5F9', margin: '4px 0' }} />
                            <button onClick={() => { setDeleteConfirm(proj.id); setMenuOpen(null) }} style={{ ...menuItem, color: '#FF5353' }}><Trash2 size={12} style={{ marginRight: 8 }} />Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#B1B1BE', fontSize: 12 }}>No projects found.</td></tr>}
              </tbody>
            </table>
          )}
          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F4F5F9' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === 1 ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === 1 ? 'default' : 'pointer' }}><ChevronLeft size={13} /> Prev</button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setPage(pg)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === pg ? '#5D78FF' : 'transparent', color: page === pg ? '#fff' : '#B1B1BE' }}>{pg}</button>
              ))}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #F0F1F5', color: page === totalPages ? '#D5D5D5' : '#374557', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}>Next <ChevronRight size={13} /></button>
          </div>
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
