import prisma from '../lib/prisma'
import { decryptIfPresent } from '../lib/encrypt'
import { emailProvider } from './emailProvider'
import { renderPayslipPdf, resolveLogoPath, type PayslipData } from './payslipPdf'

const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Assembles everything the slip prints from the salary row, the employee and
 * the active company profile. PAN and bank account are stored encrypted, so
 * they are decrypted here rather than at the route.
 */
export async function buildPayslipData(salaryRecordId: string): Promise<{
  data: PayslipData
  employeeEmail: string
  employeeName: string
} | null> {
  const record = await prisma.salaryRecord.findUnique({
    where: { id: salaryRecordId },
    include: { user: { include: { designation: true } } },
  })
  if (!record?.user) return null

  const company = await prisma.companyProfile.findFirst({ where: { isActive: true } })
  const u = record.user

  const data: PayslipData = {
    month: record.month,
    year: record.year,
    employeeName: u.name,
    employeeCode: u.employeeCode,
    designation: u.designation?.name ?? null,
    pan: decryptIfPresent(u.pan),
    bankName: u.bankName,
    bankAccount: decryptIfPresent(u.bankAccount),
    uan: u.uan,
    daysPaid: record.daysPresent,
    baseSalary: record.baseSalary,
    hra: record.hra,
    allowances: record.allowances,
    grossSalary: record.grossSalary,
    pfEmployee: record.pfEmployee,
    pfEmployer: record.pfEmployer,
    tds: record.tds,
    // The schema has no separate professional-tax column; "other deductions"
    // is where HR books it, so it prints in that row.
    professionalTax: record.otherDeduction,
    lossOfPay: record.absentDeduction + record.lateDeduction,
    netSalary: record.netSalary,
    company: {
      legalName: company?.legalName ?? 'Aspiration Cleantech Ventures Private Limited',
      addressLine1: company?.registeredAddr ?? '',
      addressLine2: [company?.state, company?.country].filter(Boolean).join(', '),
      logoPath: resolveLogoPath(),
    },
  }

  return { data, employeeEmail: u.email, employeeName: u.name }
}

export async function generatePayslipPdf(salaryRecordId: string): Promise<{
  buffer: Buffer
  filename: string
  employeeEmail: string
  employeeName: string
  month: number
  year: number
} | null> {
  const built = await buildPayslipData(salaryRecordId)
  if (!built) return null
  const buffer = await renderPayslipPdf(built.data)
  const safeName = built.employeeName.replace(/[^a-zA-Z0-9]+/g, '-')
  return {
    buffer,
    filename: `Payslip-${safeName}-${MONTH_LABEL[built.data.month - 1]}-${built.data.year}.pdf`,
    employeeEmail: built.employeeEmail,
    employeeName: built.employeeName,
    month: built.data.month,
    year: built.data.year,
  }
}

/**
 * Emails the slip to the employee. Never throws - payroll approval must not be
 * rolled back because SMTP was briefly unavailable; the caller reports the
 * delivery status back to the UI instead.
 */
export async function emailPayslip(salaryRecordId: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const slip = await generatePayslipPdf(salaryRecordId)
    if (!slip) return { sent: false, error: 'Salary record not found' }
    if (!slip.employeeEmail) return { sent: false, error: 'Employee has no email address' }

    const period = `${MONTH_LABEL[slip.month - 1]} ${slip.year}`
    await emailProvider.send({
      to: [slip.employeeEmail],
      subject: `Payslip for ${period}`,
      body: `<p>Dear ${slip.employeeName},</p>
<p>Please find attached your payslip for <strong>${period}</strong>.</p>
<p>This is a computer generated payslip and does not require a signature. For any queries, please contact the HR department.</p>
<p>Regards,<br/>HR Department<br/>Aspiration Cleantech Ventures Pvt Ltd</p>`,
      attachments: [{ filename: slip.filename, content: slip.buffer }],
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Failed to send payslip email' }
  }
}
