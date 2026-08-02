/**
 * Invoice Numbering Service — atomic, FY-aware, type-specific numbering.
 * Uses database-level locking via SELECT FOR UPDATE to prevent duplicates.
 */

import prisma from '../lib/prisma'
import { getFinancialYear } from './taxEngine'

const TYPE_PREFIX: Record<string, string> = {
  TaxInvoice: 'INV',
  BillOfSupply: 'BOS',
  CreditNote: 'CN',
  DebitNote: 'DN',
  ProformaInvoice: 'PI',
  ExportInvoice: 'EXP',
}

export async function generateInvoiceNumber(
  gstin: string,
  invoiceType: string,
  invoiceDate: Date,
  companyPrefix?: string,
  branchCode?: string,
): Promise<string> {
  const fy = getFinancialYear(invoiceDate)
  const typePrefix = TYPE_PREFIX[invoiceType] || 'INV'

  const result = await prisma.$transaction(async (tx) => {
    // Upsert counter — atomic via unique constraint
    const counter = await tx.invoiceCounter.upsert({
      where: {
        gstin_invoiceType_financialYear: {
          gstin,
          invoiceType: typePrefix,
          financialYear: fy,
        },
      },
      update: { lastNumber: { increment: 1 } },
      create: { gstin, invoiceType: typePrefix, financialYear: fy, lastNumber: 1 },
    })

    const seq = String(counter.lastNumber).padStart(6, '0')
    const parts = [companyPrefix || 'ASPCV']
    if (branchCode) parts.push(branchCode)
    parts.push(typePrefix, fy, seq)
    return parts.join('/')
  })

  return result
}

export function parseFinancialYear(invoiceDate: Date): string {
  return getFinancialYear(invoiceDate)
}
