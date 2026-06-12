import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const ROLE_DEFS = [
  { name: 'SuperAdmin',          displayName: 'Super Admin',          isSystem: true,  sortOrder: 1  },
  { name: 'BusinessHead',        displayName: 'Business Head',        isSystem: true,  sortOrder: 2  },
  { name: 'ProjectHead',         displayName: 'Project Head',         isSystem: true,  sortOrder: 3  },
  { name: 'SalesHead',           displayName: 'Sales Head',           isSystem: true,  sortOrder: 4  },
  { name: 'Manager',             displayName: 'Manager',              isSystem: true,  sortOrder: 5  },
  { name: 'SeniorEngineer',      displayName: 'Senior Engineer',      isSystem: true,  sortOrder: 6  },
  { name: 'Engineer',            displayName: 'Engineer',             isSystem: true,  sortOrder: 7  },
  { name: 'Technician',          displayName: 'Technician',           isSystem: true,  sortOrder: 8  },
  { name: 'Accountant',          displayName: 'Accountant',           isSystem: true,  sortOrder: 9  },
  { name: 'HR',                  displayName: 'HR',                   isSystem: true,  sortOrder: 10 },
  { name: 'SalesRepresentative', displayName: 'Sales Representative', isSystem: false, sortOrder: 11 },
  { name: 'Viewer',              displayName: 'Viewer',               isSystem: true,  sortOrder: 12 },
]

const PERMISSIONS: Record<string, string[]> = {
  SuperAdmin: [
    'lead:create','lead:read_own','lead:read_all','lead:edit','lead:delete',
    'deal:create','deal:read_own','deal:read_all','deal:edit','deal:delete',
    'contact:create','contact:read_own','contact:read_all','contact:edit','contact:delete',
    'company:create','company:read_all','company:edit','company:delete',
    'project:create','project:read_all','project:edit','project:delete',
    'material_request:create','material_request:read_own','material_request:read_all',
    'material_request:approve_manager','material_request:approve_bizhead','material_request:approve_accountant','material_request:reject',
    'component:create','component:read_all','component:edit','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all',
    'salary:generate','salary:approve','salary:mark_paid','salary:read_own','salary:read_all',
    'hr_user:create','hr_user:read_all','hr_user:edit','hr_user:deactivate',
    'financial:create','financial:read_all','financial:edit','financial:delete',
    'task:create','task:read_own','task:read_all','task:edit','task:delete',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'approval_request:create','approval_request:review',
    'role_admin:manage',
    'kanban:read_all','kanban:edit',
    'calendar:read_all','calendar:edit',
    'product:read_all','product:create','product:edit','product:delete',
    'invoice:read_all','invoice:create','invoice:edit','invoice:delete',
    'installation:read_all','installation:create','installation:edit',
    'support:read_all','support:create','support:edit',
  ],
  BusinessHead: [
    'lead:read_all','deal:read_all','contact:read_all','company:read_all',
    'project:read_all','material_request:read_all','material_request:approve_bizhead',
    'component:read_all','attendance:read_all','salary:read_all',
    'hr_user:read_all','financial:read_all','task:read_all',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'approval_request:create',
    'kanban:read_all','calendar:read_all',
    'invoice:read_all','installation:read_all','support:read_all',
  ],
  ProjectHead: [
    'project:create','project:read_all','project:edit',
    'material_request:create','material_request:read_all','material_request:approve_manager',
    'component:read_all','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all',
    'salary:read_own',
    'contact:read_all','company:read_all',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:create','task:read_all','task:edit',
    'approval_request:create',
    'installation:read_all','installation:create','installation:edit',
    'support:read_all',
  ],
  SalesHead: [
    'lead:read_all','deal:read_all','deal:create',
    'contact:read_all','company:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:create','task:read_all','task:edit',
    'approval_request:create',
    'kanban:read_all','calendar:read_all',
  ],
  Manager: [
    'lead:create','lead:read_all','lead:edit',
    'deal:create','deal:read_all','deal:edit',
    'contact:create','contact:read_all','contact:edit',
    'company:read_all',
    'project:create','project:read_all','project:edit',
    'material_request:create','material_request:read_all','material_request:approve_manager','material_request:reject',
    'component:read_all','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:create','task:read_all','task:edit','task:delete',
    'approval_request:create',
    'kanban:read_all','kanban:edit','calendar:read_all','calendar:edit',
  ],
  SeniorEngineer: [
    'material_request:create','material_request:read_own',
    'project:read_all','component:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:create','task:read_own','task:edit',
    'approval_request:create',
    'installation:read_all',
  ],
  Engineer: [
    'material_request:create','material_request:read_own',
    'project:read_all','component:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:create','task:read_own','task:edit',
    'approval_request:create',
    'installation:read_all',
  ],
  Technician: [
    'material_request:create','material_request:read_own',
    'project:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'task:read_own',
    'approval_request:create',
  ],
  Accountant: [
    'material_request:read_all','material_request:approve_accountant',
    'financial:create','financial:read_all','financial:edit',
    'salary:mark_paid','salary:read_all',
    'attendance:read_own',
    'invoice:read_all','invoice:create',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'approval_request:create',
  ],
  HR: [
    'hr_user:create','hr_user:read_all','hr_user:edit','hr_user:deactivate',
    'salary:generate','salary:approve','salary:mark_paid','salary:read_all',
    'attendance:read_all',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own',
    'approval_request:create',
  ],
  SalesRepresentative: [
    'lead:create','lead:read_own',
    'deal:create','deal:read_own',
    'contact:create','contact:read_own',
    'company:read_all',
    'task:create','task:read_own','task:edit',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:edit_own','discussion:delete_own',
    'approval_request:create',
    'calendar:read_all',
  ],
  Viewer: [
    'lead:read_all','deal:read_all','contact:read_all','company:read_all',
    'project:read_all','discussion:read_all',
    'kanban:read_all','calendar:read_all',
    'invoice:read_all','product:read_all',
  ],
}

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
    create: { name: 'Admin', email: 'admin@aspcv.com', passwordHash: hash, role: 'SuperAdmin', roleName: 'SuperAdmin' },
  })

  // Sales user
  const salesHash = await bcrypt.hash('sales123', 10)
  const sales = await prisma.user.upsert({
    where: { email: 'james@aspcv.com' },
    update: {},
    create: { name: 'James K', email: 'james@aspcv.com', passwordHash: salesHash, role: 'Manager', roleName: 'Manager' },
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

  // Sync LeadContacts → global Contact table
  await prisma.contact.upsert({
    where: { companyId_email: { companyId: companies[0].id, email: 'sarah@yht.co.uk' } },
    update: {},
    create: { companyId: companies[0].id, name: 'Sarah Mitchell', designation: 'Procurement Manager', email: 'sarah@yht.co.uk', phone: '+44 113 2221001' },
  })
  await prisma.contact.upsert({
    where: { companyId_email: { companyId: companies[1].id, email: 'tom@greenbuild.com' } },
    update: {},
    create: { companyId: companies[1].id, name: 'Tom Bradshaw', designation: 'Director', email: 'tom@greenbuild.com', phone: '+44 161 4450932' },
  })

  // RoleDefinitions + Permissions
  console.log('Seeding RoleDefinitions + Permissions...')
  for (const rd of ROLE_DEFS) {
    const created = await prisma.roleDefinition.upsert({
      where: { name: rd.name },
      update: { displayName: rd.displayName, sortOrder: rd.sortOrder },
      create: rd,
    })
    const perms = PERMISSIONS[rd.name] ?? []
    for (const perm of perms) {
      const [resource, action] = perm.split(':')
      await prisma.rolePermission.upsert({
        where: { roleDefinitionId_resource_action: { roleDefinitionId: created.id, resource, action } },
        update: { allowed: true },
        create: { roleDefinitionId: created.id, resource, action, allowed: true },
      })
    }
    console.log(`  ${rd.name}: ${perms.length} permissions`)
  }

  // Backfill roleName on existing users to match their role enum
  await prisma.$executeRaw`UPDATE "User" SET "roleName" = role::text WHERE TRUE`

  console.log('Seed complete. Users: admin@aspcv.com/admin123, james@aspcv.com/sales123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
