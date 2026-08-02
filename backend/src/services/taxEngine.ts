/**
 * GST Tax Engine — determines tax type and computes per-line tax amounts.
 * Follows CGST Act 2017, IGST Act 2017.
 */

export type TaxType = 'IntraState' | 'InterState' | 'Export' | 'SEZ' | 'ReverseCharge'

export interface TaxResult {
  taxType: TaxType
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}

const VALID_GST_RATES = new Set([0, 0.25, 3, 5, 12, 18, 28])

export function determineTaxType(
  supplierStateCode: string,
  placeOfSupply: string,
  reverseCharge: boolean = false,
): TaxType {
  if (reverseCharge) return 'ReverseCharge'
  if (placeOfSupply === '96') return 'Export'
  if (supplierStateCode === placeOfSupply) return 'IntraState'
  return 'InterState'
}

export function roundHalfEven(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  const shifted = value * factor
  const floored = Math.floor(shifted)
  const diff = shifted - floored
  if (diff > 0.5) return (floored + 1) / factor
  if (diff < 0.5) return floored / factor
  // Exactly 0.5 — round to even
  return (floored % 2 === 0 ? floored : floored + 1) / factor
}

export function computeLineTax(
  taxableValue: number,
  gstRate: number,
  cessRate: number,
  taxType: TaxType,
): TaxResult {
  if (taxType === 'ReverseCharge' || taxType === 'Export') {
    const cess = cessRate > 0 ? roundHalfEven(taxableValue * cessRate / 100) : 0
    return { taxType, cgst: 0, sgst: 0, igst: 0, cess, totalTax: cess }
  }

  let cgst = 0, sgst = 0, igst = 0
  if (taxType === 'IntraState') {
    cgst = roundHalfEven(taxableValue * (gstRate / 2) / 100)
    sgst = roundHalfEven(taxableValue * (gstRate / 2) / 100)
  } else {
    igst = roundHalfEven(taxableValue * gstRate / 100)
  }

  const cess = cessRate > 0 ? roundHalfEven(taxableValue * cessRate / 100) : 0
  return { taxType, cgst, sgst, igst, cess, totalTax: cgst + sgst + igst + cess }
}

export function validateGstRate(rate: number): boolean {
  return VALID_GST_RATES.has(rate)
}

export function getFinancialYear(date: Date): string {
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()
  if (month >= 3) { // April onwards
    return `${year}-${String(year + 1).slice(2)}`
  }
  return `${year - 1}-${String(year).slice(2)}`
}
