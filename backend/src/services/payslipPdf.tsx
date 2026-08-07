import React from 'react'
import fs from 'fs'
import path from 'path'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

// Matches the reference payslip: black hairline grid, orange band for the
// details header, navy bands for the earnings/deductions header and Net Pay.
const BORDER = '#000000'
const ORANGE = '#E36C0A'
const NAVY = '#1F3864'

const s = StyleSheet.create({
  page: { padding: 24, fontFamily: 'Helvetica', fontSize: 8, color: '#000000' },
  outer: { border: `1 solid ${BORDER}` },

  logoBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottom: `1 solid ${BORDER}` },
  logo: { height: 46, objectFit: 'contain' },

  titleBox: { alignItems: 'center', paddingVertical: 8, borderBottom: `1 solid ${BORDER}` },
  legalName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  addr: { fontSize: 7.5, marginTop: 3 },

  // Two-column band: "Employee Details" | "Payment Details"
  bandRow: { flexDirection: 'row' },
  bandCell: {
    flex: 1, backgroundColor: ORANGE, color: '#FFFFFF', fontFamily: 'Helvetica-Bold',
    fontSize: 8, textAlign: 'center', paddingVertical: 3,
  },

  row: { flexDirection: 'row', borderTop: `1 solid ${BORDER}` },
  // 4 cells per row: label | value | label | value
  cLabel: { width: '18%', paddingVertical: 4, paddingHorizontal: 4, fontFamily: 'Helvetica-Bold' },
  cValue: { width: '32%', paddingVertical: 4, paddingHorizontal: 4, borderLeft: `1 solid ${BORDER}` },
  cLabelR: { width: '18%', paddingVertical: 4, paddingHorizontal: 4, fontFamily: 'Helvetica-Bold', borderLeft: `1 solid ${BORDER}` },
  cValueR: { width: '32%', paddingVertical: 4, paddingHorizontal: 4, borderLeft: `1 solid ${BORDER}` },

  slipTitle: {
    textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    paddingVertical: 4, borderTop: `1 solid ${BORDER}`,
  },

  navyCell: {
    backgroundColor: NAVY, color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8,
    paddingVertical: 3, paddingHorizontal: 4,
  },
  // Earnings | Current (INR) | Deductions | Amount (INR)
  wEarn: { width: '28%' },
  wCur: { width: '22%' },
  wDed: { width: '28%' },
  wAmt: { width: '22%' },

  cell: { paddingVertical: 3.5, paddingHorizontal: 4 },
  cellNum: { paddingVertical: 3.5, paddingHorizontal: 4, textAlign: 'right' },
  bl: { borderLeft: `1 solid ${BORDER}` },
  bold: { fontFamily: 'Helvetica-Bold' },

  wordsCell: { width: '50%', paddingVertical: 5, paddingHorizontal: 4 },
  netLabelCell: {
    width: '22%', backgroundColor: NAVY, color: '#FFFFFF', fontFamily: 'Helvetica-Bold',
    textAlign: 'center', paddingVertical: 5, borderLeft: `1 solid ${BORDER}`,
  },
  netValueCell: { width: '28%', paddingVertical: 5, paddingHorizontal: 4, textAlign: 'right', fontFamily: 'Helvetica-Bold', borderLeft: `1 solid ${BORDER}` },
})

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return ''
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] as string
  const t = TENS[Math.floor(n / 10)] as string
  const o = ONES[n % 10] as string
  return o ? `${t} ${o}` : t
}

// Indian numbering: crore / lakh / thousand / hundred.
function numberToWords(value: number): string {
  const n = Math.round(value)
  if (n === 0) return 'zero only'
  const parts: string[] = []
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const hundred = Math.floor((n % 1000) / 100)
  const rest = n % 100
  if (crore) parts.push(`${twoDigits(crore)} crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} thousand`)
  if (hundred) parts.push(`${ONES[hundred]} hundred`)
  if (rest) parts.push(twoDigits(rest))
  const words = parts.join(' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} only`
}

export interface PayslipData {
  month: number
  year: number
  employeeName: string
  employeeCode?: string | null
  designation?: string | null
  pan?: string | null
  bankName?: string | null
  bankAccount?: string | null
  uan?: string | null
  daysPaid?: number | null
  baseSalary: number
  hra: number
  allowances: number
  grossSalary: number
  pfEmployee: number
  pfEmployer: number
  tds: number
  professionalTax?: number
  lossOfPay: number
  netSalary: number
  company: {
    legalName: string
    addressLine1: string
    addressLine2: string
    logoPath?: string | null
  }
}

/** Left column = earnings, right column = deductions; both padded to equal length. */
function buildRows(d: PayslipData) {
  const earnings: [string, number][] = [
    ['Basic Salary', d.baseSalary],
    ['HRA', d.hra],
    ['Special Allowance', d.allowances],
  ]
  const deductions: [string, number][] = [
    ['Provident Fund', d.pfEmployee],
    ['Income Tax', d.tds],
    ['Professional Tax', d.professionalTax ?? 0],
    ['Loss of Pay', d.lossOfPay],
  ]
  const len = Math.max(earnings.length, deductions.length)
  const rows: { eLabel: string; eAmt: number | null; dLabel: string; dAmt: number | null }[] = []
  for (let i = 0; i < len; i++) {
    rows.push({
      eLabel: earnings[i]?.[0] ?? '',
      eAmt: earnings[i]?.[1] ?? null,
      dLabel: deductions[i]?.[0] ?? '',
      dAmt: deductions[i]?.[1] ?? null,
    })
  }
  return rows
}

export function PayslipDocument({ data }: { data: PayslipData }) {
  const rows = buildRows(data)
  const totalDeductions =
    data.pfEmployee + data.tds + (data.professionalTax ?? 0) + data.lossOfPay

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.outer}>
          {data.company.logoPath && (
            <View style={s.logoBox}>
              <Image style={s.logo} src={data.company.logoPath} />
            </View>
          )}

          <View style={s.titleBox}>
            <Text style={s.legalName}>{data.company.legalName.toUpperCase()}</Text>
            <Text style={s.addr}>{data.company.addressLine1}</Text>
            <Text style={s.addr}>{data.company.addressLine2}</Text>
          </View>

          <View style={s.bandRow}>
            <Text style={s.bandCell}>Employee Details</Text>
            <Text style={{ ...s.bandCell, borderLeft: `1 solid ${BORDER}` }}>Payment Details</Text>
          </View>

          <View style={s.row}>
            <Text style={s.cLabel}>Employee Name</Text>
            <Text style={s.cValue}>{data.employeeName}</Text>
            <Text style={s.cLabelR}>Bank Name</Text>
            <Text style={s.cValueR}>{data.bankName ?? ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cLabel}>Employee Number</Text>
            <Text style={s.cValue}>{data.employeeCode ?? ''}</Text>
            <Text style={s.cLabelR}>Acc No.</Text>
            <Text style={s.cValueR}>{data.bankAccount ?? ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cLabel}>Designation</Text>
            <Text style={s.cValue}>{data.designation ?? ''}</Text>
            <Text style={s.cLabelR}>Days Paid</Text>
            <Text style={s.cValueR}>{data.daysPaid ?? ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cLabel}>PAN</Text>
            <Text style={s.cValue}>{data.pan ?? '-'}</Text>
            <Text style={s.cLabelR}>UAN</Text>
            <Text style={s.cValueR}>{data.uan ?? ''}</Text>
          </View>

          <Text style={s.slipTitle}>
            PAYSLIP FOR THE MONTH OF {MONTHS[data.month - 1]} {data.year}
          </Text>

          <View style={{ ...s.row, borderTop: `1 solid ${BORDER}` }}>
            <Text style={{ ...s.navyCell, ...s.wEarn }}>Earnings</Text>
            <Text style={{ ...s.navyCell, ...s.wCur, ...s.bl }}>Curent (INR)</Text>
            <Text style={{ ...s.navyCell, ...s.wDed, ...s.bl }}>Deductions</Text>
            <Text style={{ ...s.navyCell, ...s.wAmt, ...s.bl }}>Amount (INR)</Text>
          </View>

          {rows.map((r, i) => (
            <View style={s.row} key={i}>
              <Text style={{ ...s.cell, ...s.wEarn }}>{r.eLabel}</Text>
              <Text style={{ ...s.cellNum, ...s.wCur, ...s.bl }}>{r.eAmt === null ? '' : money(r.eAmt)}</Text>
              <Text style={{ ...s.cell, ...s.wDed, ...s.bl }}>{r.dLabel}</Text>
              <Text style={{ ...s.cellNum, ...s.wAmt, ...s.bl }}>{r.dAmt === null ? '' : money(r.dAmt)}</Text>
            </View>
          ))}

          <View style={s.row}>
            <Text style={{ ...s.navyCell, ...s.wEarn }}>Employer Contribution</Text>
            <Text style={{ ...s.cell, ...s.wCur, ...s.bl }} />
            <Text style={{ ...s.cell, ...s.wDed, ...s.bl }} />
            <Text style={{ ...s.cell, ...s.wAmt, ...s.bl }} />
          </View>
          <View style={s.row}>
            <Text style={{ ...s.cell, ...s.wEarn }}>Provident Fund</Text>
            <Text style={{ ...s.cellNum, ...s.wCur, ...s.bl }}>{money(data.pfEmployer)}</Text>
            <Text style={{ ...s.cell, ...s.wDed, ...s.bl }} />
            <Text style={{ ...s.cell, ...s.wAmt, ...s.bl }} />
          </View>

          <View style={s.row}>
            <Text style={{ ...s.cell, ...s.wEarn, ...s.bold }}>Total Earnings</Text>
            <Text style={{ ...s.cellNum, ...s.wCur, ...s.bl, ...s.bold }}>{money(data.grossSalary)}</Text>
            <Text style={{ ...s.cell, ...s.wDed, ...s.bl, ...s.bold }}>Total Deductions</Text>
            <Text style={{ ...s.cellNum, ...s.wAmt, ...s.bl, ...s.bold }}>{money(totalDeductions)}</Text>
          </View>

          <View style={s.row}>
            <View style={s.wordsCell}>
              <Text>Rupees in Words :</Text>
              <Text>{numberToWords(data.netSalary)}</Text>
            </View>
            <Text style={s.netLabelCell}>Net Pay (INR)</Text>
            <Text style={s.netValueCell}>{money(data.netSalary)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

let cachedLogo: string | null | undefined

/**
 * Returns the logo as a base64 data URI. In Node, @react-pdf/renderer resolves
 * a plain path through fetch() (which fails for local files), so the bytes are
 * inlined instead. Returns null when the asset is missing - the slip then
 * renders without the logo band rather than failing the whole PDF.
 */
export function resolveLogoPath(): string | null {
  if (cachedLogo !== undefined) return cachedLogo
  // dist/services at runtime, src/services under ts-node-dev.
  const candidates = [
    path.resolve(__dirname, '../../assets/aspcv-logo.png'),
    path.resolve(__dirname, '../../../assets/aspcv-logo.png'),
  ]
  const found = candidates.find((p) => fs.existsSync(p))
  cachedLogo = found ? `data:image/png;base64,${fs.readFileSync(found).toString('base64')}` : null
  return cachedLogo
}

export async function renderPayslipPdf(data: PayslipData): Promise<Buffer> {
  return renderToBuffer(<PayslipDocument data={data} />)
}
