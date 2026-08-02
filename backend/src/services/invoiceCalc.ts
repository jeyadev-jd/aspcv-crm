/**
 * Invoice Calculation Engine — computes all line-level and invoice-level totals.
 * Follows the strict computation order from the FDD (Chapter 8).
 */

import { computeLineTax, determineTaxType, roundHalfEven, type TaxType } from './taxEngine'

export interface LineItemInput {
  itemCode?: string
  item: string
  hsnCode?: string
  quantity: number
  unit: string
  rate: number
  discountPct: number
  gstRate: number
  cessRate: number
  // Legacy compat
  hours?: number
}

export interface ComputedLineItem extends LineItemInput {
  lineNo: number
  grossAmount: number
  discountAmt: number
  taxableValue: number
  cgstAmt: number
  sgstAmt: number
  igstAmt: number
  cessAmt: number
  lineTotal: number
  amount: number // alias for lineTotal (legacy compat)
}

export interface InvoiceTotals {
  subTotal: number
  totalDiscount: number
  invoiceDiscount: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  totalTax: number
  roundOff: number
  grandTotal: number
  items: ComputedLineItem[]
}

export function computeInvoice(
  lines: LineItemInput[],
  supplierStateCode: string,
  placeOfSupply: string,
  reverseCharge: boolean = false,
  invoiceDiscountAmount: number = 0,
): InvoiceTotals {
  const taxType = determineTaxType(supplierStateCode, placeOfSupply, reverseCharge)

  // Step 1-3: compute per-line gross, discount, taxable value
  const preLines = lines.map((line, i) => {
    const qty = line.quantity || line.hours || 1
    const grossAmount = roundHalfEven(qty * line.rate)
    const discountAmt = line.discountPct > 0
      ? roundHalfEven(grossAmount * line.discountPct / 100)
      : 0
    const taxableValue = roundHalfEven(grossAmount - discountAmt)
    return { ...line, lineNo: i + 1, grossAmount, discountAmt, taxableValue, quantity: qty }
  })

  // Step 4: apportion invoice-level discount
  const totalTaxableBeforeInvDiscount = preLines.reduce((s, l) => s + l.taxableValue, 0)
  const adjustedLines = preLines.map(line => {
    if (invoiceDiscountAmount > 0 && totalTaxableBeforeInvDiscount > 0) {
      const share = roundHalfEven(invoiceDiscountAmount * (line.taxableValue / totalTaxableBeforeInvDiscount))
      return { ...line, taxableValue: roundHalfEven(line.taxableValue - share) }
    }
    return line
  })

  // Step 5-7: compute tax per line
  const computedItems: ComputedLineItem[] = adjustedLines.map(line => {
    const tax = computeLineTax(line.taxableValue, line.gstRate, line.cessRate, taxType)
    const lineTotal = roundHalfEven(line.taxableValue + tax.totalTax)
    return {
      ...line,
      cgstAmt: tax.cgst,
      sgstAmt: tax.sgst,
      igstAmt: tax.igst,
      cessAmt: tax.cess,
      lineTotal,
      amount: lineTotal,
    }
  })

  // Step 8: invoice sub-total
  const subTotal = roundHalfEven(computedItems.reduce((s, l) => s + l.lineTotal, 0))

  // Step 9: round-off (max ±0.50)
  const rounded = Math.round(subTotal)
  let roundOff = roundHalfEven(rounded - subTotal)
  if (Math.abs(roundOff) > 0.5) roundOff = 0

  // Step 10: grand total
  const grandTotal = subTotal + roundOff

  const totalCgst = roundHalfEven(computedItems.reduce((s, l) => s + l.cgstAmt, 0))
  const totalSgst = roundHalfEven(computedItems.reduce((s, l) => s + l.sgstAmt, 0))
  const totalIgst = roundHalfEven(computedItems.reduce((s, l) => s + l.igstAmt, 0))
  const totalCess = roundHalfEven(computedItems.reduce((s, l) => s + l.cessAmt, 0))
  const totalTax = totalCgst + totalSgst + totalIgst + totalCess
  const totalDiscount = roundHalfEven(computedItems.reduce((s, l) => s + l.discountAmt, 0))
  const taxableSubTotal = roundHalfEven(computedItems.reduce((s, l) => s + l.taxableValue, 0))

  // Recompute roundOff based on what the PDF will actually display:
  // PDF grandTotal = taxableSubTotal + totalTax + roundOff
  // We need grandTotal to be a whole rupee.
  const rawBeforeRound = taxableSubTotal + totalTax
  const correctedGrandTotal = Math.round(rawBeforeRound)
  const correctedRoundOff = roundHalfEven(correctedGrandTotal - rawBeforeRound)

  return {
    subTotal: taxableSubTotal,
    totalDiscount,
    invoiceDiscount: invoiceDiscountAmount,
    totalCgst,
    totalSgst,
    totalIgst,
    totalCess,
    totalTax,
    roundOff: correctedRoundOff,
    grandTotal: correctedGrandTotal,
    items: computedItems,
  }
}

// Amount in words — Indian numbering system
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + numToWords(-n)
  let str = ''
  if (n >= 10000000) { str += numToWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000) { str += numToWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000) { str += numToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000 }
  if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100 }
  if (n >= 20) { str += tens[Math.floor(n / 10)] + ' '; n %= 10 }
  if (n > 0) { str += ones[n] + ' ' }
  return str.trim()
}

export function amountInWords(total: number): string {
  const rupees = Math.floor(Math.abs(total))
  const paise = Math.round((Math.abs(total) - rupees) * 100)
  let w = 'Indian Rupees ' + numToWords(rupees)
  if (paise > 0) w += ' and ' + numToWords(paise) + ' Paise'
  return w + ' Only'
}
