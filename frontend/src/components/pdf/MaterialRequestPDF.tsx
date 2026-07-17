import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import logoUrl from '/aspcv-logo.png?url'

const CO = {
  name: 'Aspiration Cleantech Ventures Pvt.Ltd.',
  addr1: '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2: 'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
  phone: '+91 96777 63170',
  email: 'info@aspcv.com',
}

const s = StyleSheet.create({
  page:    { fontSize: 8, fontFamily: 'Helvetica', padding: '20 30', color: '#111' },
  bold:    { fontFamily: 'Helvetica-Bold' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  titleBox:{ border: '1.5 solid #1A3A6B', padding: '5 0', alignItems: 'center', marginBottom: 10 },
  table:   { border: '1 solid #aaa', marginBottom: 8 },
  tRow:    { flexDirection: 'row', borderBottom: '0.5 solid #ddd' },
  th:      { fontFamily: 'Helvetica-Bold', backgroundColor: '#e8eef7', padding: '3 4' },
  td:      { padding: '3 4' },
  cSno:    { width: 22 },
  cName:   { flex: 1 },
  cDesc:   { flex: 1 },
  cQty:    { width: 35, textAlign: 'center' },
  cUnit:   { width: 40, textAlign: 'center' },
  cPrice:  { width: 70, textAlign: 'right' },
  cRef:    { width: 80 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaKey: { fontFamily: 'Helvetica-Bold', width: 110 },
  sigArea: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBlock:{ alignItems: 'center', width: 130 },
  sigLine: { borderTop: '0.5 solid #555', width: 110, paddingTop: 3, alignItems: 'center', marginTop: 20 },
  approved:{ backgroundColor: '#E7FAF0', padding: '3 8', borderRadius: 4, marginBottom: 6 },
})

function fmt(n?: number | null) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d?: string | Date | null) {
  if (!d) return '—'
  return new Date(d as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface MRItem {
  name: string
  description?: string | null
  quantity: number
  unit?: string | null
  estimatedPrice?: number | null
  componentRefNo?: string | null
}

export interface MaterialRequestPDFProps {
  refNumber: string
  createdAt: string
  status: string
  projectTitle?: string | null
  requestedBy?: string | null
  managerApprovedAt?: string | null
  bizHeadApprovedAt?: string | null
  accountantApprovedAt?: string | null
  totalEstimated?: number | null
  notes?: string | null
  items: MRItem[]
}

export function MaterialRequestPDF(p: MaterialRequestPDFProps) {
  const total = p.totalEstimated ?? p.items.reduce((s, i) => s + (i.estimatedPrice ?? 0) * i.quantity, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.bold, { fontSize: 11, color: '#1A3A6B' }]}>{CO.name}</Text>
            <Text>{CO.addr1}</Text>
            <Text>{CO.addr2}</Text>
            <Text>Ph: {CO.phone}  |  {CO.email}</Text>
          </View>
        </View>

        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 11, letterSpacing: 1, color: '#1A3A6B' }]}>MATERIAL REQUEST</Text>
        </View>

        {/* Meta */}
        <View style={[s.table, { marginBottom: 8 }]}>
          <View style={[s.tRow, { padding: '6 8' }]}>
            <View style={{ flex: 1 }}>
              <View style={s.metaRow}><Text style={s.metaKey}>Ref No:</Text><Text>{p.refNumber}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Date:</Text><Text>{fmtDate(p.createdAt)}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Requested By:</Text><Text>{p.requestedBy ?? '—'}</Text></View>
              {p.projectTitle && <View style={s.metaRow}><Text style={s.metaKey}>Project:</Text><Text>{p.projectTitle}</Text></View>}
              <View style={s.metaRow}><Text style={s.metaKey}>Status:</Text><Text>{p.status}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.bold, { marginBottom: 4 }]}>Approvals</Text>
              <View style={s.metaRow}><Text style={s.metaKey}>Manager:</Text><Text>{p.managerApprovedAt ? `Approved ${fmtDate(p.managerApprovedAt)}` : 'Pending'}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Business Head:</Text><Text>{p.bizHeadApprovedAt ? `Approved ${fmtDate(p.bizHeadApprovedAt)}` : 'Pending'}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Accountant:</Text><Text>{p.accountantApprovedAt ? `Approved ${fmtDate(p.accountantApprovedAt)}` : 'Pending'}</Text></View>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={[s.tRow, { backgroundColor: '#e8eef7' }]}>
            <Text style={[s.th, s.cSno]}>#</Text>
            <Text style={[s.th, s.cName]}>Item Name</Text>
            <Text style={[s.th, s.cDesc]}>Description</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cUnit]}>Unit</Text>
            <Text style={[s.th, s.cPrice]}>Est. Price</Text>
            <Text style={[s.th, s.cRef]}>Ref No</Text>
          </View>
          {p.items.map((item, i) => (
            <View key={i} style={s.tRow}>
              <Text style={[s.td, s.cSno]}>{i + 1}</Text>
              <Text style={[s.td, s.cName]}>{item.name}</Text>
              <Text style={[s.td, s.cDesc]}>{item.description ?? '—'}</Text>
              <Text style={[s.td, s.cQty]}>{item.quantity}</Text>
              <Text style={[s.td, s.cUnit]}>{item.unit ?? '—'}</Text>
              <Text style={[s.td, s.cPrice]}>{item.estimatedPrice ? `₹ ${fmt(item.estimatedPrice)}` : '—'}</Text>
              <Text style={[s.td, s.cRef]}>{item.componentRefNo ?? '—'}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={{ border: '1 solid #aaa', borderTop: 'none', marginBottom: 8, flexDirection: 'row', justifyContent: 'flex-end', padding: '4 8' }}>
          <Text style={[s.bold, { marginRight: 12 }]}>Total Estimated:</Text>
          <Text style={s.bold}>₹ {fmt(total)}</Text>
        </View>

        {p.notes && (
          <View style={{ marginBottom: 8 }}>
            <Text style={s.bold}>Notes:</Text>
            <Text>{p.notes}</Text>
          </View>
        )}

        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Requested By</Text>
              <Text>{p.requestedBy ?? ''}</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Manager</Text>
              <Text>Approved</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Business Head</Text>
              <Text>Approved</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Accountant</Text>
              <Text>Accounts</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
