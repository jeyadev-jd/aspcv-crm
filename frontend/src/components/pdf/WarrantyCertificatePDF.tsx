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
  page:     { fontSize: 8, fontFamily: 'Helvetica', padding: '30 40', color: '#111' },
  bold:     { fontFamily: 'Helvetica-Bold' },
  header:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  logo:     { width: 200, height: 60, objectFit: 'contain' },
  border:   { border: '2 solid #1A3A6B', padding: '20 24', marginTop: 6 },
  titleBox: { alignItems: 'center', marginBottom: 14 },
  certNo:   { alignItems: 'center', marginBottom: 12 },
  body:     { lineHeight: 1.6, fontSize: 9, marginBottom: 10 },
  details:  { border: '1 solid #aaa', padding: '10 14', marginBottom: 12 },
  row:      { flexDirection: 'row', marginBottom: 4 },
  key:      { fontFamily: 'Helvetica-Bold', width: 140 },
  val:      { flex: 1 },
  terms:    { marginTop: 8, fontSize: 7.5, color: '#444' },
  termsHead:{ fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 4 },
  sigArea:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigBlock: { alignItems: 'center', width: 150 },
  sigLine:  { borderTop: '0.5 solid #555', width: 140, paddingTop: 3, alignItems: 'center', marginTop: 24 },
})

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface WarrantyCertificatePDFProps {
  certNumber: string
  customerName: string
  customerAddress?: string | null
  projectTitle: string
  projectCode?: string | null
  completionDate?: string | null
  warrantyStartDate?: string | null
  warrantyEndDate?: string | null
  warrantyPeriodMonths?: number | null
  productDescription?: string | null
  serialNumbers?: string | null
  seName?: string | null
  logoUrl?: string
}

export function WarrantyCertificatePDF(p: WarrantyCertificatePDFProps) {
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  const months = p.warrantyPeriodMonths ?? 12

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

        <View style={s.border}>
          <View style={s.titleBox}>
            <Text style={[s.bold, { fontSize: 16, color: '#1A3A6B', letterSpacing: 1.5 }]}>WARRANTY CERTIFICATE</Text>
            <View style={{ borderBottom: '2 solid #E07B00', width: 200, marginTop: 4 }} />
          </View>

          <View style={s.certNo}>
            <Text style={s.bold}>Certificate No: {p.certNumber}</Text>
          </View>

          <Text style={[s.body, { textAlign: 'center' }]}>
            This is to certify that the following product/system supplied and installed by{'\n'}
            <Text style={s.bold}>{CO.name}</Text>{'\n'}
            is covered under warranty as specified below.
          </Text>

          <View style={s.details}>
            <View style={s.row}><Text style={s.key}>Customer Name:</Text><Text style={s.val}>{p.customerName}</Text></View>
            {p.customerAddress && <View style={s.row}><Text style={s.key}>Address:</Text><Text style={s.val}>{p.customerAddress}</Text></View>}
            <View style={s.row}><Text style={s.key}>Project:</Text><Text style={s.val}>{p.projectTitle}</Text></View>
            {p.projectCode && <View style={s.row}><Text style={s.key}>Project Code:</Text><Text style={s.val}>{p.projectCode}</Text></View>}
            {p.productDescription && <View style={s.row}><Text style={s.key}>Product/System:</Text><Text style={s.val}>{p.productDescription}</Text></View>}
            {p.serialNumbers && <View style={s.row}><Text style={s.key}>Serial/Model No:</Text><Text style={s.val}>{p.serialNumbers}</Text></View>}
            <View style={s.row}><Text style={s.key}>Date of Completion:</Text><Text style={s.val}>{fmtDate(p.completionDate)}</Text></View>
            <View style={s.row}><Text style={s.key}>Warranty Period:</Text><Text style={s.val}>{months} Months</Text></View>
            <View style={s.row}><Text style={s.key}>Warranty Start:</Text><Text style={s.val}>{fmtDate(p.warrantyStartDate)}</Text></View>
            <View style={s.row}><Text style={[s.key, { color: '#1A3A6B' }]}>Warranty Valid Until:</Text><Text style={[s.val, s.bold, { color: '#1A3A6B' }]}>{fmtDate(p.warrantyEndDate)}</Text></View>
          </View>

          <View style={s.terms}>
            <Text style={s.termsHead}>WARRANTY TERMS & CONDITIONS</Text>
            <Text>1. This warranty covers defects in materials and workmanship under normal use conditions.</Text>
            <Text>2. Warranty is void if the product is misused, modified, or damaged due to external causes.</Text>
            <Text>3. Annual Maintenance Contract (AMC) services are available after warranty expiry.</Text>
            <Text>4. For service requests, contact us at {CO.email} or {CO.phone}.</Text>
            <Text>5. This certificate must be presented when claiming warranty service.</Text>
          </View>

          <View style={s.sigArea}>
            <View style={s.sigBlock}>
              <View style={s.sigLine}>
                <Text style={s.bold}>{p.seName ?? 'Service Engineer'}</Text>
                <Text>Service Department</Text>
              </View>
            </View>
            <View style={s.sigBlock}>
              <View style={s.sigLine}>
                <Text style={s.bold}>Authorised Signatory</Text>
                <Text>{CO.name}</Text>
              </View>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
