import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

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
  logo:    { width: 200, height: 60, objectFit: 'contain' },
  titleBox:{ border: '1.5 solid #1A3A6B', padding: '5 0', alignItems: 'center', marginBottom: 8 },
  table:   { border: '1 solid #aaa', marginBottom: 6 },
  tRow:    { flexDirection: 'row', borderBottom: '0.5 solid #ddd' },
  th:      { fontFamily: 'Helvetica-Bold', backgroundColor: '#e8eef7', padding: '3 4' },
  td:      { padding: '3 4' },
  section: { marginBottom: 8 },
  sLabel:  { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#1A3A6B', marginBottom: 3, borderBottom: '0.5 solid #aaa', paddingBottom: 2 },
  row:     { flexDirection: 'row', marginBottom: 3 },
  key:     { fontFamily: 'Helvetica-Bold', width: 120 },
  val:     { flex: 1 },
  cSno:    { width: 22 },
  cType:   { width: 70 },
  cDesc:   { flex: 1 },
  cStatus: { width: 55 },
  cDate:   { width: 65 },
  cCost:   { width: 65, textAlign: 'right' },
  sigArea: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  sigBlock:{ alignItems: 'center', width: 150 },
  sigLine: { borderTop: '0.5 solid #555', width: 130, paddingTop: 3, alignItems: 'center', marginTop: 20 },
  statusBadge: { padding: '1 4', borderRadius: 3 },
})

function fmt(n?: number | null) { return '₹ ' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface ServiceRequestPDF {
  requestNumber?: string | null
  type: string
  description: string
  status: string
  priority?: string | null
  reportedDate?: string | null
  resolvedDate?: string | null
  resolutionNotes?: string | null
  cost?: number | null
}

export interface ServiceReportPDFProps {
  reportNumber: string
  generatedDate: string
  customerName: string
  customerAddress?: string | null
  projectTitle: string
  projectCode?: string | null
  warrantyStart?: string | null
  warrantyEnd?: string | null
  totalServiceCost?: number | null
  openRequests?: number | null
  closedRequests?: number | null
  serviceRequests: ServiceRequestPDF[]
  seName?: string | null
  notes?: string | null
  logoUrl?: string
}

export function ServiceReportPDF(p: ServiceReportPDFProps) {
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  const totalCost = p.serviceRequests.reduce((sum, r) => sum + (r.cost ?? 0), 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 9 }]}>{CO.name}</Text>
            <Text>{CO.addr1}</Text>
            <Text>{CO.addr2}</Text>
            <Text>Ph: {CO.phone}  |  {CO.email}</Text>
          </View>
        </View>

        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 11, letterSpacing: 1, color: '#1A3A6B' }]}>SERVICE REPORT</Text>
        </View>

        {/* Meta */}
        <View style={[s.table, { marginBottom: 8 }]}>
          <View style={s.tRow}>
            <View style={{ flex: 1, padding: '4 6', borderRight: '0.5 solid #aaa' }}>
              <Text><Text style={s.bold}>Report No: </Text>{p.reportNumber}</Text>
              <Text><Text style={s.bold}>Generated: </Text>{fmtDate(p.generatedDate)}</Text>
              <Text><Text style={s.bold}>Project: </Text>{p.projectTitle}</Text>
              {p.projectCode && <Text><Text style={s.bold}>Code: </Text>{p.projectCode}</Text>}
            </View>
            <View style={{ flex: 1, padding: '4 6' }}>
              <Text><Text style={s.bold}>Customer: </Text>{p.customerName}</Text>
              {p.customerAddress && <Text>{p.customerAddress}</Text>}
              <Text><Text style={s.bold}>Warranty: </Text>{fmtDate(p.warrantyStart)} – {fmtDate(p.warrantyEnd)}</Text>
              <Text><Text style={s.bold}>Service Eng: </Text>{p.seName ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={s.section}>
          <Text style={s.sLabel}>SERVICE SUMMARY</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, border: '1 solid #aaa', padding: '6 8', alignItems: 'center' }}>
              <Text style={[s.bold, { fontSize: 14, color: '#1A3A6B' }]}>{p.openRequests ?? 0}</Text>
              <Text>Open Requests</Text>
            </View>
            <View style={{ flex: 1, border: '1 solid #aaa', padding: '6 8', alignItems: 'center' }}>
              <Text style={[s.bold, { fontSize: 14, color: '#16a34a' }]}>{p.closedRequests ?? 0}</Text>
              <Text>Closed Requests</Text>
            </View>
            <View style={{ flex: 1, border: '1 solid #aaa', padding: '6 8', alignItems: 'center' }}>
              <Text style={[s.bold, { fontSize: 14, color: '#E07B00' }]}>{fmt(p.totalServiceCost ?? totalCost)}</Text>
              <Text>Total Service Cost</Text>
            </View>
          </View>
        </View>

        {/* Service requests */}
        {p.serviceRequests.length > 0 && (
          <View style={s.section}>
            <Text style={s.sLabel}>SERVICE REQUESTS</Text>
            <View style={s.table}>
              <View style={[s.tRow, { backgroundColor: '#e8eef7' }]}>
                <Text style={[s.th, s.cSno]}>#</Text>
                <Text style={[s.th, s.cType]}>Type</Text>
                <Text style={[s.th, s.cDesc]}>Description</Text>
                <Text style={[s.th, s.cStatus]}>Status</Text>
                <Text style={[s.th, s.cDate]}>Reported</Text>
                <Text style={[s.th, s.cCost]}>Cost</Text>
              </View>
              {p.serviceRequests.map((req, i) => (
                <View key={i} style={s.tRow}>
                  <Text style={[s.td, s.cSno]}>{i + 1}</Text>
                  <Text style={[s.td, s.cType]}>{req.type}</Text>
                  <Text style={[s.td, s.cDesc]}>
                    {req.description}
                    {req.resolutionNotes ? `\n→ ${req.resolutionNotes}` : ''}
                  </Text>
                  <Text style={[s.td, s.cStatus]}>{req.status}</Text>
                  <Text style={[s.td, s.cDate]}>{fmtDate(req.reportedDate)}</Text>
                  <Text style={[s.td, s.cCost]}>{fmt(req.cost)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {p.notes && (
          <View style={s.section}>
            <Text style={s.sLabel}>NOTES</Text>
            <Text>{p.notes}</Text>
          </View>
        )}

        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>{p.seName ?? 'Service Engineer'}</Text>
              <Text>Service Department</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Customer Acknowledgement</Text>
              <Text>{p.customerName}</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
