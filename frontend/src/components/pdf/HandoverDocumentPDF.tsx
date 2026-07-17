import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const CO = {
  name: 'Aspiration Cleantech Ventures Pvt.Ltd.',
  addr1: '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2: 'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
  phone: '+91 96777 63170',
  email: 'info@aspcv.com',
  web: 'www.aspcv.com',
}

const s = StyleSheet.create({
  page:    { fontSize: 8, fontFamily: 'Helvetica', padding: '24 36', color: '#111' },
  bold:    { fontFamily: 'Helvetica-Bold' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logo:    { width: 200, height: 60, objectFit: 'contain' },
  titleBox: { border: '1.5 solid #1A3A6B', padding: '6 0', alignItems: 'center', marginBottom: 10 },
  section: { marginBottom: 10 },
  sLabel:  { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#1A3A6B', marginBottom: 4, borderBottom: '0.5 solid #aaa', paddingBottom: 2 },
  row:     { flexDirection: 'row', marginBottom: 3 },
  key:     { fontFamily: 'Helvetica-Bold', width: 130 },
  val:     { flex: 1 },
  table:   { border: '1 solid #aaa', marginBottom: 6 },
  tRow:    { flexDirection: 'row', borderBottom: '0.5 solid #ddd' },
  th:      { fontFamily: 'Helvetica-Bold', backgroundColor: '#e8eef7', padding: '3 5' },
  td:      { padding: '3 5' },
  sigArea: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBlock:{ alignItems: 'center', width: 160 },
  sigLine: { borderTop: '0.5 solid #555', width: 140, paddingTop: 3, alignItems: 'center', marginTop: 24 },
  badge:   { backgroundColor: '#e8eef7', padding: '3 8', borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
})

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt(n?: number | null) {
  if (n == null) return '—'
  return '₹ ' + n.toLocaleString('en-IN')
}

export interface HandoverDocumentPDFProps {
  refNumber: string
  date: string
  status: string
  customerName: string
  customerContact?: string | null
  projectTitle: string
  projectDescription?: string | null
  estimatedValue?: number | null
  estimatedDelivery?: string | null
  paymentTerms?: string | null
  technicalRequirements?: string | null
  specialConditions?: string | null
  salesRepName?: string | null
  pmName?: string | null
  logoUrl?: string
}

export function HandoverDocumentPDF(p: HandoverDocumentPDFProps) {
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 9 }]}>{CO.name}</Text>
            <Text>{CO.addr1}</Text>
            <Text>{CO.addr2}</Text>
            <Text>Ph: {CO.phone}</Text>
            <Text>{CO.email}  |  {CO.web}</Text>
          </View>
        </View>

        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 11, letterSpacing: 1, color: '#1A3A6B' }]}>PROJECT HANDOVER DOCUMENT</Text>
        </View>

        {/* Reference block */}
        <View style={[s.table, { marginBottom: 10 }]}>
          <View style={s.tRow}>
            <View style={{ flex: 1, padding: '4 6', borderRight: '0.5 solid #aaa' }}>
              <Text><Text style={s.bold}>Ref No: </Text>{p.refNumber}</Text>
              <Text><Text style={s.bold}>Date: </Text>{fmtDate(p.date)}</Text>
            </View>
            <View style={{ flex: 1, padding: '4 6' }}>
              <Text><Text style={s.bold}>Status: </Text>{p.status}</Text>
              <Text><Text style={s.bold}>Project: </Text>{p.projectTitle}</Text>
            </View>
          </View>
        </View>

        {/* Customer */}
        <View style={s.section}>
          <Text style={s.sLabel}>CUSTOMER DETAILS</Text>
          <View style={s.row}><Text style={s.key}>Customer Name:</Text><Text style={s.val}>{p.customerName}</Text></View>
          {p.customerContact && <View style={s.row}><Text style={s.key}>Contact:</Text><Text style={s.val}>{p.customerContact}</Text></View>}
        </View>

        {/* Project */}
        <View style={s.section}>
          <Text style={s.sLabel}>PROJECT DETAILS</Text>
          <View style={s.row}><Text style={s.key}>Project Title:</Text><Text style={s.val}>{p.projectTitle}</Text></View>
          {p.projectDescription && <View style={s.row}><Text style={s.key}>Description:</Text><Text style={s.val}>{p.projectDescription}</Text></View>}
          <View style={s.row}><Text style={s.key}>Estimated Value:</Text><Text style={s.val}>{fmt(p.estimatedValue)}</Text></View>
          <View style={s.row}><Text style={s.key}>Est. Delivery:</Text><Text style={s.val}>{fmtDate(p.estimatedDelivery)}</Text></View>
          {p.paymentTerms && <View style={s.row}><Text style={s.key}>Payment Terms:</Text><Text style={s.val}>{p.paymentTerms}</Text></View>}
        </View>

        {/* Technical */}
        {p.technicalRequirements && (
          <View style={s.section}>
            <Text style={s.sLabel}>TECHNICAL REQUIREMENTS</Text>
            <Text>{p.technicalRequirements}</Text>
          </View>
        )}

        {/* Special conditions */}
        {p.specialConditions && (
          <View style={s.section}>
            <Text style={s.sLabel}>SPECIAL CONDITIONS</Text>
            <Text>{p.specialConditions}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>{p.salesRepName ?? 'Sales Representative'}</Text>
              <Text>Sales</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>{p.pmName ?? 'Project Manager'}</Text>
              <Text>Operations</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Customer Signature</Text>
              <Text>{p.customerName}</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
