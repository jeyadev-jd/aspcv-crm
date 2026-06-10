import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const STANDARD_INDUSTRIES = [
  'Solar Energy', 'HVAC', 'Manufacturing', 'Real Estate', 'Hospitality',
  'Healthcare', 'F&B', 'Education', 'Logistics', 'Government', 'Retail', 'IT', 'Construction',
  'Textile', 'Pharma', 'Automotive', 'Food Processing', 'Cold Storage', 'Dairy', 'Chemical',
]

const STANDARD_DESIGNATIONS = [
  'CEO', 'MD', 'Director', 'VP', 'AVP', 'GM', 'DGM', 'AGM',
  'Manager', 'Senior Manager', 'Assistant Manager',
  'Engineer', 'Senior Engineer', 'Chief Engineer',
  'Procurement Manager', 'Purchase Manager', 'Procurement Officer',
  'Project Manager', 'Project Engineer', 'Site Engineer',
  'Operations Manager', 'Operations Head',
  'Maintenance Manager', 'Facility Manager',
  'Sustainability Head', 'Energy Manager',
  'Business Development Manager', 'Sales Manager',
  'Finance Manager', 'CFO', 'Accounts Manager',
  'HR Manager', 'Admin Manager',
  'Consultant', 'Advisor',
]

async function main() {
  // Industries
  for (const name of STANDARD_INDUSTRIES) {
    await prisma.industry.upsert({ where: { name }, update: {}, create: { name } })
  }

  // Designations
  for (const name of STANDARD_DESIGNATIONS) {
    await prisma.designation.upsert({ where: { name }, update: {}, create: { name } })
  }

  // Admin user
  const hash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aspcv.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@aspcv.com', passwordHash: hash, role: 'Admin' },
  })

  // Sales user
  const salesHash = await bcrypt.hash('sales123', 10)
  const sales = await prisma.user.upsert({
    where: { email: 'james@aspcv.com' },
    update: {},
    create: { name: 'James K', email: 'james@aspcv.com', passwordHash: salesHash, role: 'Sales' },
  })

  // Companies
  const companies = await Promise.all([
    prisma.company.upsert({ where: { id: 'company-1' }, update: {}, create: { id: 'company-1', name: 'Yorkshire Housing Trust', industry: 'Real Estate', email: 'info@yht.co.uk', phone: '+44 113 2221000' } }),
    prisma.company.upsert({ where: { id: 'company-2' }, update: {}, create: { id: 'company-2', name: 'GreenBuild Developers', industry: 'Construction', email: 'info@greenbuild.com', phone: '+44 161 4450900' } }),
    prisma.company.upsert({ where: { id: 'company-3' }, update: {}, create: { id: 'company-3', name: 'Eco Living Solutions', industry: 'Sustainability', email: 'info@ecoliving.co.uk', phone: '+44 207 8830100' } }),
    prisma.company.upsert({ where: { id: 'company-4' }, update: {}, create: { id: 'company-4', name: 'BioWarm Engineering', industry: 'Engineering', email: 'info@biowarm.co.uk', phone: '+44 121 5630000' } }),
  ])

  // Leads
  const lead1 = await prisma.lead.upsert({
    where: { id: 'lead-1' },
    update: {},
    create: {
      id: 'lead-1', companyId: companies[0].id, title: 'Air Source Heat Pump — Yorkshire Housing Trust',
      source: 'Channel Partner', region: 'North', commercialType: 'Capex',
      estimatedValue: 125000, status: 'Enquiry', closeDate: new Date('2026-06-30'),
      notes: 'Interested in phase 2 expansion.',
      contacts: { create: [{ name: 'Sarah Mitchell', designation: 'Procurement Manager', email: 'sarah@yht.co.uk', phone: '+44 113 2221001', isPrimary: true }] },
    },
  })

  const lead2 = await prisma.lead.upsert({
    where: { id: 'lead-2' },
    update: {},
    create: {
      id: 'lead-2', companyId: companies[1].id, title: 'Solar Tunnel Dryer — GreenBuild',
      source: 'Direct', region: 'West', commercialType: 'Opex',
      estimatedValue: 78000, status: 'ProspectiveLead', closeDate: new Date('2026-07-15'),
      contacts: { create: [{ name: 'Tom Bradshaw', designation: 'Director', email: 'tom@greenbuild.com', phone: '+44 161 4450932', isPrimary: true }] },
    },
  })

  // Add lead owners
  await prisma.leadOwner.upsert({
    where: { leadId_userId: { leadId: lead1.id, userId: sales.id } },
    update: {},
    create: { leadId: lead1.id, userId: sales.id, role: 'primary' },
  })

  console.log('Seed complete. Users: admin@aspcv.com/admin123, james@aspcv.com/sales123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
