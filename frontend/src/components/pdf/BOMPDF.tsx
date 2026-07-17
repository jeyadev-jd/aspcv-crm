import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const CO = {
  name: 'Aspiration Cleantech Ventures Pvt.Ltd.',
  addr1: '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2: 'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
}

const s = StyleSheet.create({
  page:    { fontSize: 8, fontFamily: 'Helvetica', padding: '20 30', color: '#111' },
  bold:    { fontFamily: 'Helvetica-Bold' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  logo:    { width: 200, height: 60, objectFit: 'contain' },
  titleBox:{ border: '1.5 solid #1A3A6B', padding: '5 0', alignItems: 'center', marginBottom: 8 },
  table:   { border: '1 solid #aaa', marginBottom: 6 },
  tRow:    { flexDirection: 'row', borderBottom: '0.5 solid #ddd' },
  th:      { fontFamily: 'Helvetica-Bold', backgroundColor: '#e8eef7', padding: '3 4' },
  td:      { padding: '3 4' },
  cSno:    { width: 22 },
  cName:   { flex: 1 },
  cSpec:   { width: 80 },
  cQty:    { width: 40, textAlign: 'center' },
  cUnit:   { width: 35, textAlign: 'center' },
  cCost:   { width: 65, textAlign: 'right' },
  cTotal:  { width: 70, textAlign: 'right' },
  section: { marginBottom: 6 },
  row:     { flexDirection: 'row', marginBottom: 2 },
  key:     { fontFamily: 'Helvetica-Bold', width: 120 },
  sumRow:  { flexDirection: 'row', justifyContent: 'flex-end', padding: '3 4' },
  sumLbl:  { width: 100, textAlign: 'right', marginRight: 8 },
  sumVal:  { width: 70, textAlign: 'right' },
  sigArea: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  sigBlock:{ alignItems: 'center', width: 150 },
  sigLine: { borderTop: '0.5 solid #555', width: 130, paddingTop: 3, alignItems: 'center', marginTop: 20 },
  statusBadge: { padding: '2 6', borderRadius: 3, alignSelf: 'flex-start' },
})

function fmt(n?: number | null) { return '₹ ' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface BOMItemPDF {
  materialName: string
  specification?: string | null
  quantity: number
  unit?: string | null
  estimatedUnitCost?: number | null
  estimatedTotalCost?: number | null
  notes?: string | null
}

export interface BOMPDFProps {
  refNumber: string
  date: string
  status: string
  projectTitle: string
  projectCode?: string | null
  version?: number | null
  description?: string | null
  totalEstimatedCost?: number | null
  items: BOMItemPDF[]
  createdByName?: string | null
  approvedByName?: string | null
  logoUrl?: string
}

export function BOMPDF(p: BOMPDFProps) {
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  const grandTotal = p.items.reduce((sum, i) => sum + (i.estimatedTotalCost ?? 0), 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 9 }]}>{CO.name}</Text>
            <Text>{CO.addr1}</Text>
            <Text>{CO.addr2}</Text>
          </View>
        </View>

        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 11, letterSpacing: 1, color: '#1A3A6B' }]}>BILL OF MATERIALS</Text>
        </View>

        {/* Meta */}
        <View style={[s.table, { marginBottom: 8 }]}>
          <View style={s.tRow}>
            <View style={{ flex: 1, padding: '4 6', borderRight: '0.5 solid #aaa' }}>
              <Text><Text style={s.bold}>BOM Ref: </Text>{p.refNumber}</Text>
              <Text><Text style={s.bold}>Date: </Text>{fmtDate(p.date)}</Text>
              <Text><Text style={s.bold}>Version: </Text>{p.version ?? 1}</Text>
              <Text><Text style={s.bold}>Status: </Text>{p.status}</Text>
            </View>
            <View style={{ flex: 1, padding: '4 6' }}>
              <Text><Text style={s.bold}>Project: </Text>{p.projectTitle}</Text>
              {p.projectCode && <Text><Text style={s.bold}>Project Code: </Text>{p.projectCode}</Text>}
              {p.description && <Text><Text style={s.bold}>Description: </Text>{p.description}</Text>}
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={[s.tRow, { backgroundColor: '#e8eef7' }]}>
            <Text style={[s.th, s.cSno]}>#</Text>
            <Text style={[s.th, s.cName]}>Material / Component</Text>
            <Text style={[s.th, s.cSpec]}>Specification</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cUnit]}>Unit</Text>
            <Text style={[s.th, s.cCost]}>Unit Cost</Text>
            <Text style={[s.th, s.cTotal]}>Total Cost</Text>
          </View>
          {p.items.map((item, i) => (
            <View key={i} style={s.tRow}>
              <Text style={[s.td, s.cSno]}>{i + 1}</Text>
              <Text style={[s.td, s.cName]}>{item.materialName}{item.notes ? `\n${item.notes}` : ''}</Text>
              <Text style={[s.td, s.cSpec]}>{item.specification ?? '—'}</Text>
              <Text style={[s.td, s.cQty]}>{item.quantity}</Text>
              <Text style={[s.td, s.cUnit]}>{item.unit ?? '—'}</Text>
              <Text style={[s.td, s.cCost]}>{fmt(item.estimatedUnitCost)}</Text>
              <Text style={[s.td, s.cTotal]}>{fmt(item.estimatedTotalCost)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={{ border: '1 solid #aaa', borderTop: 'none', marginBottom: 8 }}>
          <View style={s.sumRow}>
            <Text style={[s.sumLbl, s.bold]}>Total Estimated Cost</Text>
            <Text style={[s.sumVal, s.bold]}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>{p.createdByName ?? 'Prepared By'}</Text>
              <Text>Engineering</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>{p.approvedByName ?? 'Approved By'}</Text>
              <Text>Management</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Procurement Head</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
