import { z } from 'zod'

// `.partial().parse(body)` re-applies each field's `.default()` whenever that key
// is absent from `body` — silently overwriting real values on partial updates
// (e.g. a progress-only save resetting `status` back to its schema default).
// Use this after `.partial().parse()` on any edit/PATCH route to strip back out
// fields the caller never actually sent.
export function stripUnsentDefaults<T extends Record<string, unknown>>(parsed: T, rawBody: Record<string, unknown>): T {
  for (const key of Object.keys(parsed)) {
    if (!(key in rawBody)) delete (parsed as Record<string, unknown>)[key]
  }
  return parsed
}

/**
 * One password policy for every path that sets a password. User creation already
 * enforced these rules while password *changes* only checked length, so an
 * account could be created strong and then downgraded to "aaaaaaaa".
 *
 * The common-password list covers the handful that dictionary attacks try first,
 * including ones built from this project's own name.
 */
const WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'admin123', 'welcome1', 'letmein1', 'iloveyou',
  'aspcv123', 'aspcv1234', 'changeme', 'passw0rd', 'abcd1234',
])

export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Need uppercase')
  .regex(/[0-9]/, 'Need number')
  .regex(/[^A-Za-z0-9]/, 'Need special char')
  .refine(p => !WEAK_PASSWORDS.has(p.toLowerCase()), 'That password is too common — choose another')
  .refine(p => !/^(.)\1+$/.test(p), 'Password cannot be a single repeated character')

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: strongPassword,
})

export const companySchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional(),
  industry: z.string().optional(),
  customerType: z.enum(['Indian', 'International']).default('Indian'),
  region: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  stateCode: z.string().optional(),
  areaCode: z.string().optional(),
  cityCode: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const contactSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  notes: z.string().optional(),
})

export const leadSchema = z.object({
  companyId: z.string(),
  title: z.string().min(1),
  // Accepted as transient input only (e.g. a raw-string API caller) — resolved to the
  // matching master-data FK via strict lookup in leads.ts, never written to the DB.
  source: z.string().optional(),
  region: z.string().optional(),
  commercialType: z.string().optional(),
  // Phase 1 master-data FKs — the source of truth.
  regionId: z.string().optional(),
  commercialModelId: z.string().optional(),
  leadSourceId: z.string().optional(),
  leadNumber: z.string().optional(), // server-generated, ignored if sent
  productId: z.string().optional(),
  estimatedValue: z.number().optional(),
  closeDate: z.string().optional(),
  status: z.enum(['Enquiry', 'ProspectiveLead', 'ProjectHold', 'Hibernated', 'OrderWon', 'OrderLost']).default('Enquiry'),
  notes: z.string().optional(),
  leadDate: z.string().optional(),
  monthlyRemarks: z.string().optional(),
  departmentId: z.string().optional(),
  // Phase 1: ownership tiers, capacity, temperature
  primaryOwnerId: z.string().optional(),
  secondaryOwnerId: z.string().optional(),
  salesManagerId: z.string().optional(),
  businessHeadId: z.string().optional(),
  capacityValue: z.number().optional(),
  capacityUnitId: z.string().optional(),
  tempRangeMin: z.number().optional(),
  tempRangeMax: z.number().optional(),
  contacts: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    designation: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  sources: z.array(z.object({
    source: z.string(),
    sourceName: z.string().optional(),
  })).optional(),
})

export const discussionSchema = z.object({
  type: z.enum(['VoiceCall', 'VideoCall', 'Meeting', 'WhatsApp', 'Email', 'SiteVisit', 'ManualDiscussion']),
  category: z.string().optional(),
  title: z.string().min(1),
  entityType: z.string(),
  entityId: z.string(),
  scheduledAt: z.string().optional(),
  summary: z.string().optional(),
  decisions: z.string().optional(),
  nextActions: z.string().optional(),
  followUpAt: z.string().optional(),
  participantUserIds: z.array(z.string()).optional(),
  participantContactIds: z.array(z.string()).optional(),
})

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: strongPassword,
  role: z.enum(['SuperAdmin', 'BusinessHead', 'ProjectHead', 'SalesHead', 'Manager', 'SeniorEngineer', 'Engineer', 'Technician', 'Accountant', 'HR', 'Viewer']),
  designationId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  joiningDate: z.string().optional(),
  departmentId: z.string().optional(),
  baseSalary: z.number().optional(),
  hra: z.number().optional(),
  allowances: z.number().optional(),
  pfApplicable: z.boolean().optional(),
  esiApplicable: z.boolean().optional(),
  pan: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  bankName: z.string().optional(),
  emergencyContact: z.string().optional(),
})

export const dealSchema = z.object({
  companyId: z.string(),
  leadId: z.string().optional(),
  title: z.string().min(1),
  stage: z.enum(['LeadIn', 'Proposal', 'Negotiation', 'OrderWon', 'OrderLost']).default('Proposal'),
  value: z.number().optional(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().optional(),
  productId: z.string().optional(),
  notes: z.string().optional(),
  ownerIds: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  regionId: z.string().optional(),
  commercialModelId: z.string().optional(),
  // Technical spec carried from the Lead
  capacityValue: z.number().nullish(),
  capacityUnitId: z.string().nullish(),
  tempRangeMin: z.number().nullish(),
  tempRangeMax: z.number().nullish(),
})

export const projectSchema = z.object({
  companyId: z.string(),
  dealId: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['Planning', 'Engineering', 'Procurement', 'Manufacturing', 'Installation', 'Testing', 'Completed', 'Cancelled', 'Active', 'OnHold']).default('Planning'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  actualBudget: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  autoProgress: z.boolean().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
  // Technical spec carried from the Deal
  capacityValue: z.number().nullish(),
  capacityUnitId: z.string().nullish(),
  tempRangeMin: z.number().nullish(),
  tempRangeMax: z.number().nullish(),
  // Cost breakdown (approval-gated for non-admins)
  purchaseCost: z.number().optional(),
  manufacturingCost: z.number().optional(),
  labourCost: z.number().optional(),
  serviceCost: z.number().optional(),
  // ESCO execution budget, planned per cost centre
  budgetEquipment: z.number().nonnegative().optional(),
  budgetProcurement: z.number().nonnegative().optional(),
  budgetInstallation: z.number().nonnegative().optional(),
  budgetCivilWorks: z.number().nonnegative().optional(),
  budgetElectrical: z.number().nonnegative().optional(),
  budgetLogistics: z.number().nonnegative().optional(),
  budgetCommissioning: z.number().nonnegative().optional(),
  budgetOMReserve: z.number().nonnegative().optional(),
  budgetContingency: z.number().nonnegative().optional(),
  actualCivilWorks: z.number().nonnegative().optional(),
  actualElectrical: z.number().nonnegative().optional(),
  actualLogistics: z.number().nonnegative().optional(),
  actualCommissioning: z.number().nonnegative().optional(),
  // Warranty
  warrantyPeriod: z.number().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  installationCost: z.number().optional(),
  // Assignment
  assignedPMId: z.string().optional(),
  // Handover — set at deal close-won, editable later by anyone with project edit rights
  handoverNotes: z.string().nullish(),
  handoverOneDriveUrl: z.string().url().nullish(),
})

export const installationSchema = z.object({
  companyId: z.string(),
  projectId: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['Scheduled', 'InProgress', 'Completed', 'OnHold']).default('Scheduled'),
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
  scopeItemId: z.string().nullable().optional(),
})

export const calendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string(),
  startTime: z.string().default('00:00'),
  endTime: z.string().default('00:00'),
  color: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  category: z.enum(['FollowUp', 'Meeting', 'Installation', 'Commissioning', 'EngineerVisit', 'WarrantyExpiry', 'AMCRenewal', 'ServiceVisit', 'CustomerReview', 'ProjectMilestone', 'Other']).optional(),
  audience: z.enum(['Private', 'Department', 'Everyone']).default('Private'),
  // Only meaningful for audience 'Department'. Omitted means "my department".
  departmentId: z.string().optional().nullable(),
})

export const TICKET_CATEGORIES = [
  'Installation', 'Warranty', 'AMC', 'Performance', 'Billing', 'Other',
] as const

export const ticketSchema = z.object({
  companyId: z.string(),
  contactId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  installationId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(TICKET_CATEGORIES).optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  status: z.enum(['Open', 'InProgress', 'Resolved', 'Closed']).default('Open'),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
})
