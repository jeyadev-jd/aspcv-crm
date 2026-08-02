import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const CO = {
  name:      'Aspiration Cleantech Ventures Pvt.Ltd.',
  legalName: 'ASPIRATION CLEANTECH VENTURES PRIVATE LIMITED',
  addr1:     '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2:     'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
  phone:     '+91 96777 63170',
  email:     'info@aspcv.com',
  web:       'www.aspcv.com',
  gstin:     '33AAPCAI794H1ZH',
}

const s = StyleSheet.create({
  page:     { fontSize: 8, fontFamily: 'Helvetica', padding: '20 30', color: '#111' },
  bold:     { fontFamily: 'Helvetica-Bold' },
  row:      { flexDirection: 'row' },

  header:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  logo:     { width: 200, height: 55, objectFit: 'contain' },

  titleBox: { backgroundColor: '#1e3a5f', padding: '5 10', marginBottom: 8 },
  titleTxt: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },

  section:  { marginBottom: 8 },
  label:    { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#555', marginBottom: 1, textTransform: 'uppercase' },

  box:      { border: '0.5 solid #ccc', padding: '6 8', marginBottom: 8 },
  metaGrid: { flexDirection: 'row', gap: 10 },
  metaCol:  { flex: 1 },
  metaRow:  { flexDirection: 'row', marginBottom: 2 },
  metaKey:  { fontFamily: 'Helvetica-Bold', width: 80, color: '#444' },
  metaVal:  { flex: 1, color: '#111' },

  table:    { border: '0.5 solid #ccc', marginBottom: 8 },
  tHead:    { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '3 4' },
  tRow:     { flexDirection: 'row', borderTop: '0.5 solid #ddd', padding: '3 4' },
  tRowAlt:  { flexDirection: 'row', borderTop: '0.5 solid #ddd', padding: '3 4', backgroundColor: '#f9f9f9' },
  th:       { fontFamily: 'Helvetica-Bold', color: '#fff', fontSize: 7 },
  td:       { fontSize: 7.5 },

  cNum:     { width: 18, textAlign: 'center' },
  cDesc:    { flex: 1 },
  cQty:     { width: 28, textAlign: 'center' },
  cUnit:    { width: 26, textAlign: 'center' },
  cRate:    { width: 56, textAlign: 'right' },
  cTax:     { width: 36, textAlign: 'right' },
  cTotal:   { width: 60, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 4, paddingVertical: 2 },
  tLabel:   { width: 100, textAlign: 'right', marginRight: 10, color: '#555', fontSize: 7.5 },
  tValue:   { width: 60, textAlign: 'right', fontSize: 7.5 },

  note:     { fontSize: 7, color: '#555', fontStyle: 'italic' },
  validBox: { border: '0.5 solid #e7a000', backgroundColor: '#fffbf0', padding: '4 8', marginTop: 6 },
  sigArea:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, alignItems: 'flex-end' },
  sigBlock: { alignItems: 'center', width: 140 },
})

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export interface QuotationPDFItem {
  description: string
  quantity?: number
  unit?: string
  unitPrice?: number
  taxPercent?: number
  total?: number
}

export interface QuotationPDFProps {
  refNumber: string
  title: string
  customerName: string
  customerAddress?: string
  contactName?: string
  date: string
  validUntil?: string
  scope?: string
  notes?: string
  warrantyPeriod?: number
  deliveryDate?: string
  items: QuotationPDFItem[]
  subtotal: number
  taxPercent: number
  totalAmount: number
  logoUrl?: string
  signatureData?: string | null
  signatoryName?: string
}

export function QuotationPDF(p: QuotationPDFProps) {
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 8.5, marginBottom: 2 }]}>{CO.name}</Text>
            <Text style={{ lineHeight: 1.4, fontSize: 7 }}>
              {CO.addr1}{'\n'}{CO.addr2}{'\n'}
              {CO.phone}  |  {CO.email}{'\n'}{CO.web}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 7 }}><Text style={s.bold}>GSTIN: </Text>{CO.gstin}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleBox}>
          <Text style={s.titleTxt}>QUOTATION</Text>
        </View>

        {/* Meta info */}
        <View style={s.box}>
          <View style={s.metaGrid}>
            <View style={s.metaCol}>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Quotation No:</Text>
                <Text style={[s.metaVal, s.bold]}>{p.refNumber}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Date:</Text>
                <Text style={s.metaVal}>{fmtDate(p.date)}</Text>
              </View>
              {p.validUntil && (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Valid Until:</Text>
                  <Text style={s.metaVal}>{fmtDate(p.validUntil)}</Text>
                </View>
              )}
              {p.deliveryDate && (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Delivery:</Text>
                  <Text style={s.metaVal}>{fmtDate(p.deliveryDate)}</Text>
                </View>
              )}
              {p.warrantyPeriod != null && (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Warranty:</Text>
                  <Text style={s.metaVal}>{p.warrantyPeriod} months</Text>
                </View>
              )}
            </View>
            <View style={s.metaCol}>
              <Text style={[s.bold, { fontSize: 7, marginBottom: 2, color: '#444', textTransform: 'uppercase' }]}>To:</Text>
              <Text style={[s.bold, { fontSize: 9 }]}>{p.customerName}</Text>
              {p.contactName && <Text style={{ marginTop: 1 }}>Attn: {p.contactName}</Text>}
              {p.customerAddress && <Text style={{ marginTop: 1, lineHeight: 1.4, fontSize: 7 }}>{p.customerAddress}</Text>}
            </View>
          </View>
        </View>

        {/* Subject */}
        <View style={{ marginBottom: 6 }}>
          <Text><Text style={s.bold}>Subject: </Text>{p.title}</Text>
        </View>

        {/* Scope */}
        {p.scope && (
          <View style={[s.box, { marginBottom: 8 }]}>
            <Text style={[s.bold, { fontSize: 7, marginBottom: 3, textTransform: 'uppercase', color: '#444' }]}>Scope of Work</Text>
            <Text style={{ lineHeight: 1.5, fontSize: 7.5 }}>{p.scope}</Text>
          </View>
        )}

        {/* Items table */}
        {p.items.length > 0 && (
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, s.cNum]}>#</Text>
              <Text style={[s.th, s.cDesc]}>Description</Text>
              <Text style={[s.th, s.cQty]}>Qty</Text>
              <Text style={[s.th, s.cUnit]}>Unit</Text>
              <Text style={[s.th, s.cRate]}>Rate (₹)</Text>
              <Text style={[s.th, s.cTax]}>Tax%</Text>
              <Text style={[s.th, s.cTotal]}>Total (₹)</Text>
            </View>
            {p.items.map((item, i) => {
              const qty = item.quantity ?? 1
              const rate = item.unitPrice ?? 0
              const total = item.total ?? (qty * rate)
              return (
                <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                  <Text style={[s.td, s.cNum]}>{i + 1}</Text>
                  <Text style={[s.td, s.cDesc]}>{item.description}</Text>
                  <Text style={[s.td, s.cQty]}>{qty}</Text>
                  <Text style={[s.td, s.cUnit]}>{item.unit || 'NOS'}</Text>
                  <Text style={[s.td, s.cRate]}>{fmt(rate)}</Text>
                  <Text style={[s.td, s.cTax]}>{item.taxPercent != null ? `${item.taxPercent}%` : `${p.taxPercent}%`}</Text>
                  <Text style={[s.td, s.cTotal]}>{fmt(total)}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Totals */}
        <View style={{ borderLeft: '0.5 solid #ccc', borderRight: '0.5 solid #ccc', borderBottom: '0.5 solid #ccc', marginBottom: 8 }}>
          <View style={s.totalRow}>
            <Text style={s.tLabel}>Sub-Total</Text>
            <Text style={s.tValue}>{fmt(p.subtotal)}</Text>
          </View>
          <View style={[s.totalRow, { borderTop: '0.5 solid #eee' }]}>
            <Text style={s.tLabel}>GST ({p.taxPercent}%)</Text>
            <Text style={s.tValue}>{fmt(p.totalAmount - p.subtotal)}</Text>
          </View>
          <View style={[s.totalRow, { borderTop: '1 solid #333', paddingTop: 3 }]}>
            <Text style={[s.tLabel, s.bold, { fontSize: 9, color: '#111' }]}>Grand Total</Text>
            <Text style={[s.tValue, s.bold, { fontSize: 9, color: '#1e3a5f' }]}>₹ {fmt(p.totalAmount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {p.notes && (
          <View style={{ marginBottom: 6 }}>
            <Text style={[s.bold, { fontSize: 7, marginBottom: 2, textTransform: 'uppercase', color: '#444' }]}>Notes</Text>
            <Text style={s.note}>{p.notes}</Text>
          </View>
        )}

        {/* Validity notice */}
        {p.validUntil && (
          <View style={s.validBox}>
            <Text style={{ fontSize: 7 }}>This quotation is valid until <Text style={s.bold}>{fmtDate(p.validUntil)}</Text>. Prices are subject to change after this date.</Text>
          </View>
        )}

        {/* Signatory */}
        <View style={s.sigArea}>
          <View>
            <Text style={{ fontSize: 7, color: '#555' }}>Thank you for your consideration.</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 2 }}>For queries: {CO.email}  |  {CO.phone}</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={[s.bold, { marginBottom: 4, fontSize: 7.5 }]}>For {CO.name}</Text>
            {p.signatureData && <Image src={p.signatureData} style={{ width: 100, height: 40, objectFit: 'contain', marginBottom: 3 }} />}
            <View style={{ borderTop: '0.5 solid #666', width: 120, paddingTop: 3, alignItems: 'center' }}>
              <Text style={s.bold}>{p.signatoryName ?? 'Authorised Signatory'}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 12, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #ddd', paddingTop: 4 }}>
          <Text style={{ fontSize: 6, color: '#999' }}>Computer Generated Quotation — {CO.name}</Text>
          <Text style={{ fontSize: 6, color: '#999' }}>Page 1 of 1</Text>
        </View>

      </Page>
    </Document>
  )
}
