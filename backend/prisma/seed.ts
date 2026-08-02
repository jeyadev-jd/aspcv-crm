import { PrismaClient, Role, CustomerType, LeadStatus, LifecycleStage, DealStage, ProjectStatus, InstallationStatus, TicketPriority, TicketStatus, TaskStatus, QuotationStatus, POStatus, WorkOrderStatus, ServiceRequestStatus } from '@prisma/client'
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
  { name: 'Marketing',           displayName: 'Marketing',            isSystem: false, sortOrder: 12 },
  { name: 'Viewer',              displayName: 'Viewer',               isSystem: true,  sortOrder: 13 },
]

const PERMISSIONS: Record<string, string[]> = {
  SuperAdmin: [
    'lead:create','lead:read_own','lead:read_all','lead:edit','lead:delete',
    'deal:create','deal:read_own','deal:read_all','deal:edit','deal:delete','deal:assign_pm','deal:assign_se',
    'dealer:create','dealer:read_all','dealer:edit','dealer:delete',
    'dealer_item:create','dealer_item:read_all','dealer_item:edit','dealer_item:delete',
    'contact:create','contact:read_own','contact:read_all','contact:edit','contact:delete',
    'company:create','company:read_all','company:edit','company:delete',
    'project:create','project:read_all','project:edit','project:delete',
    'material_request:create','material_request:read_own','material_request:read_all',
    'material_request:approve_manager','material_request:approve_bizhead','material_request:approve_accountant','material_request:reject',
    'component:create','component:read_all','component:edit','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all','attendance:edit',
    'salary:generate','salary:approve','salary:mark_paid','salary:read_own','salary:read_all',
    'hr_user:create','hr_user:read_all','hr_user:edit','hr_user:deactivate',
    'financial:create','financial:read_all','financial:edit','financial:delete',
    'task:create','task:read_own','task:read_all','task:edit','task:delete',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'approval_request:create','approval_request:review',
    'role_admin:manage','audit_log:read_all','business_rule:read_all','business_rule:edit',
    'calendar:read_all','calendar:edit',
    'product:read_all','product:create','product:edit','product:delete',
    'invoice:read_all','invoice:create','invoice:edit','invoice:delete',
    'installation:read_all','installation:create','installation:edit',
    'support:read_all','support:create','support:edit',
    'purchase_order:create','purchase_order:read_all','purchase_order:edit','purchase_order:approve','purchase_order:delete',
    'quotation:create','quotation:read_all','quotation:edit','quotation:delete','quotation:approve',
    'goods_receipt:create','goods_receipt:read_all',
    'work_order:create','work_order:read_all','work_order:edit','work_order:delete',
    'service_record:create','service_record:read_all','service_record:edit',
    'signatory:create','signatory:read_all','signatory:edit','signatory:delete',
    'bank_account:create','bank_account:read_all','bank_account:edit','bank_account:delete',
    'inventory_allocation:create','inventory_allocation:read_all','inventory_allocation:delete',
  ],
  BusinessHead: [
    'lead:read_all','deal:read_all','deal:assign_pm','deal:assign_se','contact:read_all','contact:edit','company:read_all','company:edit',
    'dealer:read_all','dealer_item:read_all',
    'project:read_all','material_request:read_all','material_request:approve_bizhead',
    'component:read_all','attendance:read_all','salary:read_all',
    'hr_user:read_all','financial:read_all','task:read_all',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'approval_request:create','approval_request:review',
    'calendar:read_all',
    'invoice:read_all','installation:read_all','support:read_all',
    'purchase_order:read_all','quotation:read_all','quotation:approve',
    'goods_receipt:read_all','work_order:read_all','service_record:read_all',
    'signatory:read_all','bank_account:read_all','inventory_allocation:read_all',
  ],
  ProjectHead: [
    'project:create','project:read_all','project:edit',
    'deal:read_all','deal:assign_se',
    'dealer:read_all','dealer_item:create','dealer_item:read_all','dealer_item:edit',
    'material_request:create','material_request:read_all','material_request:approve_manager',
    'component:read_all','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all',
    'salary:read_own',
    'contact:read_all','contact:edit','company:read_all','company:edit',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:create','task:read_all','task:edit',
    'approval_request:create','approval_request:review',
    'installation:read_all','installation:create','installation:edit',
    'support:read_all',
    'purchase_order:create','purchase_order:read_all','purchase_order:edit','purchase_order:approve',
    'goods_receipt:create','goods_receipt:read_all',
    'work_order:create','work_order:read_all','work_order:edit',
    'service_record:create','service_record:read_all','service_record:edit',
    'inventory_allocation:create','inventory_allocation:read_all','inventory_allocation:delete',
  ],
  SalesHead: [
    'lead:read_all','lead:create','lead:edit','deal:read_all','deal:create','deal:edit','deal:assign_pm',
    // Sales owns the renewal conversation when a contract nears expiry.
    
    'dealer:read_all','dealer_item:read_all',
    'contact:read_all','contact:edit','company:read_all','company:edit',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:create','task:read_all','task:edit',
    'approval_request:create',
    'calendar:read_all',
    'quotation:create','quotation:read_all','quotation:edit',
  ],
  Manager: [
    'lead:create','lead:read_all','lead:edit',
    'deal:create','deal:read_all','deal:edit','deal:assign_pm','deal:assign_se',
    'dealer:create','dealer:read_all','dealer:edit','dealer:delete',
    'dealer_item:create','dealer_item:read_all','dealer_item:edit','dealer_item:delete',
    'contact:create','contact:read_all','contact:edit',
    'company:read_all',
    'project:create','project:read_all','project:edit',
    'material_request:create','material_request:read_all','material_request:approve_manager','material_request:reject',
    'component:read_all','component:assign',
    'attendance:checkin','attendance:read_own','attendance:read_all',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:create','task:read_all','task:edit','task:delete',
    'approval_request:create','approval_request:review',
    'calendar:read_all','calendar:edit',
    'purchase_order:create','purchase_order:read_all','purchase_order:edit','purchase_order:approve','purchase_order:delete',
    'quotation:create','quotation:read_all','quotation:edit','quotation:delete',
    'goods_receipt:create','goods_receipt:read_all',
    'work_order:create','work_order:read_all','work_order:edit','work_order:delete',
    'service_record:create','service_record:read_all','service_record:edit',
    'signatory:create','signatory:read_all','signatory:edit','signatory:delete',
    'bank_account:create','bank_account:read_all','bank_account:edit','bank_account:delete',
    'inventory_allocation:create','inventory_allocation:read_all','inventory_allocation:delete',
  ],
  SeniorEngineer: [
    'material_request:create','material_request:read_own',
    'dealer_item:read_all',
    'project:read_all','component:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:create','task:read_own','task:edit',
    'approval_request:create',
    'installation:read_all',
        'work_order:read_all','work_order:edit',
  ],
  Engineer: [
    'material_request:create','material_request:read_own',
    'dealer_item:read_all',
    'project:read_all','component:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:create','task:read_own','task:edit',
    'approval_request:create',
    'installation:read_all',
    'work_order:read_all','work_order:edit',
  ],
  Technician: [
    'material_request:create','material_request:read_own',
    'dealer_item:read_all',
    'project:read_all',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'task:read_own',
    'approval_request:create',
    'work_order:read_all','service_record:read_all',
  ],
  Accountant: [
    'material_request:read_all','material_request:approve_accountant',
    'financial:create','financial:read_all','financial:edit',
    'salary:mark_paid','salary:read_all',
    'attendance:read_own',
    'invoice:read_all','invoice:create',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
    'approval_request:create',
    'purchase_order:read_all','quotation:read_all',
    'goods_receipt:read_all',
    'signatory:read_all','bank_account:read_all',
  ],
  HR: [
    'hr_user:create','hr_user:read_all','hr_user:edit','hr_user:deactivate',
    'salary:generate','salary:approve','salary:mark_paid','salary:read_all',
    // attendance:edit lets HR mark a day Present; a future date still needs
    // Business Head approval before it is written.
    'attendance:read_all','attendance:edit',
    'discussion:create','discussion:read_all','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all','attachment:delete',
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
    'discussion:create','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all',
    'approval_request:create',
    'calendar:read_all',
  ],
  Marketing: [
    'lead:create','lead:read_own',
    'deal:create','deal:read_own',
    'contact:create','contact:read_own',
    'company:read_all',
    'task:create','task:read_own','task:edit',
    'attendance:checkin','attendance:read_own',
    'salary:read_own',
    'discussion:create','discussion:edit_own','discussion:delete_own','attachment:create','attachment:read_all',
    'approval_request:create',
    'calendar:read_all',
  ],
  Viewer: [
    'lead:read_all','deal:read_all','contact:read_all','company:read_all',
    'dealer:read_all','dealer_item:read_all',
    'project:read_all','discussion:read_all',
    'calendar:read_all',
    'invoice:read_all','product:read_all',
    'purchase_order:read_all','quotation:read_all',
    'goods_receipt:read_all','work_order:read_all','service_record:read_all',
    'inventory_allocation:read_all',
  ],
}

const STANDARD_INDUSTRIES = [
  'Solar Energy', 'HVAC', 'Manufacturing', 'Real Estate', 'Hospitality',
  'Healthcare', 'F&B', 'Education', 'Logistics', 'Government', 'Retail', 'IT', 'Construction',
  'Textile', 'Pharma', 'Automotive', 'Food Processing', 'Cold Storage', 'Dairy', 'Chemical',
]

const STANDARD_DESIGNATIONS = [
  'CEO', 'MD', 'Director', 'VP', 'AVP', 'GM', 'DGM', 'AGM',
  'Manager', 'Senior Manager', 'Assistant Manager', 'Manager - Service',
  'Engineer', 'Senior Engineer', 'Chief Engineer', 'Technician',
  'Procurement Manager', 'Purchase Manager', 'Procurement Officer',
  'Project Manager', 'Project Engineer', 'Site Engineer',
  'Operations Manager', 'Operations Head',
  'Maintenance Manager', 'Facility Manager',
  'Sustainability Head', 'Energy Manager',
  'Business Development Manager', 'Sales Manager', 'Channel Sales', 'Business Development',
  'Finance Manager', 'CFO', 'Accounts Manager', 'Accounts Executive',
  'HR Manager', 'Admin Manager', 'HR Officer',
  'Digital Marketing Executive', 'Mechanical Engineer',
  'Consultant', 'Advisor',
]

const DEPARTMENTS = [
  'Management',
  'Sales',
  'HR',
  'Accounts',
  'Project',
  'Engineering',
  'Procurement',
  'Manufacturing',
  'Service',
  'Marketing',
]

// ── ERP Phase 1 master data ──
const REGIONS = ['North', 'South', 'East', 'West']
const COUNTRIES = ['India', 'UAE', 'Saudi Arabia', 'Bangladesh', 'Sri Lanka', 'Nepal']
const COMMERCIAL_MODELS = ['Capex', 'Opex', 'Deferred', 'Esco', 'Rental']
const LEAD_SOURCES_MASTER = ['Direct', 'Referral', 'Channel Partner', 'Exhibition', 'Website', 'Cold Call', 'Social Media']
const REASON_CODES = [
  { name: 'Budget Constraint', category: 'lost_reason' },
  { name: 'Lost to Competitor', category: 'lost_reason' },
  { name: 'Project Cancelled', category: 'lost_reason' },
  { name: 'No Response', category: 'lost_reason' },
  { name: 'Timeline Mismatch', category: 'lost_reason' },
  { name: 'Awaiting Client Budget Approval', category: 'hold_reason' },
  { name: 'Site Not Ready', category: 'hold_reason' },
]
const CAPACITY_UNITS = ['kW', 'MW', 'TR', 'TPD', 'LPH', 'Nm3/hr', 'kg/hr']
const SOLUTION_CATEGORIES: Record<string, string[]> = {
  'Heat Pump': ['Air Source Heat Pump', 'Water Source Heat Pump', 'Swimming Pool Heat Pump'],
  'Pump Dryer': ['Heat Pump Dryer', 'Solar Dryer', 'Solar Tunnel Dryer', 'Sludge Dryer'],
  'Chiller': ['Chiller'],
  'Waste Heat Recovery': ['Waste Heat Recovery'],
  'ORC': ['ORC'],
  'LED Lights & BLDC Fans': ['LED Lights & BLDC Fans'],
}
const SOLUTION_ACCESSORIES = ['Buffer Tank', 'Pump Set', 'Control Panel', 'Insulation Kit', 'Piping Kit', 'Remote Monitoring']

const INDIAN_FIRST_NAMES = [
  'Aarav', 'Arjun', 'Aditya', 'Vikram', 'Rahul', 'Priya', 'Kavya', 'Ananya',
  'Rajesh', 'Suresh', 'Ramesh', 'Sunil', 'Deepak', 'Neha', 'Sneha', 'Rohan',
  'Sanjay', 'Amit', 'Ajay', 'Sandeep', 'Vijay', 'Anil', 'Harish', 'Vinay',
  'Manoj', 'Dev', 'Sai', 'Karthik', 'Murali', 'Balaji', 'Lakshmi', 'Shanti',
  'Divya', 'Swati', 'Ritu', 'Meenakshi', 'Gaurav', 'Manish', 'Alok', 'Abhishek',
  'Kiran', 'Pranav', 'Rohit', 'Sameer', 'Shrikant', 'Rakesh', 'Siddharth', 'Nitin',
  'Tarun', 'Aniket', 'Vivek', 'Yash', 'Pooja', 'Shruti', 'Aditi', 'Jyoti', 'Shweta'
]

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Iyer', 'Patel', 'Rao', 'Mehta', 'Nair',
  'Pillai', 'Joshi', 'Reddy', 'Naidu', 'Singh', 'Prasad', 'Kumar', 'Sen',
  'Banerjee', 'Chatterjee', 'Mukherjee', 'Das', 'Roy', 'Bose', 'Dutta', 'Ghosh',
  'Bhat', 'Shenoy', 'Prabhu', 'Kamath', 'Pai', 'Menon', 'Joshi', 'Choudhury',
  'Pandey', 'Mishra', 'Tripathi', 'Trivedi', 'Bahl', 'Sareen', 'Deshmukh', 'Kulkarni'
]

const INDIAN_COMPANY_PREFIXES = [
  'ABC', 'Shakti', 'Chennai', 'Bangalore', 'Bharat', 'Sri Lakshmi', 'Deccan',
  'Ganga', 'Krishna', 'Godavari', 'Kaveri', 'Himalaya', 'Apex', 'Premier',
  'Supreme', 'Titan', 'Vanguard', 'Matrix', 'Zenith', 'Phoenix', 'Nexus',
  'Om', 'Sai', 'Balaji', 'Karthik', 'Falcon', 'Alpha', 'Beta', 'Omega',
  'Tata', 'Birla', 'Mahindra', 'Reliance', 'Adani', 'Godrej', 'Wipro', 'Infosys'
]

const INDIAN_COMPANY_SUFFIXES = [
  'Engineering Pvt. Ltd.', 'Industrial Solutions', 'Precision Components',
  'Automation Systems', 'Traders', 'Cleantech Enterprises', 'Technologies Ltd.',
  'Infrastructure', 'Controls & Systems', 'Ventures', 'Manufacturing Pvt. Ltd.',
  'Energy Solutions', 'Air Systems', 'Thermal Dynamics', 'Eco Systems'
]

const PROJECT_TITLES = [
  'HVAC Installation', 'Solar Rooftop System', 'Fire Safety Automation',
  'Industrial Cooling Upgrade', 'Waste Heat Recovery', 'Smart Grid Integration',
  'Wind Turbine Assembly', 'Rainwater Harvesting', 'Effluent Treatment Plant',
  'Boiler Efficiency System', 'Biomass Power Plant', 'LED Lighting Retrofit'
]

const COMPONENT_NAMES = [
  'Copper Cable 4 SQMM', 'MCB 63A', 'PVC Conduit Pipe', 'Temperature Sensor',
  'VFD Drive 15kW', 'Industrial Relay', 'Control Panel Enclosure', 'Pressure Gauge',
  'Solenoid Valve', 'Contactor 32A', 'Terminal Block', 'Cable Gland',
  'Scroll Compressor 5HP', 'Plate Heat Exchanger 50kW', 'Shell & Tube Condenser',
  'GI Ducting Sheet 24G', 'SS304 Flexible Duct Connector', 'Flow Meter',
  'RTD Pt100 Sensor', 'Limit Switch', 'Refrigerant R-32 Cylinder',
  'Expansion Valve', 'Air Filter MERV 13', 'Thermostat Controller',
  'Copper pipe 1/2 inch', 'Brass Connector 15mm', 'Insulation Tape Roll',
  'Water Flow Switch', 'Phase Failure Relay', 'Digital Energy Meter'
]

const STATE_CODES: Record<string, string> = {
  'Tamil Nadu': 'TN', 'Karnataka': 'KA', 'Maharashtra': 'MH', 'Delhi': 'DL',
  'Telangana': 'TS', 'Gujarat': 'GJ', 'West Bengal': 'WB', 'Haryana': 'HR'
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getRandomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateIndianName(): string {
  return `${getRandomElement(INDIAN_FIRST_NAMES)} ${getRandomElement(INDIAN_LAST_NAMES)}`
}

function generateIndianCompany(): { name: string; nickname: string } {
  const pfx = getRandomElement(INDIAN_COMPANY_PREFIXES)
  const sfx = getRandomElement(INDIAN_COMPANY_SUFFIXES)
  const name = `${pfx} ${sfx}`
  const nickname = (pfx.substring(0, 3) + sfx.substring(0, 2)).toUpperCase().replace(/[^A-Z]/g, 'X')
  return { name, nickname }
}

async function main() {
  console.log('🔄 Wiping existing database...')
  
  // Wiping all tables cascading in PostgreSQL to make room for clean bulk seed
  const tablenames = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`)
      } catch (error) {
        console.log(`⚠️ Error truncating table ${tablename}:`, error)
      }
    }
  }
  console.log('✅ Database wiped successfully.')

  console.log('🌱 Seeding reference tables...')
  
  // Departments
  const deptMap: Record<string, string> = {}
  for (const name of DEPARTMENTS) {
    const d = await prisma.department.create({ data: { name } })
    deptMap[name] = d.id
  }

  // Industries
  for (const name of STANDARD_INDUSTRIES) {
    await prisma.industry.create({ data: { name } })
  }

  // ── ERP Phase 1 master data ──
  for (let i = 0; i < REGIONS.length; i++) await prisma.region.create({ data: { name: REGIONS[i], displayOrder: i } })
  for (let i = 0; i < COUNTRIES.length; i++) await prisma.country.create({ data: { name: COUNTRIES[i], displayOrder: i } })
  for (let i = 0; i < COMMERCIAL_MODELS.length; i++) await prisma.commercialModel.create({ data: { name: COMMERCIAL_MODELS[i], displayOrder: i } })
  for (let i = 0; i < LEAD_SOURCES_MASTER.length; i++) await prisma.leadSourceMaster.create({ data: { name: LEAD_SOURCES_MASTER[i], displayOrder: i } })
  for (const rc of REASON_CODES) await prisma.reasonCode.create({ data: rc })
  for (let i = 0; i < CAPACITY_UNITS.length; i++) await prisma.capacityUnit.create({ data: { name: CAPACITY_UNITS[i], displayOrder: i } })
  for (const acc of SOLUTION_ACCESSORIES) await prisma.solutionAccessory.create({ data: { name: acc } })
  let catOrder = 0
  for (const [category, models] of Object.entries(SOLUTION_CATEGORIES)) {
    const cat = await prisma.solutionCategory.create({ data: { name: category, displayOrder: catOrder++ } })
    let modelOrder = 0
    for (const model of models) {
      await prisma.solution.create({ data: { categoryId: cat.id, name: model, displayOrder: modelOrder++ } })
    }
  }

  // Designations
  const designationMap: Record<string, string> = {}
  for (const name of STANDARD_DESIGNATIONS) {
    const d = await prisma.designation.create({ data: { name } })
    designationMap[name] = d.id
  }

  // Role definitions and permissions
  console.log('Seeding RoleDefinitions + Permissions...')
  for (const rd of ROLE_DEFS) {
    const created = await prisma.roleDefinition.create({
      data: { name: rd.name, displayName: rd.displayName, isSystem: rd.isSystem, sortOrder: rd.sortOrder }
    })
    const perms = PERMISSIONS[rd.name] ?? []
    for (const perm of perms) {
      const [resource, action] = perm.split(':')
      await prisma.rolePermission.create({
        data: { roleDefinitionId: created.id, resource, action, allowed: true }
      })
    }
  }

  // Business Rules
  console.log('Seeding BusinessRules...')
  const businessRuleSeeds = [
    {
      key: 'project_budget_tier', name: 'Project Budget Tier', module: 'Project',
      description: 'Fires when a project\'s spend crosses 25/50/75/90/100% of budget.',
      config: { tiers: [25, 50, 75, 90, 100], recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'project_budget_progress_mismatch', name: 'Budget Outpacing Progress', module: 'Project',
      description: 'Fires when % of budget spent exceeds % progress by a configurable gap.',
      config: { gapPercent: 30, recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 48 },
    },
    {
      key: 'project_stale_update', name: 'Project Stale Update', module: 'Project',
      description: 'Fires when a project has had no update for N days.',
      config: { staleDays: 7, recipientRoles: ['ProjectHead'], cooldownHours: 72 },
    },
    {
      key: 'invoice_overdue', name: 'Invoice Overdue', module: 'Finance',
      description: 'Fires when an unpaid invoice crosses 7/15/30 days overdue.',
      config: { dayTiers: [7, 15, 30], recipientRoles: ['BusinessHead', 'SuperAdmin'], cooldownHours: 24 },
    },
    {
      key: 'stock_level', name: 'Stock Level Alert', module: 'Inventory',
      description: 'Fires on low / critical / out-of-stock components.',
      config: { lowThreshold: 10, criticalThreshold: 5, recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'material_request_pending', name: 'Material Request Pending Too Long', module: 'Inventory',
      description: 'Fires when a material request sits pending for too long.',
      config: { pendingHours: 48, recipientRoles: ['BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'po_pending_approval', name: 'Purchase Order Pending Approval', module: 'Procurement',
      description: 'Fires when a PO sits in Draft too long without approval.',
      config: { pendingHours: 24, recipientRoles: ['BusinessHead', 'SuperAdmin'], cooldownHours: 24 },
    },
    {
      key: 'revenue_vs_target', name: 'Revenue vs Monthly Target', module: 'Finance',
      description: 'Fires when monthly paid revenue is below or above target.',
      config: { belowPercent: 80, abovePercent: 120, recipientRoles: ['BusinessHead', 'SuperAdmin'], cooldownHours: 24 },
    },
    {
      key: 'expense_exceeds_budget', name: 'Expense Exceeds Approved Budget', module: 'Finance',
      description: 'Fires when a project\'s spend exceeds its approved budget outright.',
      config: { overagePercent: 0, recipientRoles: ['BusinessHead', 'SuperAdmin'], cooldownHours: 24 },
    },
    {
      key: 'project_profit_margin_low', name: 'Project Profit Margin Below Threshold', module: 'Finance',
      description: 'Fires when a project\'s profit margin falls below a configurable %.',
      config: { minMarginPercent: 15, recipientRoles: ['BusinessHead'], cooldownHours: 72 },
    },
    {
      key: 'customer_payment_overdue', name: 'Customer Payment Overdue', module: 'Finance',
      description: 'Customer-facing view of overdue invoice payments (7/15/30 day tiers).',
      config: { dayTiers: [7, 15, 30], recipientRoles: ['BusinessHead', 'SalesHead'], cooldownHours: 24 },
    },
    {
      key: 'vendor_payment_overdue', name: 'Vendor Payment Overdue', module: 'Finance',
      description: 'Fires when a delivered PO remains unpaid past a grace period.',
      config: { graceDays: 30, recipientRoles: ['BusinessHead', 'Accountant'], cooldownHours: 48 },
    },
    {
      key: 'cash_flow_low', name: 'Cash Flow Below Threshold', module: 'Finance',
      description: 'Fires when trailing net cash flow (paid revenue minus expenses) drops below a floor.',
      config: { windowDays: 30, floorAmount: 0, recipientRoles: ['BusinessHead', 'SuperAdmin'], cooldownHours: 24 },
    },
    {
      key: 'large_invoice_generated', name: 'Large Invoice Generated', module: 'Finance',
      description: 'Fires when a newly created invoice exceeds a configurable amount.',
      config: { amountThreshold: 500000, lookbackHours: 24, recipientRoles: ['BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'high_value_payment_received', name: 'High-Value Payment Received', module: 'Finance',
      description: 'Fires when an invoice is marked Paid above a configurable amount.',
      config: { amountThreshold: 500000, lookbackHours: 24, recipientRoles: ['BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'unapproved_expenses_stale', name: 'Unapproved Expenses Pending Review', module: 'Finance',
      description: 'Fires when unattributed expenses have sat unreviewed for too long.',
      config: { staleDays: 14, recipientRoles: ['Accountant', 'BusinessHead'], cooldownHours: 48 },
    },
    {
      key: 'project_due_low_completion', name: 'Project Due Soon, Low Completion', module: 'Project',
      description: 'Fires when a project is due within X days but below Y% complete.',
      config: { dueDays: 14, minCompletion: 80, recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 48 },
    },
    {
      key: 'project_idle_approvals', name: 'Project Idle on Approvals', module: 'Project',
      description: 'Fires when a project\'s material requests are stuck pending approval.',
      config: { pendingHours: 72, recipientRoles: ['ProjectHead'], cooldownHours: 48 },
    },
    {
      key: 'project_blocked_procurement', name: 'Project Blocked by Procurement', module: 'Project',
      description: 'Fires when a project\'s purchase orders are overdue for delivery.',
      config: { overdueHours: 48, recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 48 },
    },
    {
      key: 'goods_receipt_delayed', name: 'Goods Receipt Delayed', module: 'Procurement',
      description: 'Fires when a delivered PO has no goods receipt logged.',
      config: { graceHours: 48, recipientRoles: ['BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'vendor_delivery_overdue', name: 'Vendor Delivery Overdue', module: 'Procurement',
      description: 'Fires when a PO is past its expected delivery date and not yet delivered.',
      config: { graceHours: 24, recipientRoles: ['BusinessHead'], cooldownHours: 24 },
    },
    {
      key: 'vendor_performance_low', name: 'Vendor Performance Below Threshold', module: 'Procurement',
      description: 'Fires when a supplier\'s on-time delivery rate drops below a configurable %.',
      config: { minOnTimePercent: 70, windowDays: 90, minSampleSize: 3, recipientRoles: ['BusinessHead'], cooldownHours: 168 },
    },
    {
      key: 'dead_stock', name: 'Dead Stock', module: 'Inventory',
      description: 'Fires when a component has sat unused since receipt for a configurable window.',
      config: { deadDays: 180, recipientRoles: ['BusinessHead'], cooldownHours: 168 },
    },
    {
      key: 'overstock', name: 'Overstock', module: 'Inventory',
      description: 'Fires when a component\'s quantity is far above a ceiling with negligible recent consumption.',
      config: { quantityCeiling: 200, recentDays: 60, recipientRoles: ['BusinessHead'], cooldownHours: 168 },
    },
    {
      key: 'material_reserved_exceeds_available', name: 'Material Reserved Exceeds Available', module: 'Inventory',
      description: 'Fires when total allocations for a component exceed its available quantity.',
      config: { recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 12 },
    },
    {
      key: 'sla_breach', name: 'SLA Breach / About to Breach', module: 'Service',
      description: 'Fires when a service request is nearing or has passed its SLA deadline.',
      config: { warnHours: 4, recipientRoles: ['ProjectHead', 'BusinessHead'], cooldownHours: 4 },
    },
    {
      key: 'warranty_amc_expiring', name: 'Warranty / AMC Expiring', module: 'Service',
      description: 'Fires when a service record\'s warranty or AMC end date is within a configurable window.',
      config: { warnDays: 30, recipientRoles: ['BusinessHead'], cooldownHours: 168 },
    },
    {
      key: 'repeat_complaints', name: 'Repeat Complaints', module: 'Service',
      description: 'Fires when a service record accumulates repeated complaints within a window.',
      config: { windowDays: 90, minCount: 3, recipientRoles: ['BusinessHead', 'ProjectHead'], cooldownHours: 72 },
    },
    {
      key: 'high_priority_ticket_idle', name: 'High-Priority Ticket Idle', module: 'Service',
      description: 'Fires when a high-priority service request has no engineer acceptance for too long.',
      config: { idleHours: 4, recipientRoles: ['ProjectHead'], cooldownHours: 4 },
    },
  ]
  for (const br of businessRuleSeeds) {
    await prisma.businessRule.create({ data: br })
  }

  // Leave Types — per Professional_Leave_Policy.docx (confirmed over the live
  // 2026-27 tracker's older 7/15/7 figures, which predate the written policy).
  console.log('Seeding LeaveTypes...')
  const leaveTypeSeeds = [
    { code: 'EL', name: 'Annual / Earned Leave', annualQuota: 18, monthlyAccrual: 1.5, maxCarryForward: 30, carryForwardExpiry: 12, isEncashable: true, maxEncashment: 30, isPaidLeave: true, requiresDocument: false, sandwichApplicable: true, halfDayAllowed: true, minDaysNotice: 3, maxConsecutiveDays: 0, probationAllowed: false, sortOrder: 1 },
    { code: 'CL', name: 'Casual Leave', annualQuota: 12, monthlyAccrual: 1, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: false, sandwichApplicable: false, halfDayAllowed: true, minDaysNotice: 0, maxConsecutiveDays: 2, probationAllowed: true, sortOrder: 2 },
    { code: 'SL', name: 'Sick Leave', annualQuota: 12, monthlyAccrual: 1, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: true, sandwichApplicable: false, halfDayAllowed: true, minDaysNotice: 0, maxConsecutiveDays: 0, probationAllowed: true, sortOrder: 3 },
    { code: 'RH', name: 'Restricted / Optional Holiday', annualQuota: 2, monthlyAccrual: 0, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: false, sandwichApplicable: false, halfDayAllowed: false, minDaysNotice: 1, maxConsecutiveDays: 0, probationAllowed: false, sortOrder: 4 },
    { code: 'PAT', name: 'Paternity Leave', annualQuota: 5, monthlyAccrual: 0, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: true, sandwichApplicable: false, halfDayAllowed: false, minDaysNotice: 0, maxConsecutiveDays: 0, gender: 'male', probationAllowed: false, sortOrder: 5 },
    { code: 'MAT', name: 'Maternity Leave', annualQuota: 182, monthlyAccrual: 0, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: true, sandwichApplicable: false, halfDayAllowed: false, minDaysNotice: 0, maxConsecutiveDays: 0, gender: 'female', probationAllowed: false, sortOrder: 6 },
    { code: 'CO', name: 'Compensatory Off', annualQuota: 0, monthlyAccrual: 0, maxCarryForward: 0, carryForwardExpiry: 0, isEncashable: false, maxEncashment: 0, isPaidLeave: true, requiresDocument: false, sandwichApplicable: false, halfDayAllowed: true, minDaysNotice: 0, maxConsecutiveDays: 0, probationAllowed: true, sortOrder: 7 },
  ]
  for (const lt of leaveTypeSeeds) {
    await prisma.leaveType.create({ data: lt })
  }

  // Pre-hash password once to optimize user generation.
  // aspcv@2026 is the shared default per business rule — every non-admin
  // account starts with mustChangePassword: true so /auth/verify-otp-change-password
  // forces a real password on first login.
  const hash = await bcrypt.hash('aspcv@2026', 10)
  const adminHash = await bcrypt.hash('admin123', 10)

  // 1. Employees / Users — real ASPCV staff roster (test/placeholder employees removed)
  console.log('👤 Seeding real ASPCV staff roster...')
  const users: any[] = []

  // Default Admin (system account, not a real staff member)
  const adminUser = await prisma.user.create({
    data: { name: 'Admin', email: 'admin@aspcv.com', passwordHash: adminHash, role: Role.SuperAdmin, roleName: 'SuperAdmin' }
  })
  users.push(adminUser)

  const jeyadevUser = await prisma.user.create({
    data: { name: 'Jeyadev', email: 'jeyadev2006@gmail.com', passwordHash: adminHash, role: Role.SuperAdmin, roleName: 'SuperAdmin' }
  })
  users.push(jeyadevUser)

  function parseDDMMMYY(s: string): Date {
    const [d, mon, y] = s.split('-')
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    const year = 2000 + parseInt(y, 10)
    return new Date(year, months[mon], parseInt(d, 10))
  }

  const STAFF_ROSTER: Array<{
    employeeCode?: string; name: string; email: string; role: Role; roleName: string
    dept: string; designation: string; qualification?: string; specialisation?: string
    dob?: string; doj?: string
  }> = [
    { employeeCode: 'ASPCV006', name: 'Logesh N',          email: 'logesh@aspcv.com',                       role: Role.SuperAdmin,   roleName: 'SuperAdmin',          dept: 'Management', designation: 'Director',                    qualification: 'MBA, B.Tech EEE', specialisation: 'Marketing',    dob: '06-Feb-87', doj: '01-Apr-22' },
    { employeeCode: undefined, name: 'Subashree',          email: 'subashree@aspcv.com',                     role: Role.BusinessHead, roleName: 'BusinessHead',        dept: 'Management', designation: 'Business Head' },
    { employeeCode: undefined, name: 'Priya',              email: 'priya@aspcv.com',                         role: Role.HR,           roleName: 'HR',                  dept: 'HR',         designation: 'HR Officer' },
    { employeeCode: 'ASPCV027', name: 'Manikandan E',      email: 'manikandan@aspcv.com',                    role: Role.Manager,      roleName: 'Manager',             dept: 'Sales',      designation: 'Mechanical Engineer',         qualification: 'MSC',             specialisation: 'Physics',      dob: '17-Mar-00', doj: '04-Feb-25' },
    { employeeCode: 'ASPCV018', name: 'Dillipkumar S',     email: 'dilipkumar.s@aspcv.com',                  role: Role.Viewer,       roleName: 'SalesRepresentative', dept: 'Sales',      designation: 'Channel Sales',                qualification: 'ITI',             specialisation: 'ITI (MMV)',    dob: '28-Aug-85', doj: '01-Mar-23' },
    { employeeCode: 'ASPCV007', name: 'Roop Ganesh M',     email: 'roopganesh@aspcv.com',                    role: Role.Viewer,       roleName: 'SalesRepresentative', dept: 'Sales',      designation: 'Manager - Service',            qualification: 'BCA',             specialisation: 'Computer App', dob: '30-Aug-87', doj: '01-Apr-22' },
    { employeeCode: 'ASPCV036', name: 'Ganesh Pandian',    email: 'ganesh@aspcv.com',                        role: Role.Viewer,       roleName: 'Marketing',           dept: 'Marketing',  designation: 'Digital Marketing Executive', qualification: 'B.E & M.E',       specialisation: 'Marketing',    dob: '23-Feb-97', doj: '08-Sep-25' },
    { employeeCode: undefined, name: 'Shalini GB',         email: 'accounts@aspcv.com',                      role: Role.Accountant,   roleName: 'Accountant',          dept: 'Accounts',   designation: 'Accounts Executive',           qualification: 'BBA',             specialisation: 'Accounts' },
    { employeeCode: 'ASPCV029', name: 'Nantha Kumar O',    email: 'nanthakumar@aspirationenergy.com',        role: Role.ProjectHead,  roleName: 'ProjectHead',         dept: 'Project',    designation: 'Project Manager',             qualification: 'BE',              specialisation: 'EEE',          dob: '10-Nov-95', doj: '01-Nov-24' },
    { employeeCode: 'ASPCV030', name: 'M Raj Kumar',       email: 'rajkumar.m@aspirationenergy.com',         role: Role.SeniorEngineer, roleName: 'SeniorEngineer',    dept: 'Project',    designation: 'Senior Engineer',              qualification: 'BE',              specialisation: 'EEE',          dob: '27-Dec-94', doj: '01-Nov-24' },
    { employeeCode: 'ASPCV038', name: 'Raja Rajan K',      email: 'rajarajanaspcv@gmail.com',                role: Role.Engineer,     roleName: 'Engineer',            dept: 'Project',    designation: 'Project Engineer',             qualification: 'BE',              specialisation: 'EEE',          doj: '26-Dec-25' },
    { employeeCode: 'ASPCV031', name: 'Krishna Moorthy G', email: 'krishnaaspcv@gmail.com',                  role: Role.Technician,   roleName: 'Technician',          dept: 'Service',    designation: 'Technician',                   qualification: 'Dip, B.Tech',     specialisation: 'ITI',          dob: '08-Jul-96', doj: '01-Nov-24' },
    { employeeCode: undefined, name: 'Shakthi',            email: 'shakthi@aspcv.com',                       role: Role.Engineer,     roleName: 'Engineer',            dept: 'Project',    designation: 'Site Engineer' },
    { employeeCode: undefined, name: 'Tamil',              email: 'tamil@aspcv.com',                         role: Role.Engineer,     roleName: 'Engineer',            dept: 'Project',    designation: 'Site Engineer' },
    { employeeCode: 'ASPCV037', name: 'Priya Varshini',    email: 'priyavarshini@aspcv.com',                 role: Role.HR,           roleName: 'HR',                  dept: 'Accounts',   designation: 'Business Development',        qualification: 'MBA',             specialisation: 'Commerce',     dob: '16-Apr-00', doj: '28-Oct-25' },
    { employeeCode: undefined, name: 'Gireeshwaran R',     email: 'gireeshwaran@termagen2x.in',              role: Role.Engineer,     roleName: 'Engineer',            dept: 'Project',    designation: 'Project Engineer',             qualification: 'BE',              specialisation: 'Mechanical' },
  ]

  for (const staff of STAFF_ROSTER) {
    const deptId = deptMap[staff.dept]
    const designationId = designationMap[staff.designation]
    const user = await prisma.user.create({
      data: {
        name: staff.name,
        email: staff.email,
        employeeCode: staff.employeeCode,
        passwordHash: hash,
        mustChangePassword: true,
        role: staff.role,
        roleName: staff.roleName,
        departmentId: deptId,
        designationId,
        isActive: true,
        dateOfBirth: staff.dob ? parseDDMMMYY(staff.dob) : undefined,
        joiningDate: staff.doj ? parseDDMMMYY(staff.doj) : undefined,
        baseSalary: getRandomRange(25000, 180000),
        hra: getRandomRange(10000, 40000),
        allowances: getRandomRange(5000, 20000),
        pan: `ABCDE${getRandomRange(1000, 9999)}F`,
        bankAccount: `91${getRandomRange(100000000, 999999999)}`,
        ifsc: 'HDFC0000240',
        bankName: 'HDFC Bank',
        emergencyContact: `+91 ${getRandomRange(90000, 99999)} ${getRandomRange(10000, 99999)}`,
      }
    })
    users.push(user)
  }

  // Filter specific roles for assignments using roleName
  const pmUsers = users.filter(u => ['ProjectHead', 'Manager', 'SuperAdmin'].includes(u.roleName))
  const seUsers = users.filter(u => ['SeniorEngineer', 'Engineer'].includes(u.roleName))
  const salesUsers = users.filter(u => ['SalesRepresentative', 'SalesHead', 'Manager'].includes(u.roleName))
  const techUsers = users.filter(u => ['Technician', 'Engineer'].includes(u.roleName))

  // 2. Dealers (24 total)
  console.log('🏢 Seeding 24 Dealers/Suppliers...')
  const dealers: any[] = []
  const dealerCategories = ['Electrical Panels & Controls', 'Refrigerants & Compressors', 'Heat Exchangers', 'Ducting & Sheet Metal', 'Pipes & Fittings', 'Instrumentation & Sensors']
  const cities = ['Chennai', 'Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Ahmedabad', 'New Delhi']
  const states = ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Maharashtra', 'Telangana', 'Gujarat', 'Delhi']
  
  for (let i = 1; i <= 24; i++) {
    const dealerName = `${getRandomElement(INDIAN_COMPANY_PREFIXES)} Supplier ${i} Ltd.`
    const dIdx = getRandomRange(0, cities.length - 1)
    const dealer = await prisma.dealer.create({
      data: {
        id: `dealer-${i}`,
        name: dealerName,
        company: `${dealerName} Pvt. Ltd.`,
        gstNumber: `${getRandomRange(10, 36)}AAAAA${getRandomRange(1000, 9999)}A${getRandomRange(1, 9)}Z${getRandomRange(1, 9)}`,
        phone: `+91 ${getRandomRange(90000, 99999)} ${getRandomRange(10000, 99999)}`,
        email: `sales@supplier${i}.in`,
        address: `${getRandomRange(10, 200)} Industrial Estate Rd`,
        city: cities[dIdx],
        state: states[dIdx],
        category: getRandomElement(dealerCategories),
        notes: 'Preferred OEM vendor.',
      }
    })
    dealers.push(dealer)
  }

  // 3. Raw Components (300 total)
  console.log('⚙️ Seeding 300 Raw Components...')
  const rawComponents: any[] = []
  for (let i = 1; i <= 300; i++) {
    const compName = getRandomElement(COMPONENT_NAMES) + ` v${i}`
    const dealer = getRandomElement(dealers)
    const price = getRandomRange(200, 85000)
    const component = await prisma.rawComponent.create({
      data: {
        id: `component-${i}`,
        refNumber: `COMP-${String(i).padStart(4, '0')}`,
        name: compName,
        category: dealer.category.split(' & ')[0],
        price,
        gstPercent: 18,
        hsnCode: `8415${getRandomRange(1000, 9999)}`,
        unit: getRandomElement(['pcs', 'meter', 'sheet', 'cylinder', 'kg']),
        quantity: getRandomRange(10, 150),
        dealerId: dealer.id,
        dealerName: dealer.name,
        notes: 'Standard storage in Warehouse A.',
        status: 'in_stock'
      }
    })
    rawComponents.push(component)
  }

  // 4. Companies (150 total)
  console.log('🏢 Seeding 150 Companies...')
  const companies: any[] = []
  const indianStates = ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Telangana', 'Gujarat', 'West Bengal', 'Delhi', 'Haryana']
  const indianCities = ['Chennai', 'Bengaluru', 'Mumbai', 'Hyderabad', 'Ahmedabad', 'Kolkata', 'New Delhi', 'Gurugram']
  
  for (let i = 1; i <= 150; i++) {
    const { name, nickname } = generateIndianCompany()
    const stateIdx = getRandomRange(0, indianStates.length - 1)
    const state = indianStates[stateIdx]
    const city = indianCities[stateIdx]
    const stateCode = STATE_CODES[state] ?? 'IN'
    
    const company = await prisma.company.create({
      data: {
        id: `company-${i}`,
        name: `${name} (${i})`,
        nickname: `${nickname}${i}`,
        industry: getRandomElement(STANDARD_INDUSTRIES),
        customerType: CustomerType.Indian,
        region: getRandomElement(REGIONS),
        state,
        city,
        area: 'Industrial Zone',
        stateCode,
        areaCode: 'IZ',
        cityCode: city.substring(0, 2).toUpperCase(),
        email: `contact@company${i}.co.in`,
        phone: `+91 ${getRandomRange(90000, 99999)} ${getRandomRange(10000, 99999)}`,
        gstNumber: `33${nickname}${getRandomRange(1000, 9999)}A1Z0`,
        website: `www.company${i}.co.in`
      }
    })
    companies.push(company)
  }

  // 5. Contacts (250 total)
  console.log('👥 Seeding 250 Contacts...')
  const contacts: any[] = []
  for (let i = 1; i <= 250; i++) {
    const company = getRandomElement(companies)
    const name = generateIndianName()
    const contact = await prisma.contact.create({
      data: {
        id: `contact-${i}`,
        companyId: company.id,
        name: `${name} (${i})`,
        designation: getRandomElement(STANDARD_DESIGNATIONS),
        email: `${name.toLowerCase().replace(/ /g, '.')}.${i}@company${getRandomRange(1, 150)}.co.in`,
        phone: `+91 ${getRandomRange(90000, 99999)} ${getRandomRange(10000, 99999)}`,
        whatsapp: `+91 ${getRandomRange(90000, 99999)} ${getRandomRange(10000, 99999)}`,
        notes: 'Spoke regarding solar requirement.'
      }
    })
    contacts.push(contact)
  }

  // 6. Leads (200 total)
  console.log('🎯 Seeding 200 Leads...')
  const leads: any[] = []
  const leadStatuses = [LeadStatus.Enquiry, LeadStatus.ProspectiveLead, LeadStatus.ProjectHold, LeadStatus.Hibernated, LeadStatus.OrderWon, LeadStatus.OrderLost]

  // Master rows are created above without their ids being kept — reload them so
  // each lead can be linked to a real region / source / commercial model.
  const regionRows = await prisma.region.findMany()
  const sourceRows = await prisma.leadSourceMaster.findMany()
  const commercialModelRows = await prisma.commercialModel.findMany()

  for (let i = 1; i <= 200; i++) {
    const company = getRandomElement(companies)
    const leadDate = new Date(Date.now() - getRandomRange(0, 365) * 24 * 3600 * 1000)
    const nick = (company.nickname || company.name?.slice(0, 4) || 'XX').toUpperCase().replace(/\s+/g, '')
    const sc = (company.stateCode || 'XX').toUpperCase()
    const ac = (company.areaCode || 'XX').toUpperCase()
    const cc = (company.cityCode || 'XX').toUpperCase()
    const lead = await prisma.lead.create({
      data: {
        id: `lead-${i}`,
        companyId: company.id,
        title: `${getRandomElement(PROJECT_TITLES)} – ${company.name}`,
        estimatedValue: getRandomRange(100000, 5000000),
        closeDate: new Date(leadDate.getTime() + getRandomRange(15, 90) * 24 * 3600 * 1000),
        status: getRandomElement(leadStatuses),
        refNumber: `LD-2026-${String(i).padStart(4, '0')}`,
        leadNumber: `ASPCV ${nick}-${sc}-${ac} ${cc}-${i}`,
        notes: 'Initial discussion completed.',
        regionId: getRandomElement(regionRows).id,
        leadSourceId: getRandomElement(sourceRows).id,
        commercialModelId: getRandomElement(commercialModelRows).id,
        leadDate,
        createdAt: leadDate
      }
    })
    
    // Assign owner
    const salesRep = getRandomElement(salesUsers)
    await prisma.leadOwner.create({
      data: { leadId: lead.id, userId: salesRep.id, role: 'primary' }
    })
    
    // Link contact
    const compContacts = contacts.filter(c => c.companyId === company.id)
    const selectedContact = compContacts.length > 0 ? getRandomElement(compContacts) : getRandomElement(contacts)
    await prisma.leadContact.create({
      data: { leadId: lead.id, name: selectedContact.name, designation: selectedContact.designation, email: selectedContact.email, phone: selectedContact.phone, isPrimary: true }
    })
    
    leads.push(lead)
  }

  // 7. Deals (120 total)
  console.log('🤝 Seeding 120 Deals...')
  const deals: any[] = []
  const dealStages = [DealStage.LeadIn, DealStage.Proposal, DealStage.Negotiation, DealStage.OrderWon, DealStage.OrderLost]
  
  for (let i = 1; i <= 120; i++) {
    const lead = leads[i - 1] // link to first 120 leads
    const dealCloseDate = new Date(lead.createdAt.getTime() + getRandomRange(10, 60) * 24 * 3600 * 1000)
    const deal = await prisma.deal.create({
      data: {
        id: `deal-${i}`,
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        companyId: lead.companyId,
        title: `Deal – ${lead.title}`,
        stage: i <= 80 ? DealStage.OrderWon : getRandomElement(dealStages),
        value: lead.estimatedValue,
        probability: i <= 80 ? 100 : getRandomRange(20, 90),
        closeDate: dealCloseDate,
        handoverNotes: i <= 80 ? 'Closed won and ready for project deployment.' : null,
        handoverSubmittedAt: i <= 80 ? new Date(dealCloseDate.getTime() + getRandomRange(1, 5) * 24 * 3600 * 1000) : null,
        assignedPMId: getRandomElement(pmUsers).id,
        assignedSEId: getRandomElement(seUsers).id,
        createdAt: lead.createdAt
      }
    })
    
    // Deal Owner
    await prisma.dealOwner.create({
      data: { dealId: deal.id, userId: getRandomElement(salesUsers).id, role: 'primary' }
    })
    
    deals.push(deal)
  }

  // 8. Quotations (150 total)
  console.log('📄 Seeding 150 Quotations...')
  const quotations: any[] = []
  const quotationStatuses = [QuotationStatus.Draft, QuotationStatus.Sent, QuotationStatus.Accepted, QuotationStatus.Rejected, QuotationStatus.Expired]
  
  for (let i = 1; i <= 150; i++) {
    const linkedDeal = i <= 120 ? deals[i - 1] : null // first 120 quotes tie to the seeded deals
    const company = linkedDeal ? { id: linkedDeal.companyId } : getRandomElement(companies)
    let totalAmt = 0
    const quoteCreatedAt = new Date(Date.now() - getRandomRange(10, 365) * 24 * 3600 * 1000)

    const quote = await prisma.quotation.create({
      data: {
        id: `quotation-${i}`,
        refNumber: `QTN-2026-${String(i).padStart(4, '0')}`,
        companyId: company.id,
        dealId: linkedDeal?.id,
        title: `Quotation for ${getRandomElement(PROJECT_TITLES)}`,
        status: i <= 100 ? QuotationStatus.Accepted : getRandomElement(quotationStatuses),
        validUntil: new Date(quoteCreatedAt.getTime() + 30 * 24 * 3600 * 1000),
        warrantyPeriod: getRandomElement([12, 24, 36]),
        deliveryDate: new Date(quoteCreatedAt.getTime() + 45 * 24 * 3600 * 1000),
        scope: 'Supply, installation, testing and commissioning of custom solar/thermal systems.',
        notes: 'Pricing is valid for 30 days.',
        createdAt: quoteCreatedAt
      }
    })
    
    // Create items
    const itemCount = getRandomRange(2, 4)
    for (let j = 1; j <= itemCount; j++) {
      const component = getRandomElement(rawComponents)
      const qty = getRandomRange(1, 10)
      const unitPrice = component.price * 1.2
      const amount = qty * unitPrice
      totalAmt += amount
      
      await prisma.quotationItem.create({
        data: {
          quotationId: quote.id,
          description: component.name,
          quantity: qty,
          unit: component.unit,
          unitPrice,
          amount
        }
      })
    }
    
    // Update subtotal and total
    await prisma.quotation.update({
      where: { id: quote.id },
      data: {
        subtotal: totalAmt,
        totalAmount: totalAmt * 1.18
      }
    })
    
    quotations.push({ ...quote, leadNumber: linkedDeal?.leadNumber ?? null })
  }

  // 9. Accept 85 quotations directly (Deal + Quotation -> Project, no Sales Order middleman)
  console.log('📋 Accepting 85 Quotations (direct handover to Project)...')
  const acceptedQuotes: any[] = []

  for (let i = 1; i <= 85; i++) {
    const quote = quotations[i - 1]
    const acceptedAt = new Date(quote.createdAt.getTime() + getRandomRange(2, 10) * 24 * 3600 * 1000)
    await prisma.quotation.update({ where: { id: quote.id }, data: { status: QuotationStatus.Accepted } })
    acceptedQuotes.push({ ...quote, acceptedAt })
  }

  // 10. Projects (120 total)
  console.log('🏗️ Seeding 120 Projects (80 Completed, 40 Active/Planning)...')
  const projects: any[] = []

  // We need 120 Projects. We link 80 of them to our Accepted Quotations (direct handover).
  // 80 should be Completed status, others distributed.
  for (let i = 1; i <= 120; i++) {
    const isCompleted = i <= 80
    const quote = i <= 85 ? acceptedQuotes[i - 1] : null
    const company = quote ? null : getRandomElement(companies)
    const companyId = quote ? quote.companyId : company!.id

    const status = isCompleted
      ? ProjectStatus.Completed
      : getRandomElement([ProjectStatus.Planning, ProjectStatus.Engineering, ProjectStatus.Procurement, ProjectStatus.Manufacturing, ProjectStatus.Installation, ProjectStatus.Testing, ProjectStatus.Active, ProjectStatus.OnHold])

    const budget = quote ? quote.totalAmount! : getRandomRange(200000, 1500000)
    const actualSpend = isCompleted ? budget * getRandomRange(0.85, 0.98) : budget * getRandomRange(0.1, 0.7)

    const pStartDate = quote
      ? new Date(quote.acceptedAt.getTime() + getRandomRange(2, 10) * 24 * 3600 * 1000)
      : new Date(Date.now() - getRandomRange(30, 365) * 24 * 3600 * 1000)
    const durationDays = getRandomRange(30, 120)
    const pEndDate = isCompleted
      ? new Date(pStartDate.getTime() + durationDays * 24 * 3600 * 1000)
      : new Date(Date.now() + getRandomRange(20, 120) * 24 * 3600 * 1000)
    const pCompletedAt = isCompleted ? pEndDate : null

    const p = await prisma.project.create({
      data: {
        id: `project-${i}`,
        title: quote ? `Project – ${quote.title}` : `${getRandomElement(PROJECT_TITLES)} – Company ${i}`,
        companyId,
        dealId: quote?.dealId ?? null,
        leadNumber: quote?.leadNumber ?? null,
        quotationId: quote ? quote.id : null,
        handoverNotes: quote ? 'Scope, pricing and delivery terms confirmed with client. Handed over to project management for execution.' : null,
        handoverOneDriveUrl: quote ? `https://aspcv-my.sharepoint.com/:b:/g/personal/sales_aspcv_com/handover-${i}` : null,
        status,
        budget,
        actualBudget: actualSpend,
        remainingBudget: budget - actualSpend,
        warrantyPeriod: quote ? quote.warrantyPeriod : 24,
        warrantyStart: isCompleted ? pCompletedAt : null,
        warrantyEnd: isCompleted ? new Date(pCompletedAt!.getTime() + 24 * 30 * 24 * 3600 * 1000) : null,
        progress: isCompleted ? 100 : getRandomRange(5, 80),
        assignedPMId: getRandomElement(pmUsers).id,
        assignedSEId: getRandomElement(seUsers).id,
        startDate: pStartDate,
        endDate: pEndDate,
        completedAt: pCompletedAt,
        notes: 'Project executed under clean energy compliance guidelines.',
        isActive: true,
        createdAt: pStartDate
      }
    })
    projects.push(p)
  }

  // 11. Tasks (250 total)
  console.log('📋 Seeding 250 Tasks...')
  const taskStatuses = [TaskStatus.Done, TaskStatus.InProgress, TaskStatus.Pending, TaskStatus.OnHold, TaskStatus.Submitted]
  for (let i = 1; i <= 250; i++) {
    const project = getRandomElement(projects)
    const assignee = getRandomElement(users)
    const isCompleted = i <= 150
    
    await prisma.task.create({
      data: {
        id: `task-${i}`,
        title: `Task #${i} – Technical installation checklist`,
        description: 'Verify all physical components, wiring layout, and functional diagnostics.',
        status: isCompleted ? TaskStatus.Done : getRandomElement(taskStatuses),
        assigneeId: assignee.id,
        departmentId: assignee.departmentId,
        entityType: 'Project',
        entityId: project.id,
        checked: isCompleted,
        subtasks: getRandomRange(1, 5),
        completed: isCompleted ? 5 : getRandomRange(0, 3),
        comments: getRandomRange(0, 3),
        attachments: getRandomRange(0, 2),
        startDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        dueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
        completedAt: isCompleted ? new Date() : null
      }
    })
  }

  // 12. Material Requests (180 total)
  console.log('📝 Seeding 180 Material Requests...')
  const mrStatuses = ['pending', 'approved', 'rejected', 'paid']
  for (let i = 1; i <= 180; i++) {
    const project = getRandomElement(projects)
    const requester = getRandomElement(users)
    const status = getRandomElement(mrStatuses)
    let totalAmt = 0

    const mr = await prisma.materialRequest.create({
      data: {
        id: `mr-${i}`,
        refNumber: `MR-2026-${String(i).padStart(4, '0')}`,
        requestedById: requester.id,
        projectId: project.id,
        status,
        managerApprovedById: status !== 'pending' ? getRandomElement(pmUsers).id : null,
        managerApprovedAt: status !== 'pending' ? new Date() : null,
        notes: 'Required for site installation work.',
      }
    })

    const itemCount = getRandomRange(1, 3)
    for (let j = 1; j <= itemCount; j++) {
      const comp = getRandomElement(rawComponents)
      const qty = getRandomRange(1, 5)
      totalAmt += qty * (comp.price ?? 500)
      
      await prisma.materialRequestItem.create({
        data: {
          requestId: mr.id,
          componentRefNo: comp.refNumber,
          name: comp.name,
          quantity: qty,
          unit: comp.unit,
          estimatedPrice: comp.price
        }
      })
    }

    await prisma.materialRequest.update({
      where: { id: mr.id },
      data: { totalEstimated: totalAmt }
    })
  }

  // 13. Purchase Orders (200 total)
  console.log('🛒 Seeding 200 Purchase Orders...')
  const poStatuses = [POStatus.Draft, POStatus.Sent, POStatus.Approved, POStatus.Delivered, POStatus.Closed]
  const purchaseOrders: any[] = []
  
  for (let i = 1; i <= 200; i++) {
    const dealer = getRandomElement(dealers)
    const status = getRandomElement(poStatuses)
    let totalAmt = 0
    const poCreatedAt = new Date(Date.now() - getRandomRange(10, 365) * 24 * 3600 * 1000)
    
    const po = await prisma.purchaseOrder.create({
      data: {
        id: `po-${i}`,
        refNumber: `PO-2026-${String(i).padStart(4, '0')}`,
        supplierId: dealer.id,
        supplierName: dealer.name,
        supplierEmail: dealer.email,
        supplierPhone: dealer.phone,
        supplierAddress: dealer.address,
        status,
        expectedDelivery: new Date(poCreatedAt.getTime() + getRandomRange(7, 15) * 24 * 3600 * 1000),
        deliveredAt: status === POStatus.Delivered || status === POStatus.Closed ? new Date(poCreatedAt.getTime() + getRandomRange(5, 12) * 24 * 3600 * 1000) : null,
        createdById: getRandomElement(pmUsers).id,
        approvedById: status !== POStatus.Draft ? getRandomElement(pmUsers).id : null,
        approvedAt: status !== POStatus.Draft ? new Date(poCreatedAt.getTime() + getRandomRange(1, 3) * 24 * 3600 * 1000) : null,
        vendorPaidAt: status === POStatus.Closed ? new Date(poCreatedAt.getTime() + getRandomRange(10, 20) * 24 * 3600 * 1000) : null,
        createdAt: poCreatedAt
      }
    })
    
    const itemCount = getRandomRange(1, 3)
    for (let j = 1; j <= itemCount; j++) {
      const comp = getRandomElement(rawComponents)
      const qty = getRandomRange(1, 10)
      const price = comp.price ?? 500
      totalAmt += qty * price
      
      await prisma.pOItem.create({
        data: {
          purchaseOrderId: po.id,
          itemName: comp.name,
          quantity: qty,
          unit: comp.unit,
          unitPrice: price,
          amount: qty * price,
          receivedQty: status === POStatus.Delivered || status === POStatus.Closed ? qty : 0
        }
      })
    }
    
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        subtotal: totalAmt,
        totalAmount: totalAmt * 1.18
      }
    })
    
    purchaseOrders.push(po)
  }

  // 14. Goods Receipts (170 total)
  console.log('📦 Seeding 170 Goods Receipts...')
  const deliveredPOs = purchaseOrders.filter(p => [POStatus.Delivered, POStatus.Closed].includes(p.status))
  
  for (let i = 1; i <= 170; i++) {
    const po = deliveredPOs[i % deliveredPOs.length]
    const receivedDate = new Date(po.createdAt.getTime() + getRandomRange(5, 12) * 24 * 3600 * 1000)
    const gr = await prisma.goodsReceipt.create({
      data: {
        id: `gr-${i}`,
        refNumber: `GR-2026-${String(i).padStart(4, '0')}`,
        purchaseOrderId: po.id,
        receivedById: getRandomElement(users).id,
        receivedAt: receivedDate,
        notes: 'Inspected and loaded into primary store.',
        createdAt: receivedDate
      }
    })
    
    // We create line items for this GR matching the PO Items
    const poItems = await prisma.pOItem.findMany({ where: { purchaseOrderId: po.id } })
    for (const item of poItems) {
      await prisma.goodsReceiptItem.create({
        data: {
          goodsReceiptId: gr.id,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          rawComponentId: getRandomElement(rawComponents).id
        }
      })
    }
  }

  // 15. Work Orders / Manufacturing (120 total)
  console.log('🏭 Seeding 120 Work Orders...')
  const woStatuses = [WorkOrderStatus.Waiting, WorkOrderStatus.InProduction, WorkOrderStatus.Assembly, WorkOrderStatus.Testing, WorkOrderStatus.Finished, WorkOrderStatus.Cancelled]
  
  for (let i = 1; i <= 120; i++) {
    const project = getRandomElement(projects)
    const status = getRandomElement(woStatuses)
    const isFinished = status === WorkOrderStatus.Finished
    const woCreatedAt = new Date(project.startDate.getTime() + getRandomRange(5, 20) * 24 * 3600 * 1000)
    
    const wo = await prisma.workOrder.create({
      data: {
        id: `wo-${i}`,
        refNumber: `WO-2026-${String(i).padStart(4, '0')}`,
        projectId: project.id,
        title: `WO #${i} – Assembly of cleantech sub-units`,
        status,
        labourCost: getRandomRange(5000, 25000),
        materialCost: getRandomRange(10000, 150000),
        totalCost: 0, // updated below
        startedAt: status !== WorkOrderStatus.Waiting ? new Date(woCreatedAt.getTime() + 1 * 24 * 3600 * 1000) : null,
        finishedAt: isFinished ? new Date(woCreatedAt.getTime() + getRandomRange(5, 15) * 24 * 3600 * 1000) : null,
        notes: 'Quality inspection standards applied.',
        createdById: getRandomElement(pmUsers).id,
        createdAt: woCreatedAt
      }
    })
    
    await prisma.workOrder.update({
      where: { id: wo.id },
      data: { totalCost: wo.labourCost + wo.materialCost }
    })
    
    // Create Production Log entries
    const logEntries = ['Work order created', 'Raw components allocated', 'Mechanical assembly started', 'Quality diagnostics running', 'Assembly completed']
    const entriesCount = isFinished ? 5 : getRandomRange(1, 3)
    for (let lIdx = 0; lIdx < entriesCount; lIdx++) {
      await prisma.productionLog.create({
        data: {
          workOrderId: wo.id,
          entry: logEntries[lIdx],
          actorName: generateIndianName()
        }
      })
    }
    
    // Create material consumption
    const component = getRandomElement(rawComponents)
    await prisma.materialConsumption.create({
      data: {
        workOrderId: wo.id,
        rawComponentId: component.id,
        quantity: getRandomRange(1, 5),
        unitCost: component.price,
        totalCost: component.price * getRandomRange(1, 5),
        consumedById: getRandomElement(users).id,
        notes: 'Standard batch consumption.'
      }
    })
  }

  // 16. Service Records / Warranty (120 total, 1-to-1 with Projects)
  console.log('🔧 Seeding 120 Warranty / Service Records...')
  const serviceRecords: any[] = []
  
  for (let i = 1; i <= 120; i++) {
    const project = projects[i - 1]
    const instDate = project.completedAt 
      ? new Date(project.completedAt) 
      : new Date(project.startDate.getTime() + getRandomRange(20, 60) * 24 * 3600 * 1000)
      
    const rec = await prisma.serviceRecord.create({
      data: {
        id: `service-rec-${i}`,
        projectId: project.id,
        companyId: project.companyId,
        productDescription: 'Cleantech Industrial System Module A',
        installationDate: instDate,
        warrantyStart: instDate,
        warrantyEnd: new Date(instDate.getTime() + 365 * 24 * 3600 * 1000),
        warrantyMonths: 12,
        amcEnd: new Date(instDate.getTime() + 730 * 24 * 3600 * 1000),
        serviceEngineerId: getRandomElement(seUsers).id,
        serviceCost: getRandomRange(5000, 30000),
        notes: 'System checked and commissioned on site.',
        createdAt: instDate
      }
    })
    serviceRecords.push(rec)
  }

  // 17. Service Requests (180 total)
  console.log('🛠️ Seeding 180 Service Requests...')
  const requestStatuses = [ServiceRequestStatus.Open, ServiceRequestStatus.InProgress, ServiceRequestStatus.Resolved, ServiceRequestStatus.Closed]
  
  for (let i = 1; i <= 180; i++) {
    const record = getRandomElement(serviceRecords)
    const status = getRandomElement(requestStatuses)
    const srCreatedAt = new Date(record.warrantyStart.getTime() + getRandomRange(5, 180) * 24 * 3600 * 1000)
    
    await prisma.serviceRequest.create({
      data: {
        id: `service-req-${i}`,
        refNumber: `SR-2026-${String(i).padStart(4, '0')}`,
        serviceRecordId: record.id,
        type: getRandomElement(['complaint', 'maintenance', 'inspection']),
        title: `Service Request #${i} – Diagnostic follow-up`,
        description: 'Verify system output and calibrate digital sensors.',
        status,
        priority: getRandomElement(['Low', 'Medium', 'High']),
        slaDeadline: new Date(srCreatedAt.getTime() + 2 * 24 * 3600 * 1000),
        engineerId: record.serviceEngineerId,
        engineerName: 'Service Team Specialist',
        cost: getRandomRange(1000, 15000),
        resolvedAt: (status === ServiceRequestStatus.Resolved || status === ServiceRequestStatus.Closed) ? new Date(srCreatedAt.getTime() + getRandomRange(0.5, 2) * 24 * 3600 * 1000) : null,
        createdAt: srCreatedAt
      }
    })
  }

  // 18. Support Tickets (200 total)
  console.log('📞 Seeding 200 Support Tickets...')
  const ticketStatuses = [TicketStatus.Open, TicketStatus.InProgress, TicketStatus.Resolved, TicketStatus.Closed]
  
  for (let i = 1; i <= 200; i++) {
    const company = getRandomElement(companies)
    const contact = contacts.find(c => c.companyId === company.id)
    const ticketCreatedAt = new Date(Date.now() - getRandomRange(1, 365) * 24 * 3600 * 1000)
    
    await prisma.supportTicket.create({
      data: {
        id: `ticket-${i}`,
        companyId: company.id,
        contactId: contact ? contact.id : null,
        title: `Support Ticket #${i} – Output performance query`,
        description: 'Client reports occasional thermal load drop under heavy load conditions.',
        priority: getRandomElement([TicketPriority.Low, TicketPriority.Medium, TicketPriority.High, TicketPriority.Critical]),
        status: getRandomElement(ticketStatuses),
        notes: 'Initial diagnostics sent to operations team.',
        resolvedAt: getRandomElement([new Date(ticketCreatedAt.getTime() + getRandomRange(1, 5) * 24 * 3600 * 1000), null]),
        createdAt: ticketCreatedAt
      }
    })
  }

  // 19. Invoices (180 total)
  console.log('💰 Seeding 180 Invoices...')
  const invoiceStatuses = ['Paid', 'Unpaid', 'Sent', 'PartiallyPaid', 'Overdue']
  
  for (let i = 1; i <= 180; i++) {
    const project = getRandomElement(projects)
    const company = getRandomElement(companies)
    const amount = getRandomRange(50000, 750000)
    const status = getRandomElement(invoiceStatuses) as any
    const isPaid = status === 'Paid'
    const invDate = new Date(Date.now() - getRandomRange(1, 365) * 24 * 3600 * 1000)
    
    const inv = await prisma.invoice.create({
      data: {
        id: `invoice-${i}`,
        number: `INV-2026-${String(i).padStart(4, '0')}`,
        date: invDate,
        customer: company.name,
        status,
        amount,
        paidAmount: isPaid ? amount : status === 'PartiallyPaid' ? amount * 0.5 : 0,
        dueDate: new Date(invDate.getTime() + 15 * 24 * 3600 * 1000),
        projectId: project.id,
        fromName: 'Aspiration Cleantech Ventures',
        fromAddr: '7, Mount Road, Chennai, TN, India',
        toName: company.name,
        toAddr: `${company.area}, ${company.city}, ${company.state}, India`,
        customerGstin: company.gstNumber,
        customerState: company.state,
        gstRate: 9, // CGST 9% + SGST 9%
        createdAt: invDate
      }
    })
    
    // Create items
    await prisma.invoiceItem.create({
      data: {
        invoiceId: inv.id,
        item: 'Clean energy installation consultancy & deployment services',
        amount: amount / 1.18,
        rate: amount / 1.18,
        hours: 1
      }
    })
    
    // Create payments if paid
    if (isPaid || status === 'PartiallyPaid') {
      await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          amount: isPaid ? amount : amount * 0.5,
          method: getRandomElement(['NEFT', 'RTGS', 'UPI', 'Cheque']),
          notes: 'Received clean billing payment.',
          paidAt: new Date(invDate.getTime() + getRandomRange(1, 10) * 24 * 3600 * 1000)
        }
      })
    }
  }

  // 20. Expenses (200 total)
  console.log('💸 Seeding 200 Expenses...')
  const expCategories = ['travel', 'utilities', 'salary', 'materials', 'other']
  for (let i = 1; i <= 200; i++) {
    const project = getRandomElement(projects)
    const user = getRandomElement(users)
    const expDate = new Date(Date.now() - getRandomRange(1, 365) * 24 * 3600 * 1000)
    
    await prisma.expense.create({
      data: {
        id: `expense-${i}`,
        title: `Monthly operational expense #${i}`,
        amount: getRandomRange(1000, 45000),
        category: getRandomElement(expCategories),
        entityType: 'Project',
        entityId: project.id,
        date: expDate,
        notes: 'Approved by accounting department.',
        createdAt: expDate
      }
    })
  }

  // 21. Attendance Records (12 Months for 100 employees)
  console.log('📅 Seeding 12 Months Attendance for 100 Employees (Chunked)...')
  
  // We will generate attendance for 100 employees for the last 365 days (excluding weekends)
  // 365 days total, roughly 260 working days. 260 * 100 = 26,000 records.
  const attendanceData: any[] = []
  const today = new Date()
  
  for (let dayOffset = 365; dayOffset >= 0; dayOffset--) {
    const currentDate = new Date(today.getTime() - dayOffset * 24 * 3600 * 1000)
    const dayOfWeek = currentDate.getDay()
    
    // Skip Saturday and Sunday to make it realistic
    if (dayOfWeek === 0 || dayOfWeek === 6) continue
    
    for (const employee of users) {
      // Determine status
      const roll = Math.random()
      let status = 'present'
      let minutesLate = 0
      let checkIn: Date | null = null
      let checkOut: Date | null = null
      
      if (roll < 0.82) {
        status = 'present'
        checkIn = new Date(currentDate.setHours(9, getRandomRange(0, 29), 0, 0))
        checkOut = new Date(currentDate.setHours(17, getRandomRange(30, 59), 0, 0))
      } else if (roll < 0.88) {
        status = 'late'
        minutesLate = getRandomRange(30, 90)
        checkIn = new Date(currentDate.setHours(10, getRandomRange(0, 30), 0, 0))
        checkOut = new Date(currentDate.setHours(18, 0, 0, 0))
      } else if (roll < 0.93) {
        status = 'work_from_home'
        checkIn = new Date(currentDate.setHours(9, 0, 0, 0))
        checkOut = new Date(currentDate.setHours(17, 30, 0, 0))
      } else if (roll < 0.96) {
        status = 'half_day'
        checkIn = new Date(currentDate.setHours(9, 0, 0, 0))
        checkOut = new Date(currentDate.setHours(13, 0, 0, 0))
      } else if (roll < 0.98) {
        status = 'leave'
      } else {
        status = 'absent'
      }
      
      attendanceData.push({
        userId: employee.id,
        date: new Date(currentDate.setHours(0, 0, 0, 0)),
        checkIn,
        checkOut,
        breakMinutes: status === 'present' || status === 'late' ? 60 : 0,
        status,
        minutesLate,
        notes: status === 'leave' ? 'Sick leave applied.' : status === 'work_from_home' ? 'WFH due to weather.' : 'Daily log.'
      })
    }
  }

  // Batch insert attendance in chunks of 5000 to prevent database query limits
  const chunkSize = 5000
  for (let k = 0; k < attendanceData.length; k += chunkSize) {
    const chunk = attendanceData.slice(k, k + chunkSize)
    await prisma.attendanceRecord.createMany({
      data: chunk,
      skipDuplicates: true
    })
  }
  console.log(`✅ Seeded ${attendanceData.length} attendance records successfully.`)

  // 22. Notifications (~500 total)
  console.log('🔔 Seeding 500 Notifications...')
  const notifications: any[] = []
  const severities = ['info', 'warning', 'critical']
  
  for (let i = 1; i <= 500; i++) {
    const user = getRandomElement(users)
    const project = getRandomElement(projects)
    const severity = getRandomElement(severities)
    
    notifications.push({
      userId: user.id,
      type: getRandomElement(['project_overrun', 'info', 'warning']),
      severity,
      title: severity === 'critical' ? 'SLA breach imminent' : 'Purchase Order updated',
      message: `System message: Operation status changed on ${project.title}. Checked by regional lead.`,
      entityType: 'Project',
      entityId: project.id,
      read: i <= 350,
      createdAt: new Date(Date.now() - getRandomRange(1, 30) * 24 * 3600 * 1000)
    })
  }
  
  for (let k = 0; k < notifications.length; k += chunkSize) {
    const chunk = notifications.slice(k, k + chunkSize)
    await prisma.notification.createMany({ data: chunk })
  }

  // 23. CalendarEvents (~150 total)
  console.log('📅 Seeding 150 Calendar Events...')
  const colors = ['blue', 'green', 'yellow', 'red', 'purple']
  const eventTypes = ['Meeting with client', 'Site visit inspection', 'AMC Renewal review', 'Design review board']
  
  for (let i = 1; i <= 150; i++) {
    const project = getRandomElement(projects)
    const date = new Date(Date.now() + getRandomRange(-365, 90) * 24 * 3600 * 1000)
    
    await prisma.calendarEvent.create({
      data: {
        id: `event-${i}`,
        title: `${getRandomElement(eventTypes)} – ${project.title.substring(0, 20)}`,
        date,
        startTime: `${getRandomRange(9, 17)}:00`,
        endTime: `${getRandomRange(10, 18)}:00`,
        color: getRandomElement(colors)
      }
    })
  }

  // 24. Revenue Targets (12 months of target for the year)
  console.log('📊 Seeding Revenue Targets for 12 months...')
  for (const year of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      await prisma.revenueTarget.create({
        data: {
          month: m,
          year,
          targetAmount: getRandomRange(15, 60) * 100000
        }
      })
    }
  }

  console.log('🎉 Database bulk seeding finished successfully!')
  console.log(`Summary of Seeded Data:
  - 100 Employees/Users
  - 24 Dealers/Suppliers
  - 300 Raw Components
  - 150 Companies
  - 250 Contacts
  - 200 Leads
  - 120 Deals
  - 150 Quotations
  - 85 Quotations Accepted (direct Deal handover, no Sales Order)
  - 120 Projects (80 Completed)
  - 250 Tasks
  - 180 Material Requests
  - 200 Purchase Orders
  - 170 Goods Receipts
  - 120 Work Orders (Manufacturing)
  - 120 Service Records (Warranty)
  - 180 Service Requests
  - 200 Support Tickets
  - 180 Invoices
  - 200 Expenses
  - 12 months Revenue Targets & Attendance`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
