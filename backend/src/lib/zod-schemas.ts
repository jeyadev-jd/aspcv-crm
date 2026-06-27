import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  source: z.string().default('Direct'),
  region: z.enum(['North', 'West', 'South', 'East']),
  commercialType: z.enum(['Capex', 'Opex', 'Deferred', 'Esco', 'Rental']),
  productId: z.string().optional(),
  estimatedValue: z.number().optional(),
  closeDate: z.string().optional(),
  status: z.enum(['Enquiry', 'ProspectiveLead', 'ProjectHold', 'Hibernated', 'OrderWon', 'OrderLost']).default('Enquiry'),
  notes: z.string().optional(),
  leadDate: z.string().optional(),
  monthlyRemarks: z.string().optional(),
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
  password: z.string().min(8),
  role: z.enum(['SuperAdmin', 'BusinessHead', 'ProjectHead', 'SalesHead', 'Manager', 'SeniorEngineer', 'Engineer', 'Technician', 'Accountant', 'HR', 'Viewer']),
  designationId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  joiningDate: z.string().optional(),
  department: z.string().optional(),
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
})

export const projectSchema = z.object({
  companyId: z.string(),
  dealId: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['Planning', 'Active', 'OnHold', 'Completed']).default('Planning'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  actualBudget: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

export const installationSchema = z.object({
  companyId: z.string(),
  projectId: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['Scheduled', 'InProgress', 'Completed', 'OnHold']).default('Scheduled'),
  scheduledDate: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
})

export const ticketSchema = z.object({
  companyId: z.string(),
  contactId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  status: z.enum(['Open', 'InProgress', 'Resolved', 'Closed']).default('Open'),
  notes: z.string().optional(),
})
