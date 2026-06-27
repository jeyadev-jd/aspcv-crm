import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'

// ─── Company constants ────────────────────────────────────────────────────────
const CO = {
  name:    'Aspiration Cleantech Ventures Pvt.Ltd.',
  addr1:   '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2:   'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
  phone:   '+91 96777 63170',
  email:   'info@aspcv.com',
  web:     'www.aspcv.com',
  gstin:   '33AAPCAI794H1ZH',
  pan:     'AAPCA1794H',
  state:   'Tamil Nadu',
  stateCode: '33',
  bank:    'Yes Bank - Nungambakkam',
  account: '0005619000003093',
  ifsc:    'YESB0000005',
}

// ─── Amount in words (Indian system) ─────────────────────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + numToWords(-n)
  let str = ''
  if (n >= 10000000) { str += numToWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000)   { str += numToWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000)     { str += numToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000 }
  if (n >= 100)      { str += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100 }
  if (n >= 20)       { str += tens[Math.floor(n / 10)] + ' '; n %= 10 }
  if (n > 0)         { str += ones[n] + ' ' }
  return str.trim()
}

function amountWords(total: number): string {
  const rupees = Math.floor(total)
  const paise  = Math.round((total - rupees) * 100)
  let w = numToWords(rupees) + ' Rupees'
  if (paise > 0) w += ' and ' + numToWords(paise) + ' Paise'
  return w + ' Only'
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:      { fontSize: 8, fontFamily: 'Helvetica', padding: '20 30', color: '#111' },
  row:       { flexDirection: 'row' },
  bold:      { fontFamily: 'Helvetica-Bold' },
  orange:    { color: '#E07B00' },
  blue:      { color: '#1A3A6B' },

  // Header
  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  logo:      { width: 240, height: 70, objectFit: 'contain' },
  coAddr:    { textAlign: 'right' },

  // Title box
  titleBox:  { border: '1 solid #999', padding: '4 0', alignItems: 'center', marginBottom: 4 },

  // Table
  table:     { border: '1 solid #aaa', marginBottom: 0 },
  tRow:      { flexDirection: 'row', borderBottom: '0.5 solid #aaa' },
  tRowLast:  { flexDirection: 'row' },
  th:        { fontFamily: 'Helvetica-Bold', backgroundColor: '#f2f2f2', padding: '3 4' },
  td:        { padding: '3 4' },

  // Cell widths for items table
  cNum:  { width: 20 },
  cDesc: { flex: 1 },
  cHsn:  { width: 45 },
  cAmt:  { width: 55, textAlign: 'right' },
  cQty:  { width: 30, textAlign: 'center' },
  cTot:  { width: 65, textAlign: 'right' },

  // Summary right-side rows
  sumRow:    { flexDirection: 'row', justifyContent: 'flex-end', padding: '2 4' },
  sumLabel:  { width: 100, textAlign: 'right', marginRight: 8 },
  sumValue:  { width: 70, textAlign: 'right' },

  // Footer
  footSection: { marginTop: 6 },
  footRow:     { flexDirection: 'row', marginBottom: 2 },
  footLabel:   { fontFamily: 'Helvetica-Bold', width: 80 },

  sigArea:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, alignItems: 'flex-end' },
  sigBlock:  { alignItems: 'center', width: 150 },
  sigImg:    { width: 120, height: 50, objectFit: 'contain', marginBottom: 2 },
  sealImg:   { width: 80, height: 80, objectFit: 'contain' },
})

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PDFItem {
  item: string
  hsnCode?: string | null
  rate?: number | null
  hours?: number | null  // qty
  amount: number
}

export interface InvoicePDFProps {
  number: string
  date: string
  customer: string
  toAddr?: string
  customerGstin?: string
  customerState?: string
  placeOfSupply?: string
  typeOfSupply?: string
  poNo?: string
  poDate?: string
  gstRate?: number       // each leg e.g. 9
  paymentTerms?: string
  items: PDFItem[]
  signatoryName?: string
  signatoryDesignation?: string
  signatureData?: string | null  // base64 PNG
  logoUrl?: string
  sealUrl?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDate(d: string) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InvoicePDF(p: InvoicePDFProps) {
  const gstRate = p.gstRate ?? 9
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  const sealUrl = p.sealUrl ?? `${window.location.origin}/aspcv-seal.png`
  const subTotal = p.items.reduce((s, i) => s + i.amount, 0)
  const sgst     = Math.round(subTotal * gstRate / 100)
  const cgst     = Math.round(subTotal * gstRate / 100)
  const grandTotal = subTotal + sgst + cgst
  const taxTotal   = sgst + cgst

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Image src={logoUrl} style={s.logo} />
          </View>
          <View style={s.coAddr}>
            <Text style={[s.bold, { fontSize: 9, marginBottom: 2 }]}>{CO.name}</Text>
            <Text style={{ lineHeight: 1.4 }}>{CO.addr1}{'\n'}{CO.addr2}{'\n'}Phone: {CO.phone}{'\n'}{CO.email}  |  {CO.web}</Text>
          </View>
        </View>

        {/* ── TAX INVOICE title ── */}
        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 10, letterSpacing: 1 }]}>TAX INVOICE</Text>
        </View>

        {/* ── From block ── */}
        <View style={[s.table, { marginBottom: 0 }]}>
          <View style={[s.tRow, { backgroundColor: '#fafafa', padding: '4 6' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.bold}>{CO.name}</Text>
              <Text>{CO.addr1}</Text>
              <Text>{CO.addr2}</Text>
            </View>
          </View>

          {/* Meta row */}
          <View style={s.tRow}>
            <View style={{ flex: 1, padding: '3 6', borderRight: '0.5 solid #aaa' }}>
              <Text><Text style={s.bold}>State: </Text>{CO.state}</Text>
              <Text><Text style={s.bold}>State Code: </Text>{CO.stateCode}</Text>
              <Text><Text style={s.bold}>GSTIN: </Text>{CO.gstin}</Text>
              <Text><Text style={s.bold}>PAN: </Text>{CO.pan}</Text>
              <Text><Text style={s.bold}>Invoice No: </Text>{p.number}</Text>
            </View>
            <View style={{ flex: 1, padding: '3 6' }}>
              <Text><Text style={s.bold}>Date of Invoice: </Text>{fmtDate(p.date)}</Text>
              <Text><Text style={s.bold}>Place of Supply: </Text>{p.placeOfSupply ?? ''}</Text>
              <Text><Text style={s.bold}>Type of Supply: </Text>{p.typeOfSupply ?? 'Service and Supply'}</Text>
              <Text><Text style={s.bold}>PO No: </Text>{p.poNo ?? 'Mail Confirm'}</Text>
              <Text><Text style={s.bold}>PO Date: </Text>{p.poDate ? fmtDate(p.poDate) : '-'}</Text>
            </View>
          </View>

          {/* Bill to */}
          <View style={[s.tRow, { padding: '4 6', backgroundColor: '#f9f9f9' }]}>
            <View>
              <Text style={s.bold}>Bill to :</Text>
              <Text style={[s.bold, { fontSize: 9 }]}>{p.customer}</Text>
              {p.toAddr && <Text>{p.toAddr}</Text>}
              {p.customerGstin && <Text><Text style={s.bold}>GSTIN: </Text>{p.customerGstin}</Text>}
              {p.customerState && <Text><Text style={s.bold}>State: </Text>{p.customerState}</Text>}
            </View>
          </View>
        </View>

        {/* ── Items table ── */}
        <View style={[s.table, { marginTop: 6 }]}>
          {/* Header */}
          <View style={[s.tRow, { backgroundColor: '#e8e8e8' }]}>
            <Text style={[s.th, s.cNum]}>#</Text>
            <Text style={[s.th, s.cDesc]}>Description of Services</Text>
            <Text style={[s.th, s.cHsn]}>HSN</Text>
            <Text style={[s.th, s.cAmt]}>Amount</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cTot]}>Total</Text>
          </View>

          {/* Rows */}
          {p.items.map((item, i) => {
            const qty = item.hours ?? 1
            const rate = item.rate ?? item.amount
            return (
              <View key={i} style={i < p.items.length - 1 ? s.tRow : s.tRowLast}>
                <Text style={[s.td, s.cNum]}>{i + 1}</Text>
                <Text style={[s.td, s.cDesc]}>{item.item}</Text>
                <Text style={[s.td, s.cHsn]}>{item.hsnCode ?? ''}</Text>
                <Text style={[s.td, s.cAmt]}>{fmt(rate)}</Text>
                <Text style={[s.td, s.cQty]}>{qty}</Text>
                <Text style={[s.td, s.cTot]}>{fmt(item.amount)}</Text>
              </View>
            )
          })}
        </View>

        {/* ── Summary ── */}
        <View style={{ borderLeft: '1 solid #aaa', borderRight: '1 solid #aaa', borderBottom: '1 solid #aaa' }}>
          <View style={[s.sumRow, { borderBottom: '0.5 solid #ddd' }]}>
            <Text style={s.sumLabel}>Sub-Total</Text>
            <Text style={s.sumValue}>{fmt(subTotal)}</Text>
          </View>
          <View style={[s.sumRow, { borderBottom: '0.5 solid #ddd' }]}>
            <Text style={s.sumLabel}>SGST @ {gstRate}%</Text>
            <Text style={s.sumValue}>{fmt(sgst)}</Text>
          </View>
          <View style={[s.sumRow, { borderBottom: '0.5 solid #ddd' }]}>
            <Text style={s.sumLabel}>CGST @ {gstRate}%</Text>
            <Text style={s.sumValue}>{fmt(cgst)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={[s.sumLabel, s.bold]}>Grand Total</Text>
            <Text style={[s.sumValue, s.bold]}>₹ {fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* ── Footer text ── */}
        <View style={s.footSection}>
          <Text><Text style={s.bold}>Invoice Total: </Text>{amountWords(grandTotal)}</Text>
          <Text style={{ marginTop: 2 }}><Text style={s.bold}>Tax: </Text>{amountWords(taxTotal)}</Text>

          {p.paymentTerms && (
            <View style={{ marginTop: 6 }}>
              <Text style={s.bold}>Payment Terms:</Text>
              <Text>{p.paymentTerms}</Text>
            </View>
          )}

          <View style={{ marginTop: 6 }}>
            <Text><Text style={s.bold}>Bank Name & Branch : </Text>{CO.bank}</Text>
            <Text><Text style={s.bold}>A/C number : </Text>{CO.account}</Text>
            <Text><Text style={s.bold}>IFSC code : </Text>{CO.ifsc}</Text>
          </View>
        </View>

        {/* ── Signatory ── */}
        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <Image src={sealUrl} style={s.sealImg} />
          </View>
          <View style={[s.sigBlock, { alignItems: 'flex-end' }]}>
            <Text style={[s.bold, { marginBottom: 4 }]}>For {CO.name}</Text>
            {p.signatureData && (
              <Image src={p.signatureData} style={s.sigImg} />
            )}
            <View style={{ borderTop: '0.5 solid #666', width: 120, paddingTop: 3, alignItems: 'center' }}>
              <Text style={s.bold}>{p.signatoryName ?? 'Authorised Signatory'}</Text>
              {p.signatoryDesignation && <Text>{p.signatoryDesignation}</Text>}
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
