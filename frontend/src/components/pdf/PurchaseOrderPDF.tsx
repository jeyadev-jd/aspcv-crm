import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import logoUrl from '/aspcv-logo.png?url'

const CO = {
  name: 'Aspiration Cleantech Ventures Pvt.Ltd.',
  addr1: '2nd Floor, No.18/4, Munusamy Maistry Street,',
  addr2: 'Issa Pallavaram, Chennai - 600043, Tamil Nadu, India',
  phone: '+91 96777 63170',
  email: 'info@aspcv.com',
  gstin: '33AAPCAI794H1ZH',
  pan: 'AAPCA1794H',
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
  cDesc:   { flex: 1 },
  cUnit:   { width: 40, textAlign: 'center' },
  cQty:    { width: 35, textAlign: 'center' },
  cRate:   { width: 60, textAlign: 'right' },
  cAmt:    { width: 70, textAlign: 'right' },
  sumRow:  { flexDirection: 'row', justifyContent: 'flex-end', padding: '2 4' },
  sumLbl:  { width: 90, textAlign: 'right', marginRight: 8 },
  sumVal:  { width: 70, textAlign: 'right' },
  section: { marginBottom: 6 },
  row:     { flexDirection: 'row', marginBottom: 2 },
  key:     { fontFamily: 'Helvetica-Bold', width: 110 },
  sigArea: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  sigBlock:{ alignItems: 'center', width: 150 },
  sigLine: { borderTop: '0.5 solid #555', width: 130, paddingTop: 3, alignItems: 'center', marginTop: 20 },
})

function fmt(n?: number | null) { return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface POItem {
  description: string
  unit?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface PurchaseOrderPDFProps {
  refNumber: string
  date: string
  status: string
  supplierName: string
  supplierAddress?: string | null
  supplierContact?: string | null
  supplierGstin?: string | null
  projectTitle?: string | null
  deliveryAddress?: string | null
  deliveryDate?: string | null
  paymentTerms?: string | null
  taxRate?: number | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  items: POItem[]
  notes?: string | null
  logoUrl?: string
}

export function PurchaseOrderPDF(p: PurchaseOrderPDFProps) {
  const resolvedLogoUrl = p.logoUrl ?? logoUrl
  const taxRate = p.taxRate ?? 18

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={resolvedLogoUrl} style={s.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 9 }]}>{CO.name}</Text>
            <Text>{CO.addr1}</Text>
            <Text>{CO.addr2}</Text>
            <Text>Ph: {CO.phone}  |  {CO.email}</Text>
            <Text>GSTIN: {CO.gstin}  |  PAN: {CO.pan}</Text>
          </View>
        </View>

        <View style={s.titleBox}>
          <Text style={[s.bold, { fontSize: 11, letterSpacing: 1, color: '#1A3A6B' }]}>PURCHASE ORDER</Text>
        </View>

        {/* PO meta + Supplier */}
        <View style={[s.table, { marginBottom: 8 }]}>
          <View style={s.tRow}>
            <View style={{ flex: 1, padding: '4 6', borderRight: '0.5 solid #aaa' }}>
              <Text style={s.bold}>PO Details</Text>
              <Text><Text style={s.bold}>PO No: </Text>{p.refNumber}</Text>
              <Text><Text style={s.bold}>Date: </Text>{fmtDate(p.date)}</Text>
              <Text><Text style={s.bold}>Status: </Text>{p.status}</Text>
              {p.projectTitle && <Text><Text style={s.bold}>Project: </Text>{p.projectTitle}</Text>}
              {p.deliveryDate && <Text><Text style={s.bold}>Delivery By: </Text>{fmtDate(p.deliveryDate)}</Text>}
            </View>
            <View style={{ flex: 1, padding: '4 6' }}>
              <Text style={s.bold}>Supplier</Text>
              <Text style={[s.bold, { fontSize: 9 }]}>{p.supplierName}</Text>
              {p.supplierAddress && <Text>{p.supplierAddress}</Text>}
              {p.supplierContact && <Text>Contact: {p.supplierContact}</Text>}
              {p.supplierGstin && <Text>GSTIN: {p.supplierGstin}</Text>}
            </View>
          </View>
          {p.deliveryAddress && (
            <View style={{ padding: '4 6', borderTop: '0.5 solid #aaa' }}>
              <Text><Text style={s.bold}>Delivery Address: </Text>{p.deliveryAddress}</Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={[s.tRow, { backgroundColor: '#e8eef7' }]}>
            <Text style={[s.th, s.cSno]}>#</Text>
            <Text style={[s.th, s.cDesc]}>Description</Text>
            <Text style={[s.th, s.cUnit]}>Unit</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cRate]}>Unit Price</Text>
            <Text style={[s.th, s.cAmt]}>Amount</Text>
          </View>
          {p.items.map((item, i) => (
            <View key={i} style={s.tRow}>
              <Text style={[s.td, s.cSno]}>{i + 1}</Text>
              <Text style={[s.td, s.cDesc]}>{item.description}</Text>
              <Text style={[s.td, s.cUnit]}>{item.unit ?? '—'}</Text>
              <Text style={[s.td, s.cQty]}>{item.quantity}</Text>
              <Text style={[s.td, s.cRate]}>₹ {fmt(item.unitPrice)}</Text>
              <Text style={[s.td, s.cAmt]}>₹ {fmt(item.totalPrice)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={{ border: '1 solid #aaa', borderTop: 'none', marginBottom: 8 }}>
          <View style={[s.sumRow, { borderBottom: '0.5 solid #ddd' }]}>
            <Text style={s.sumLbl}>Sub-Total</Text>
            <Text style={s.sumVal}>₹ {fmt(p.subtotal)}</Text>
          </View>
          <View style={[s.sumRow, { borderBottom: '0.5 solid #ddd' }]}>
            <Text style={s.sumLbl}>GST @ {taxRate}%</Text>
            <Text style={s.sumVal}>₹ {fmt(p.taxAmount)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={[s.sumLbl, s.bold]}>Total Amount</Text>
            <Text style={[s.sumVal, s.bold]}>₹ {fmt(p.totalAmount)}</Text>
          </View>
        </View>

        {p.paymentTerms && (
          <View style={s.section}>
            <Text><Text style={s.bold}>Payment Terms: </Text>{p.paymentTerms}</Text>
          </View>
        )}
        {p.notes && (
          <View style={s.section}>
            <Text style={s.bold}>Notes:</Text>
            <Text>{p.notes}</Text>
          </View>
        )}

        <View style={s.sigArea}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Prepared By</Text>
              <Text>Procurement</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Approved By</Text>
              <Text>Management</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.bold}>Supplier Acknowledgement</Text>
              <Text>{p.supplierName}</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
