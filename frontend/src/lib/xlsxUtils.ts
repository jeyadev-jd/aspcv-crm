import ExcelJS from 'exceljs'

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // ExcelJS returns objects for formulas, hyperlinks and rich text.
    const rich = value as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (typeof rich.text === 'string') return rich.text
    if (rich.richText) return rich.richText.map((t) => t.text).join('')
    if (rich.result !== undefined) return String(rich.result)
    return ''
  }
  return String(value)
}

/** Writes rows (keyed by column header) to a styled .xlsx and triggers a download. */
export async function exportXlsx(
  rows: Record<string, string>[],
  filename: string,
  sheetName = 'Sheet1'
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  const headers = rows.length > 0 ? Object.keys(rows[0] as Record<string, string>) : []

  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 4) }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFF7' } }
  rows.forEach((r) => ws.addRow(headers.map((h) => r[h] ?? '')))
  if (headers.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : filename.replace(/\.csv$/i, '') + '.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Reads the first sheet of an .xlsx into header-keyed rows, matching what
 * parseCSV returns so both file types feed the same import handlers.
 */
export async function readSheetRows(file: File): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []

  const grid: string[][] = []
  ws.eachRow((row) => {
    // row.values is 1-indexed with a leading hole.
    grid.push((row.values as unknown[]).slice(1).map(cellText))
  })
  if (grid.length < 2) return []

  // Header cells may carry a "*" required marker from generated templates.
  const headers = (grid[0] ?? []).map((h) => h.replace(/\*/g, '').trim())
  return grid.slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { if (h) row[h] = (cells[i] ?? '').trim() })
      return row
    })
}
