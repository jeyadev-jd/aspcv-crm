import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// ─── Company defaults (fallback when no CompanyProfile loaded) ───────────────
const CO = {
  name:      'Aspiration Cleantech Ventures Pvt.Ltd.',
  legalName: 'Aspiration Cleantech Ventures Private Limited',
  addr1:     '2nd Floor, No.18/4,',
  addr2:     'Munusamy Maistry Street,',
  addr3:     'Issa Pallavaram,',
  addr4:     'Chennai – 600043, Tamil Nadu, India',
  phone:     '+ +91 96777 63170',
  email:     'info@aspcv.com',
  web:       'www.aspcv.com',
  gstin:     '33AAPCA1794H1ZH',
  pan:       'AAPCA1794H',
  udyam:     'UDYAM-TN-02-0087917',
  state:     'Tamil Nadu',
  stateCode: '33',
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
  const rupees = Math.floor(Math.abs(total))
  const paise  = Math.round((Math.abs(total) - rupees) * 100)
  let w = numToWords(rupees)
  if (paise > 0) w += ' and ' + numToWords(paise) + ' Paise'
  return w + ' Only'
}

// ─── Styles ──────────────────────────────────────────────────────────────────
// Mirrors the printed ASPCV tax-invoice stationery: one outer bordered frame,
// square black rules, no fills.
const B = '1 solid #000'

/**
 * The invoice must always fit one A4 page, so everything that consumes vertical
 * space is scaled against the item count rather than fixed. Up to BASE_ROWS the
 * layout renders at full size; past that, type, padding, leading and the logo /
 * seal shrink on a smooth curve down to MIN_SCALE, which keeps ~40 line items
 * legible on a single page.
 */
const BASE_ROWS = 8
const MAX_ROWS = 40
const MIN_SCALE = 0.55
const FLOOR_SCALE = 0.32

function densityScale(itemCount: number): number {
  if (itemCount <= BASE_ROWS) return 1
  const span = MAX_ROWS - BASE_ROWS
  if (itemCount <= MAX_ROWS) {
    const over = itemCount - BASE_ROWS
    return 1 - (over / span) * (1 - MIN_SCALE)
  }
  // Past MAX_ROWS keep shrinking inversely with the row count — clamping here
  // instead would let a very long invoice overflow onto a second page.
  return Math.max(FLOOR_SCALE, MIN_SCALE * (MAX_ROWS / itemCount))
}

function makeStyles(k: number) {
  // Round to 2dp so @react-pdf isn't handed long floats for every metric.
  const r = (n: number) => Math.round(n * 100) / 100
  const font = r(9 * k)
  const pad = r(3 * k)
  const padX = r(5 * k)
  const lh = 1.1

  return StyleSheet.create({
    page:      { fontSize: font, fontFamily: 'Helvetica', padding: `${r(24 * k)} 28`, color: '#000' },
    bold:      { fontFamily: 'Helvetica-Bold' },

    header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: r(10 * k) },
    logo:      { width: r(280 * k), height: r(72 * k), objectFit: 'contain' },
    coBlock:   { width: r(240 * k) },
    // Single Text with \n keeps the letterhead lines tight; separate <Text>
    // blocks each add their own leading and space the address out too far.
    coLine:    { lineHeight: lh, fontSize: r(8.5 * k) },

    frame:     { borderTop: B, borderLeft: B, borderRight: B },
    row:       { flexDirection: 'row', borderBottom: B },
    cell:      { padding: `${pad} ${padX}`, justifyContent: 'center' },
    cellR:     { padding: `${pad} ${padX}`, justifyContent: 'center', borderRight: B },

    // Meta grid columns (label | value | label | value)
    mLabel:    { width: r(130 * k) },
    mMid:      { width: r(120 * k) },

    thc:       { fontFamily: 'Helvetica-Bold', textAlign: 'center' },

    // Item table columns
    cNum:   { width: r(22 * k), textAlign: 'center' },
    cDesc:  { flex: 1 },
    cHsn:   { width: r(62 * k), textAlign: 'center' },
    cAmt:   { width: r(66 * k), textAlign: 'right' },
    cQty:   { width: r(52 * k), textAlign: 'right' },
    cTot:   { width: r(74 * k), textAlign: 'right' },

    // Totals block sits flush right under the items table
    totLabel:  { flex: 1, textAlign: 'right', padding: `${pad} ${padX}`, fontFamily: 'Helvetica-Bold' },
    totValue:  { width: r(74 * k), textAlign: 'right', padding: `${pad} ${padX}`, fontFamily: 'Helvetica-Bold', borderLeft: B },

    footBlock: { borderLeft: B, borderRight: B, borderBottom: B, padding: `${r(6 * k)} ${padX}` },

    sigArea:   { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: r(4 * k) },
    sealImg:   { width: r(78 * k), height: r(78 * k), objectFit: 'contain' },
    sigImg:    { width: r(96 * k), height: r(40 * k), objectFit: 'contain' },

    line:      { lineHeight: lh },
    legalName: { fontFamily: 'Helvetica-Bold', fontSize: r(10 * k), lineHeight: lh },
    coName:    { fontFamily: 'Helvetica-Bold', fontSize: r(10 * k), lineHeight: lh },
    small:     { fontSize: r(7.5 * k) },

    cancelled: { position: 'absolute', top: 300, left: 100, fontSize: 60, color: '#FF000033', fontFamily: 'Helvetica-Bold', transform: 'rotate(-30deg)' },
  })
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PDFItem {
  item: string
  hsnCode?: string | null
  quantity?: number
  unit?: string
  rate?: number | null
  hours?: number | null
  discountPct?: number
  taxableValue?: number
  gstRate?: number
  cgstAmt?: number
  sgstAmt?: number
  igstAmt?: number
  cessRate?: number
  cessAmt?: number
  lineTotal?: number
  amount: number
}

export interface InvoicePDFProps {
  number: string
  date: string
  customer: string
  toAddr?: string
  shippingAddr?: string
  customerGstin?: string
  customerState?: string
  customerStateCode?: string
  placeOfSupply?: string
  supplyType?: string
  typeOfSupply?: string
  reverseCharge?: boolean
  poNo?: string
  poDate?: string
  gstRate?: number
  paymentTerms?: string
  invoiceType?: string
  items: PDFItem[]
  // Computed totals (from backend)
  subTotal?: number
  totalCgst?: number
  totalSgst?: number
  totalIgst?: number
  totalCess?: number
  totalTax?: number
  roundOff?: number
  grandTotal?: number
  invoiceDiscount?: number
  // CN/DN
  originalInvoiceNo?: string
  cnDnReason?: string
  // Company profile override
  companyName?: string
  companyAddr?: string
  companyGstin?: string
  companyPan?: string
  companyState?: string
  companyStateCode?: string
  companyUdyam?: string
  companyLegalName?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  // Signatory
  signatoryName?: string
  signatoryDesignation?: string
  signatureData?: string | null
  // Bank
  bankName?: string
  bankAccountNumber?: string
  bankIfsc?: string
  bankUpiId?: string
  // Assets
  logoUrl?: string
  sealUrl?: string
  // Status
  status?: string
  declarationText?: string
  termsText?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtInt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDate(d: string) {
  if (!d) return ''
  const dt = new Date(d)
  // Matches the stationery's 22-May-26 style.
  const day = String(dt.getDate()).padStart(2, '0')
  const mon = dt.toLocaleDateString('en-IN', { month: 'short' })
  const yr = String(dt.getFullYear()).slice(2)
  return `${day}-${mon}-${yr}`
}

const TITLE_MAP: Record<string, string> = {
  TaxInvoice: 'TAX INVOICE',
  BillOfSupply: 'BILL OF SUPPLY',
  CreditNote: 'CREDIT NOTE',
  DebitNote: 'DEBIT NOTE',
  ProformaInvoice: 'PROFORMA INVOICE',
  ExportInvoice: 'EXPORT INVOICE',
}

// ─── Component ───────────────────────────────────────────────────────────────
export function InvoicePDF(p: InvoicePDFProps) {
  // Shrinks the whole layout as the line-item count grows so the invoice
  // never spills onto a second page.
  const k = densityScale(p.items.length)
  const s = makeStyles(k)
  const logoUrl = p.logoUrl ?? `${window.location.origin}/aspcv-logo.png`
  const sealUrl = p.sealUrl ?? `${window.location.origin}/aspcv-seal.png`
  // Every letterhead value falls back to the built-in ASPCV defaults, so an
  // invoice still renders correctly before a CompanyProfile is configured.
  const co = {
    name: p.companyName || CO.name,
    legalName: p.companyLegalName || p.companyName || CO.legalName,
    gstin: p.companyGstin || CO.gstin,
    pan: p.companyPan || CO.pan,
    state: p.companyState || CO.state,
    stateCode: p.companyStateCode || CO.stateCode,
    udyam: p.companyUdyam || CO.udyam,
    phone: p.companyPhone || CO.phone,
    email: p.companyEmail || CO.email,
    web: p.companyWebsite || CO.web,
  }

  const isInterState = p.supplyType === 'InterState' || co.stateCode !== (p.placeOfSupply || p.customerStateCode || co.stateCode)
  const title = TITLE_MAP[p.invoiceType || 'TaxInvoice'] || 'TAX INVOICE'

  const subTotal = p.subTotal ?? p.items.reduce((sum, i) => sum + (i.taxableValue ?? i.amount), 0)
  const totalCgst = p.totalCgst ?? (isInterState ? 0 : p.items.reduce((sum, i) => sum + (i.cgstAmt ?? 0), 0))
  const totalSgst = p.totalSgst ?? (isInterState ? 0 : p.items.reduce((sum, i) => sum + (i.sgstAmt ?? 0), 0))
  const totalIgst = p.totalIgst ?? (isInterState ? p.items.reduce((sum, i) => sum + (i.igstAmt ?? 0), 0) : 0)
  const totalCess = p.totalCess ?? p.items.reduce((sum, i) => sum + (i.cessAmt ?? 0), 0)
  const roundOff = p.roundOff ?? 0
  const grandTotal = p.grandTotal ?? (subTotal + totalCgst + totalSgst + totalIgst + totalCess + roundOff)
  const totalTax = totalCgst + totalSgst + totalIgst + totalCess

  // Half of the combined GST rate labels each of the CGST/SGST rows.
  const halfRate = (p.items[0]?.gstRate ?? (p.gstRate ? p.gstRate * 2 : 18)) / 2
  const igstRate = p.items[0]?.gstRate ?? (p.gstRate ? p.gstRate * 2 : 18)

  const companyAddrLines = p.companyAddr
    ? p.companyAddr.split('\n')
    : [CO.addr1, CO.addr2, CO.addr3, CO.addr4]

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {p.status === 'Cancelled' && <Text style={s.cancelled}>CANCELLED</Text>}

        {/* Letterhead */}
        <View style={s.header}>
          <Image src={logoUrl} style={s.logo} />
          <View style={s.coBlock}>
            <Text style={s.coName}>{co.name}</Text>
            <Text style={s.coLine}>
              {[...companyAddrLines, `Phone: ${co.phone}`, co.email, co.web]
                .filter(Boolean)
                .join('\n')}
            </Text>
          </View>
        </View>

        <View style={s.frame}>
          {/* ORIGINAL marker */}
          <View style={s.row}>
            <View style={[s.cellR, { flex: 1 }]} />
            <View style={[s.cell, { width: Math.round(200 * k), alignItems: 'center' }]}>
              <Text style={s.bold}>ORIGINAL</Text>
            </View>
          </View>

          {/* Document title */}
          <View style={s.row}>
            <View style={[s.cell, { flex: 1, alignItems: 'center' }]}>
              <Text style={s.bold}>{title}</Text>
            </View>
          </View>

          {/* Seller identity */}
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]} />
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.legalName}>{co.legalName}</Text>
              <Text style={s.line}>{companyAddrLines.join('\n')}</Text>
            </View>
          </View>

          {/* CN/DN reference, only for credit/debit notes */}
          {(p.invoiceType === 'CreditNote' || p.invoiceType === 'DebitNote') && p.originalInvoiceNo && (
            <View style={s.row}>
              <View style={[s.cell, { flex: 1 }]}>
                <Text><Text style={s.bold}>Original Invoice: </Text>{p.originalInvoiceNo}</Text>
                {p.cnDnReason && <Text><Text style={s.bold}>Reason: </Text>{p.cnDnReason}</Text>}
              </View>
            </View>
          )}

          {/* Meta grid */}
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]}><Text><Text style={s.bold}>State- </Text>{co.state}</Text></View>
            <View style={[s.cellR, s.mMid]}><Text style={s.bold}>Date of Invoice</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{fmtDate(p.date)}</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]}><Text><Text style={s.bold}>State Code</Text> : {co.stateCode}</Text></View>
            <View style={[s.cellR, s.mMid]}><Text style={s.bold}>Place of Supply</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{p.placeOfSupply ?? ''}</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]}><Text style={s.bold}>GSTIN- {co.gstin}</Text></View>
            <View style={[s.cellR, s.mMid]}><Text style={s.bold}>Type of supply</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{p.typeOfSupply ?? (isInterState ? 'Inter-State' : 'Intra-State')}</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]}><Text><Text style={s.bold}>PAN: </Text>{co.pan}</Text></View>
            <View style={[s.cellR, s.mMid]}><Text style={s.bold}>PO No</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{p.poNo ?? ''}</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cellR, s.mLabel]}><Text><Text style={s.bold}>Invoice No: </Text>{p.number}</Text></View>
            <View style={[s.cellR, s.mMid]}><Text style={s.bold}>PO Date</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{p.poDate ? fmtDate(p.poDate) : ''}</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cellR, { width: Math.round(250 * k) }]}><Text style={s.bold}>UDAYAM REGISTRATION NUMBER</Text></View>
            <View style={[s.cell, { flex: 1 }]}><Text>{co.udyam}</Text></View>
          </View>

          {/* Bill to */}
          <View style={s.row}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={[s.bold, s.line]}>Bill to :</Text>
              <Text style={[s.bold, s.line]}>{p.customer}</Text>
              {p.toAddr && <Text style={s.line}>{p.toAddr}</Text>}
              {p.customerGstin && <Text style={[s.bold, s.line]}>GSTIN: {p.customerGstin}</Text>}
              {p.customerStateCode && <Text style={[s.bold, s.line]}>State Code : {p.customerStateCode}</Text>}
              {p.reverseCharge && <Text style={[s.bold, { marginTop: Math.round(3 * k) }]}>Tax payable under Reverse Charge</Text>}
            </View>
          </View>

          {/* Items header */}
          <View style={s.row}>
            <View style={[s.cellR, s.cNum]}><Text style={s.bold}>#</Text></View>
            <View style={[s.cellR, s.cDesc, { alignItems: 'center' }]}><Text style={s.bold}>Description of Services</Text></View>
            <View style={[s.cellR, s.cHsn]}><Text style={s.thc}>HSN</Text></View>
            <View style={[s.cellR, s.cAmt, { alignItems: 'center' }]}><Text style={s.bold}>Amount</Text></View>
            <View style={[s.cellR, s.cQty, { alignItems: 'center' }]}><Text style={s.bold}>Qty</Text></View>
            <View style={[s.cell, s.cTot, { alignItems: 'center' }]}><Text style={s.bold}>Total</Text></View>
          </View>

          {/* Item rows */}
          {p.items.map((item, i) => {
            const qty = item.quantity ?? item.hours ?? 1
            const taxable = item.taxableValue ?? item.amount
            const total = item.lineTotal ?? item.amount
            return (
              <View key={i} style={s.row}>
                <View style={[s.cellR, s.cNum]}><Text>{i + 1}</Text></View>
                <View style={[s.cellR, s.cDesc]}>
                  {/* Long descriptions are clamped so one verbose line item
                      cannot push the invoice onto a second page. */}
                  <Text style={[s.line, { maxLines: 2, textOverflow: 'ellipsis' }]}>{item.item}</Text>
                </View>
                <View style={[s.cellR, s.cHsn]}><Text style={{ textAlign: 'right' }}>{item.hsnCode ?? ''}</Text></View>
                <View style={[s.cellR, s.cAmt]}><Text style={{ textAlign: 'right' }}>{fmtInt(taxable)}</Text></View>
                <View style={[s.cellR, s.cQty]}><Text style={{ textAlign: 'right' }}>{qty}</Text></View>
                <View style={[s.cell, s.cTot]}><Text style={{ textAlign: 'right' }}>{fmtInt(total)}</Text></View>
              </View>
            )
          })}

          {/* Totals ladder */}
          <View style={s.row}>
            <Text style={s.totLabel}>Sub-Total</Text>
            <Text style={s.totValue}>{fmtInt(subTotal)}</Text>
          </View>
          {(p.invoiceDiscount ?? 0) > 0 && (
            <View style={s.row}>
              <Text style={s.totLabel}>Discount</Text>
              <Text style={s.totValue}>-{fmtInt(p.invoiceDiscount!)}</Text>
            </View>
          )}
          {!isInterState && (
            <>
              <View style={s.row}>
                <Text style={s.totLabel}>SGST @ {halfRate}%</Text>
                <Text style={s.totValue}>{fmtInt(totalSgst)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.totLabel}>CGST @ {halfRate}%</Text>
                <Text style={s.totValue}>{fmtInt(totalCgst)}</Text>
              </View>
            </>
          )}
          {isInterState && (
            <View style={s.row}>
              <Text style={s.totLabel}>IGST @ {igstRate}%</Text>
              <Text style={s.totValue}>{fmtInt(totalIgst)}</Text>
            </View>
          )}
          {totalCess > 0 && (
            <View style={s.row}>
              <Text style={s.totLabel}>CESS</Text>
              <Text style={s.totValue}>{fmtInt(totalCess)}</Text>
            </View>
          )}
          {roundOff !== 0 && (
            <View style={s.row}>
              <Text style={s.totLabel}>Round Off</Text>
              <Text style={s.totValue}>{roundOff > 0 ? '+' : ''}{fmtInt(roundOff)}</Text>
            </View>
          )}
          <View style={s.row}>
            <Text style={s.totLabel}>Grand Total</Text>
            <Text style={s.totValue}>{fmtInt(grandTotal)}</Text>
          </View>
        </View>

        {/* Words, terms, bank, signature — all inside the same frame */}
        <View style={s.footBlock}>
          <Text style={s.line}>
            <Text style={s.bold}>Invoice Total:</Text>{amountWords(grandTotal)}
          </Text>
          <Text style={s.line}>
            <Text style={s.bold}>Tax: </Text>{amountWords(totalTax).replace(/ Only$/, '')}
          </Text>

          <Text style={[s.bold, { marginTop: Math.round(10 * k) }]}>Payment Terms:</Text>
          <Text style={s.line}>{p.paymentTerms || '100% Against Purchase Order'}</Text>

          <Text style={[s.line, { marginTop: Math.round(16 * k) }]}>
            {[
              `Bank Name & Branch : ${p.bankName ?? 'Yes Bank - Nungambakkam'}`,
              `A/C number : ${p.bankAccountNumber ?? '000561900003093'}`,
              `IFSC code : ${p.bankIfsc ?? 'YESB0000005'}`,
              ...(p.bankUpiId ? [`UPI : ${p.bankUpiId}`] : []),
            ].join('\n')}
          </Text>

          {p.declarationText && (
            <Text style={[s.small, { marginTop: Math.round(8 * k) }]}>{p.declarationText}</Text>
          )}
          {p.termsText && (
            <Text style={[s.small, { marginTop: Math.round(4 * k) }]}>{p.termsText}</Text>
          )}

          {/* Signature block */}
          <Text style={[s.bold, { textAlign: 'right', marginTop: Math.round(12 * k), fontFamily: 'Helvetica-BoldOblique' }]}>
            For {co.legalName}
          </Text>
          <View style={s.sigArea}>
            <Image src={sealUrl} style={s.sealImg} />
            <View style={{ alignItems: 'center', marginLeft: Math.round(24 * k) }}>
              {p.signatureData && <Image src={p.signatureData} style={s.sigImg} />}
              <Text style={s.bold}>{p.signatoryName ?? 'Authorised Signatory'}</Text>
              {p.signatoryDesignation && <Text>{p.signatoryDesignation}</Text>}
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
