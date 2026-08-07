import ExcelJS from 'exceljs'

/**
 * One column of an importable/exportable entity. `parse` converts the raw cell
 * text to the Prisma value; returning undefined leaves the field unset. A field
 * with no `parse` is export-only (computed or relation labels).
 */
export interface FieldSpec {
  /** Column header shown in the sheet and expected on import. */
  header: string
  /** Dot-path used to read the value when exporting. */
  path: string
  required?: boolean
  parse?: (raw: string) => unknown
  /** Skips this column when generating the import template. */
  exportOnly?: boolean
}

export interface EntitySpec {
  label: string
  fields: FieldSpec[]
}

const text = (raw: string) => (raw.trim() === '' ? undefined : raw.trim())

const bool = (raw: string) => {
  const v = raw.trim().toLowerCase()
  if (v === '') return undefined
  return ['true', 'yes', 'y', '1', 'active'].includes(v)
}

const num = (raw: string) => {
  const v = raw.trim().replace(/,/g, '')
  if (v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const date = (raw: string) => {
  const v = raw.trim()
  if (v === '') return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Reads a dot-path off a nested object, tolerating nulls along the way. */
function readPath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, row)
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // ExcelJS rich text / hyperlink cells.
    const rich = value as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (typeof rich.text === 'string') return rich.text
    if (rich.richText) return rich.richText.map((t) => t.text).join('')
    if (rich.result !== undefined) return String(rich.result)
    return ''
  }
  return String(value)
}

export const ENTITY_SPECS: Record<string, EntitySpec> = {
  companies: {
    label: 'Companies',
    fields: [
      { header: 'Name', path: 'name', required: true, parse: text },
      { header: 'Nickname', path: 'nickname', parse: text },
      { header: 'Industry', path: 'industry', parse: text },
      { header: 'Customer Type', path: 'customerType', parse: (r) => (r.trim() === '' ? undefined : r.trim()) },
      { header: 'Region', path: 'region', parse: text },
      { header: 'Country', path: 'country', parse: text },
      { header: 'State', path: 'state', parse: text },
      { header: 'City', path: 'city', parse: text },
      { header: 'Area', path: 'area', parse: text },
      { header: 'Website', path: 'website', parse: text },
      { header: 'Phone', path: 'phone', parse: text },
      { header: 'Email', path: 'email', parse: text },
      { header: 'GST Number', path: 'gstNumber', parse: text },
      { header: 'Active', path: 'isActive', parse: bool },
    ],
  },
  contacts: {
    label: 'Contacts',
    fields: [
      { header: 'Name', path: 'name', required: true, parse: text },
      // Matched to an existing company by name during import.
      { header: 'Company', path: 'company.name', required: true, parse: text },
      { header: 'Designation', path: 'designation', parse: text },
      { header: 'Email', path: 'email', parse: text },
      { header: 'Phone', path: 'phone', parse: text },
      { header: 'WhatsApp', path: 'whatsapp', parse: text },
      { header: 'Notes', path: 'notes', parse: text },
      { header: 'Active', path: 'isActive', parse: bool },
    ],
  },
  // Leads deliberately excluded: the Leads page has its own importer that
  // validates against master data (region / commercial model / source) and
  // reports per-row failures. A second, looser Lead importer here would be a
  // way to bypass those checks.
  leads: {
    label: 'Leads',
    fields: [
      { header: 'Lead Number', path: 'leadNumber', exportOnly: true },
      { header: 'Title', path: 'title', exportOnly: true },
      { header: 'Company', path: 'company.name', exportOnly: true },
      { header: 'Status', path: 'status', exportOnly: true },
      { header: 'Pipeline Stage', path: 'pipelineStage', exportOnly: true },
      { header: 'Estimated Value', path: 'estimatedValue', exportOnly: true },
      { header: 'Close Date', path: 'closeDate', exportOnly: true },
      { header: 'Source', path: 'leadSourceRef.name', exportOnly: true },
      { header: 'Region', path: 'regionRef.name', exportOnly: true },
      { header: 'Department', path: 'department.name', exportOnly: true },
      { header: 'Notes', path: 'notes', exportOnly: true },
      { header: 'Created At', path: 'createdAt', exportOnly: true },
    ],
  },
}

export async function buildWorkbook(
  entity: string,
  rows: unknown[]
): Promise<{ buffer: Buffer; filename: string }> {
  const spec = ENTITY_SPECS[entity]
  if (!spec) throw new Error(`Unknown entity: ${entity}`)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(spec.label)
  ws.columns = spec.fields.map((f) => ({ header: f.header, key: f.header, width: Math.max(14, f.header.length + 4) }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFF7' } }

  for (const row of rows) {
    ws.addRow(spec.fields.map((f) => cellText(readPath(row, f.path))))
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.fields.length } }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  const stamp = new Date().toISOString().slice(0, 10)
  return { buffer, filename: `${spec.label}-${stamp}.xlsx` }
}

/** Header-only workbook listing the importable columns, required ones marked. */
export async function buildTemplate(entity: string): Promise<{ buffer: Buffer; filename: string }> {
  const spec = ENTITY_SPECS[entity]
  if (!spec) throw new Error(`Unknown entity: ${entity}`)

  const importable = spec.fields.filter((f) => !f.exportOnly)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(spec.label)
  ws.columns = importable.map((f) => ({
    header: f.required ? `${f.header} *` : f.header,
    key: f.header,
    width: Math.max(16, f.header.length + 6),
  }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFF7' } }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  return { buffer, filename: `${spec.label}-import-template.xlsx` }
}

export interface ParsedRow {
  /** 1-based row number in the source sheet, for error reporting. */
  rowNumber: number
  values: Record<string, unknown>
  /** Raw text of every cell, keyed by header - used for relation lookups. */
  raw: Record<string, string>
  errors: string[]
}

/** Minimal RFC4180 CSV line splitter (handles quoted fields and escaped quotes). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

async function readSheet(file: { buffer: Buffer; originalname: string }): Promise<string[][]> {
  const isCsv = file.originalname.toLowerCase().endsWith('.csv')
  if (isCsv) {
    return file.buffer
      .toString('utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map(splitCsvLine)
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(file.buffer as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const grid: string[][] = []
  ws.eachRow((row) => {
    const values = row.values as unknown[]
    // ExcelJS row.values is 1-indexed with a leading hole.
    grid.push(values.slice(1).map(cellText))
  })
  return grid
}

/**
 * Parses an uploaded sheet against an entity spec. Validation is per-row and
 * non-fatal: a bad row records its errors and the rest still import, so one
 * typo in a 500-row file doesn't reject the whole upload.
 */
export async function parseUpload(
  entity: string,
  file: { buffer: Buffer; originalname: string }
): Promise<ParsedRow[]> {
  const spec = ENTITY_SPECS[entity]
  if (!spec) throw new Error(`Unknown entity: ${entity}`)

  const grid = await readSheet(file)
  if (grid.length < 2) return []

  // Headers tolerate the "*" required-marker and case/spacing differences.
  const normalise = (h: string) => h.replace(/\*/g, '').trim().toLowerCase()
  const headers = (grid[0] ?? []).map(normalise)
  const byHeader = new Map(spec.fields.map((f) => [normalise(f.header), f]))

  const parsed: ParsedRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r] ?? []
    if (cells.every((c) => c.trim() === '')) continue

    const values: Record<string, unknown> = {}
    const raw: Record<string, string> = {}
    const errors: string[] = []

    headers.forEach((h, i) => {
      const field = byHeader.get(h)
      if (!field) return
      const cell = cells[i] ?? ''
      raw[field.header] = cell
      if (field.exportOnly || !field.parse) return
      const value = field.parse(cell)
      if (value !== undefined) values[field.path] = value
    })

    for (const field of spec.fields) {
      if (!field.required) continue
      const present = values[field.path] !== undefined || (raw[field.header] ?? '').trim() !== ''
      if (!present) errors.push(`${field.header} is required`)
    }

    parsed.push({ rowNumber: r + 1, values, raw, errors })
  }
  return parsed
}
