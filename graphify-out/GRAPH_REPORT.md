# Graph Report - aspcv-crm  (2026-07-26)

## Corpus Check
- 378 files · ~1,802,022 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2559 nodes · 3710 edges · 252 communities (210 shown, 42 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1aea0364`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Auth & JWT Core
- Frontend Layout & Sidebar
- Currency Context
- Existing API Endpoints
- Backend Package Config
- Frontend Package Config
- Accounts & CRM Context
- TS App Config
- Auth Pages (Login/Protected)
- TS Node Config
- Contacts & Leads Pages
- Module Registry
- Backend Routes (Enterprise)
- Prisma Schema & DB Models
- Discussion & Timeline Services
- File Storage Abstraction
- TanStack Query Hooks
- Shared UI Components
- Location Autocomplete
- Products Page
- Kanban & Tasks Pages
- Dashboard & Reports
- Settings & Support Pages
- Invoices Module
- Calendar Module
- Deals & Projects Pages
- Backend Middleware (RBAC)
- Zod Validation Schemas
- Tech Stack Concepts
- ASPCV Project Docs
- Graphify Config & LLM
- React Assets
- Vite Config
- Backend Seed Script
- Error Handling
- DiscussionPanel Component
- TimelinePanel Component
- useDiscussions/Timeline Hooks
- Procurement.tsx
- Sales.tsx
- Kanban.tsx
- rulesEngine.ts
- LeadDetailPanel.tsx
- ASPCV CRM
- Attendance.tsx
- Deals.tsx
- Installations.tsx
- React + TypeScript + Vite
- Topbar.tsx
- InvoicePDF.tsx
- CLAUDE.md
- Support.tsx
- Skills by Category
- useDeals.ts
- Skills Included
- useDealers.ts
- UserManagement.tsx
- Frontend
- Accounts.tsx
- Dealers.tsx
- Manufacturing.tsx
- Reports.tsx
- workflowEngine.ts
- frontend/package.json
- useAuthStore
- useCustomer360.ts
- useProjectBilling.ts
- useSupport.ts
- useTasks.ts
- toast.tsx
- Dashboard.tsx
- Service.tsx
- sequences.ts
- auditLogger.ts
- useInstallations.ts
- Calendar.tsx
- RawComponents.tsx
- Settings.tsx
- notificationScan.ts
- BOMPDF.tsx
- PurchaseOrderPDF.tsx
- QuotationPDF.tsx
- ServiceReportPDF.tsx
- useAttachments.ts
- Budget.tsx
- Customer360.tsx
- Leave.tsx
- Recruitment.tsx
- Reimbursements.tsx
- attachments.ts
- kanban.ts
- HandoverDocumentPDF.tsx
- SalarySlipPDF.tsx
- useAuditLogs.ts
- useBusinessRules.ts
- useCalendarEvents.ts
- useCompanies.ts
- types/index.ts
- Accessibility Expert
- Account Management Specialist
- Activity Tracking Specialist
- Agent Workflow Designer
- AI CRM Assistant
- Analytics Engineer
- API Documentation Writer
- API Engineer
- Authentication Specialist
- Authorization Specialist
- AWS Architect
- Backend Engineer
- Backend Performance Expert
- Bug Hunter
- Business Analyst
- Calendar Sync Expert
- CI/CD Engineer
- Code Reviewer
- Codebase Maintainer
- Compliance Specialist
- Contact Management Specialist
- CRM Architect
- Customer Success Specialist
- Dashboard Analytics Expert
- Dashboard Builder
- Data Modeling Expert
- Data Table Specialist
- Database Architect
- Database Documentation Writer
- Database Performance Expert
- Deal/Pipeline Specialist
- Dependency Manager
- DevOps Engineer
- Docker Expert
- E2E Test Engineer
- Form Builder
- Frontend Performance Expert
- Graph API Expert
- Integration Engineer
- Integration Test Engineer
- JWT Specialist
- KPI Specialist
- Lead Management Specialist
- Microservices Architect
- Microsoft 365 Integration Expert
- TypeScript
- Migration Specialist
- Monitoring Specialist
- ASPCV CRM
- Multi-Tenant Architect
- NLP Specialist
- Node.js Expert
- Outlook Integration Expert
- OWASP Security Expert
- Performance Engineer
- crm-local-agent
- Performance Optimizer
- PostgreSQL Expert
- Product Manager
- QA Engineer
- Query Optimization Expert
- RBAC Specialist
- React Developer
- Recommendation Engine Specialist
- Refactoring Expert
- Reporting Specialist
- SaaS Architect
- Security Auditor
- Solution Architect
- State Management Expert
- System Architect
- Task Management Specialist
- Teams Integration Expert
- Technical Debt Auditor
- Technical Lead
- Technical Writer
- UI Engineer
- Unit Test Generator
- User Documentation Writer
- UX Designer
- Workflow Automation Specialist
- encrypt.ts
- attendance.ts
- WarrantyCertificatePDF.tsx
- LifecycleTimeline.tsx
- useBankAccounts.ts
- useNotifications.ts
- useSignatories.ts
- currencyContext.tsx
- Approvals.tsx
- Items.tsx
- Performance.tsx
- service-records.ts
- App.tsx
- LocationAutocomplete.tsx
- StatusBadge.tsx
- searchData.ts
- BusinessRules.tsx
- FnFSettlement.tsx
- Roles.tsx
- gstin.ts
- backend/src/modules/registry.ts
- expenses.ts
- goods-receipts.ts
- items.ts
- AttachmentUploader.tsx
- FilterChips.tsx
- KpiCard.tsx
- useDesignations.ts
- useIndustries.ts
- csvUtils.ts
- frontend/src/modules/registry.ts
- CompanyAssets.tsx
- HRSettings.tsx
- MLAnalytics.tsx
- SalaryStructure.tsx
- Backend Agent
- Database Agent
- Frontend Agent
- Testing Agent
- seed-enterprise.ts
- seed-hrms.ts
- src/seed.ts
- ProjectERPPanel.tsx
- ConfirmDialog.tsx
- DesignationInput.tsx
- EmptyState.tsx
- IndustryInput.tsx
- Modal.tsx
- Pagination.tsx
- SectionHeader.tsx
- Spinner.tsx
- TaskPanel.tsx
- Toolbar.tsx
- useTimeline.ts
- AuditLogs.tsx
- HRReports.tsx
- Onboarding.tsx
- Stub.tsx
- Training.tsx

## God Nodes (most connected - your core abstractions)
1. `prisma` - 86 edges
2. `authenticate()` - 68 edges
3. `createSafeRouter()` - 66 edges
4. `AuthRequest` - 55 edges
5. `requirePermission()` - 55 edges
6. `parsePagination()` - 29 edges
7. `paginate()` - 29 edges
8. `appendEvent()` - 26 edges
9. `createNotification()` - 20 edges
10. `compilerOptions` - 20 edges

## Surprising Connections (you probably didn't know these)
- `createMasterDataRouter()` --indirect_call--> `authenticate()`  [INFERRED]
  backend/src/lib/masterDataRouter.ts → backend/src/middleware/auth.ts
- `canAccessAttachmentTarget()` --calls--> `resolvePermission()`  [EXTRACTED]
  backend/src/routes/attachments.ts → backend/src/middleware/permissions.ts
- `main()` --calls--> `nextLeadNumber()`  [EXTRACTED]
  backend/scripts/backfill-lead-numbers.ts → backend/src/lib/sequences.ts
- `authenticate()` --calls--> `verifyToken()`  [EXTRACTED]
  backend/src/middleware/auth.ts → backend/src/lib/jwt.ts
- `auditLogger()` --calls--> `logAudit()`  [EXTRACTED]
  backend/src/middleware/auditLogger.ts → backend/src/services/audit.ts

## Import Cycles
- None detected.

## Communities (252 total, 42 thin omitted)

### Community 0 - "Auth & JWT Core"
Cohesion: 0.08
Nodes (51): paginate(), PaginatedResult, PaginationParams, parsePagination(), activeFilter(), enforceActiveOr404(), rejectIfInactive(), SOFT_DELETE_MODELS (+43 more)

### Community 1 - "Frontend Layout & Sidebar"
Cohesion: 0.09
Nodes (28): asyncHandler(), createMasterDataRouter(), SimpleMasterDelegate, prisma, createSafeRouter(), HTTP_METHODS, calendarEventSchema, requirePermission() (+20 more)

### Community 2 - "Currency Context"
Cohesion: 0.04
Nodes (46): getMLForecast(), app, errorHandler(), router, router, router, router, router (+38 more)

### Community 3 - "Existing API Endpoints"
Cohesion: 0.18
Nodes (12): Calendar API, Invoices API, Tasks API, Backend, Express 5, Node.js, Calendar Page, Invoices Page (+4 more)

### Community 4 - "Backend Package Config"
Cohesion: 0.05
Nodes (36): author, description, devDependencies, prisma, ts-node-dev, @types/bcrypt, @types/cors, @types/express (+28 more)

### Community 5 - "Frontend Package Config"
Cohesion: 0.04
Nodes (45): axios, class-variance-authority, clsx, date-fns, dependencies, axios, class-variance-authority, clsx (+37 more)

### Community 6 - "Accounts & CRM Context"
Cohesion: 0.06
Nodes (30): CO, fmt(), fmtDate(), MaterialRequestPDF(), MaterialRequestPDFProps, MRItem, s, ComponentMovement (+22 more)

### Community 7 - "TS App Config"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+17 more)

### Community 8 - "Auth Pages (Login/Protected)"
Cohesion: 0.05
Nodes (47): dependencies, bcrypt, cors, dotenv, express, express-async-errors, jsonwebtoken, multer (+39 more)

### Community 9 - "TS Node Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 10 - "Contacts & Leads Pages"
Cohesion: 0.08
Nodes (25): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks (+17 more)

### Community 11 - "Module Registry"
Cohesion: 0.04
Nodes (9): BOMAPI, BOMItem, GoodsReceiptAPI, InventoryAllocationAPI, POItem, PurchaseOrderAPI, ServiceRecordAPI, ServiceRequestAPI (+1 more)

### Community 12 - "Backend Routes (Enterprise)"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule, rootDir (+10 more)

### Community 13 - "Prisma Schema & DB Models"
Cohesion: 0.12
Nodes (14): discussionSchema, authenticate(), AuthRequest, ADMIN_ROLES, router, router, VALID_PAYMENT_TERMS, VALID_UNITS (+6 more)

### Community 14 - "Discussion & Timeline Services"
Cohesion: 0.09
Nodes (28): amcSchema, INCLUDE, router, visitSchema, buildProjectUpdate(), canActOnTier(), PROJECT_DATE_KEYS, PROJECT_EDIT_KEYS (+20 more)

### Community 15 - "File Storage Abstraction"
Cohesion: 0.09
Nodes (24): CsvColDef, CsvImportExport(), ImportResult, Props, Department, DepartmentMember, useDepartments(), CRM_ROLES (+16 more)

### Community 16 - "TanStack Query Hooks"
Cohesion: 0.07
Nodes (26): apiToUI, blankForm, drawGantt(), dropdownStyle, GANTT_COLORS, GanttCanvas(), GanttTask, inp() (+18 more)

### Community 17 - "Shared UI Components"
Cohesion: 0.06
Nodes (31): 1. Permission hook (`hooks/usePermission.ts`), 1. Permission Resolution Middleware (`middleware/permissions.ts`), 1. RoleDefinition (replaces Role enum), 2. `GET /api/auth/my-permissions`, 2. Own-data scoping helper (`middleware/scoping.ts`), 2. RolePermission, 3. All 27 route files — swap `requireRole` → `requirePermission`, 3. Smart permission components (+23 more)

### Community 18 - "Location Autocomplete"
Cohesion: 0.07
Nodes (11): BOARDS_KEY, CardInput, KanbanBoard, KanbanCard, KanbanCardAssignee, KanbanCardLabel, KanbanChecklistItem, KanbanColumn (+3 more)

### Community 19 - "Products Page"
Cohesion: 0.18
Nodes (10): name, private, scripts, build:backend, build:frontend, db:generate, db:migrate, dev:backend (+2 more)

### Community 20 - "Kanban & Tasks Pages"
Cohesion: 0.08
Nodes (15): signToken(), TokenPayload, verifyToken(), forgotPasswordSchema, loginSchema, resetPasswordSchema, createRateLimiter(), RateLimitEntry (+7 more)

### Community 21 - "Dashboard & Reports"
Cohesion: 0.08
Nodes (18): DealDetailPanel(), fmt(), Props, STAGE_LABEL, STAGE_STYLE, blankForm, DEAL_CATEGORIES, DiscussionPanel() (+10 more)

### Community 22 - "Settings & Support Pages"
Cohesion: 0.12
Nodes (25): avatarColor(), avatarColors, blankForm, blankItem(), blankPdfForm, fmtAmt(), fmtDateStr(), FormItem (+17 more)

### Community 23 - "Invoices Module"
Cohesion: 0.14
Nodes (20): validateInvoiceData(), amountInWords(), ComputedLineItem, computeInvoice(), InvoiceTotals, LineItemInput, numToWords(), ones (+12 more)

### Community 24 - "Calendar Module"
Cohesion: 0.13
Nodes (11): { useList: useCapacityUnits, useCreate: useCreateCapacityUnit, useDelete: useDeleteCapacityUnit }, { useList: useCommercialModels, useCreate: useCreateCommercialModel, useDelete: useDeleteCommercialModel }, { useList: useCountries, useCreate: useCreateCountry, useDelete: useDeleteCountry }, { useList: useLeadSourcesMaster, useCreate: useCreateLeadSourceMaster, useDelete: useDeleteLeadSourceMaster }, createMasterDataHooks(), MasterDataItem, { useList: useReasonCodes, useCreate: useCreateReasonCode, useDelete: useDeleteReasonCode }, { useList: useRegions, useCreate: useCreateRegion, useDelete: useDeleteRegion } (+3 more)

### Community 25 - "Deals & Projects Pages"
Cohesion: 0.11
Nodes (19): blankContact(), blankForm, blankSource(), ContactRow, dropdownStyle, INDIA_STATES, inp(), LEAD_CSV_COLS (+11 more)

### Community 26 - "Backend Middleware (RBAC)"
Cohesion: 0.12
Nodes (4): fileStorage, IFileStorage, LocalFileStorage, SharePointFileStorage

### Community 27 - "Zod Validation Schemas"
Cohesion: 0.13
Nodes (10): Props, ContactEvent, api, Account, Contact, CrmDataContext, CrmDataContextValue, CrmDataProvider() (+2 more)

### Community 28 - "Tech Stack Concepts"
Cohesion: 0.10
Nodes (4): HandoverDocAPI, QuotationAPI, QuotationItem, SalesOrderAPI

### Community 29 - "ASPCV Project Docs"
Cohesion: 0.12
Nodes (4): CalendarEvent, ICalendarProvider, LocalCalendarProvider, OutlookCalendarProvider

### Community 30 - "Graphify Config & LLM"
Cohesion: 0.11
Nodes (17): Create, Dynamic RBAC + Approval-Gated Mutations Implementation Plan, File Map, Modify, Self-Review, Task 10: Admin Pages — Roles, Permissions, Approvals, Task 11: SalesRepresentative Scoping + Own-Data Filtering on Pages, Task 12: graphify update + final smoke test (+9 more)

### Community 31 - "React Assets"
Cohesion: 0.22
Nodes (15): Expense, useCreateExpense(), useDeleteExpense(), useExpenses(), useExpenseSummary(), FinancialEntry, FinancialSummary, useCreateFinancialEntry() (+7 more)

### Community 32 - "Vite Config"
Cohesion: 0.11
Nodes (8): DepartmentBreakdown, FunnelStatus, LeaderboardRow, PipelineStage, ProductPerf, ReportsSummary, RevenueMonth, TicketWeek

### Community 34 - "Error Handling"
Cohesion: 0.21
Nodes (14): useAllSalary(), useApproveSalary(), useGenerateSalary(), useMarkSalaryPaid(), useMySalary(), useUsers(), fmt(), MONTHS (+6 more)

### Community 35 - "DiscussionPanel Component"
Cohesion: 0.14
Nodes (9): ApiContact, avatarColor(), avatarColors, blankForm, Contacts(), EVENT_ICONS, initials(), inp() (+1 more)

### Community 36 - "TimelinePanel Component"
Cohesion: 0.12
Nodes (7): Lead, LeadContact, LeadOwner, LeadSourceEntry, LeadStageHistoryEntry, NamedRef, PaginatedLeads

### Community 41 - "Procurement.tsx"
Cohesion: 0.12
Nodes (9): BOM_STATUS_STYLES, inputSmall, inputStyle, labelStyle, modalCard, modalHeader, modalOverlay, PO_STATUS_STYLES (+1 more)

### Community 42 - "Sales.tsx"
Cohesion: 0.12
Nodes (7): inputStyle, KPI_ICON_COLORS, labelStyle, STATUS_STYLES, Tab, tdStyle, thStyle

### Community 43 - "Kanban.tsx"
Cohesion: 0.15
Nodes (11): Avatar, avatarFor(), CardFormState, dueMeta(), fmtDate(), inp, Kanban(), lbl (+3 more)

### Community 44 - "rulesEngine.ts"
Cohesion: 0.20
Nodes (11): router, RULE_KEYS, handlers, inCooldown(), recipientsForRoles(), registerRule(), RuleConfig, RuleHandler (+3 more)

### Community 45 - "LeadDetailPanel.tsx"
Cohesion: 0.17
Nodes (12): age(), fmt(), fmtDuration(), LeadDetailPanel(), PIPELINE_LABEL, PIPELINE_STAGES, PipelinePanel(), Props (+4 more)

### Community 46 - "ASPCV CRM"
Cohesion: 0.18
Nodes (10): 1. Backend, 2. Frontend, ASPCV CRM, Modules / Pages, Prerequisites, RBAC, Repo layout, Screenshots (+2 more)

### Community 47 - "Attendance.tsx"
Cohesion: 0.30
Nodes (13): AttendanceRecord, useAllAttendance(), useBreakEnd(), useBreakStart(), useCheckIn(), useCheckOut(), useMyAttendance(), useTodayAttendance() (+5 more)

### Community 48 - "Deals.tsx"
Cohesion: 0.14
Nodes (13): apiStageToUI, blankForm, DEAL_CSV_COLS, DEAL_CSV_TEMPLATE, DEAL_STAGE_MAP, Deals(), dropdownStyle, inp() (+5 more)

### Community 49 - "Installations.tsx"
Cohesion: 0.14
Nodes (13): apiToUI, blankForm, dropdownStyle, inp(), INST_CSV_COLS, INST_CSV_TEMPLATE, INST_STATUS_MAP, Installations() (+5 more)

### Community 50 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 51 - "Topbar.tsx"
Cohesion: 0.15
Nodes (9): navGroups, NavItem, SidebarProps, relativeTime(), sevColor, titles, Topbar(), TopbarProps (+1 more)

### Community 52 - "InvoicePDF.tsx"
Cohesion: 0.20
Nodes (13): amountWords(), CO, fmt(), fmtDate(), fmtInt(), InvoicePDF(), InvoicePDFProps, numToWords() (+5 more)

### Community 53 - "CLAUDE.md"
Cohesion: 0.25
Nodes (7): Commands, communication — MANDATORY, graphify, graphify — MANDATORY token-saving protocol, planning — MANDATORY (local Mythos override), REQUIRED order of operations, Why

### Community 54 - "Support.tsx"
Cohesion: 0.15
Nodes (12): apiToUI, blankForm, dropdownStyle, inp(), menuItem, priorities, priorityStyle, statusStyle (+4 more)

### Community 55 - "Skills by Category"
Cohesion: 0.08
Nodes (25): 🤖 AI Features (4) [Future], 🏗️ Architecture & Planning (7), ASPCV CRM — Complete Skills Index, 🔧 Backend (7), Code Review, 💼 CRM Domain (9), 📈 Data & Analytics (4), 🗄️ Database (5) (+17 more)

### Community 56 - "useDeals.ts"
Cohesion: 0.15
Nodes (3): DEAL_STAGES, DealAPI, STAGE_LABEL

### Community 57 - "Skills Included"
Cohesion: 0.07
Nodes (27): 1. **Lead Research Assistant** (`lead-research-assistant/`), 2. **Document Skills** (`document-skills/`), 3. **File Organizer** (`file-organizer/`), 4. **Invoice Organizer** (`invoice-organizer/`), 5. **Google Drive Automation** (`googledrive-automation/`), 6. **Slack Bot Automation** (`slackbot-automation/`), 7. **MCP Builder** (`mcp-builder/`), 8. **Skill Creator** (`skill-creator/`) (+19 more)

### Community 58 - "useDealers.ts"
Cohesion: 0.17
Nodes (3): Dealer, DealerContact, DealerItem

### Community 59 - "UserManagement.tsx"
Cohesion: 0.17
Nodes (5): ALL_PERMISSIONS, PERMISSION_GROUPS, PermOverride, RoleDef, User

### Community 60 - "Frontend"
Cohesion: 0.12
Nodes (19): Kanban API, Products API, aspcv-logo.png, Frontend, @hello-pangea/dnd, recharts, vite, @hello-pangea/dnd (+11 more)

### Community 61 - "Accounts.tsx"
Cohesion: 0.22
Nodes (9): Accounts(), blankForm, DEFAULT_STATUS_STYLE, dropdownStyle, getStatusStyle(), industries, inp(), menuItem (+1 more)

### Community 62 - "Dealers.tsx"
Cohesion: 0.22
Nodes (7): blankContact, blankForm, blankItem, DealerDetailModal(), Dealers(), iconBtn, inp()

### Community 63 - "Manufacturing.tsx"
Cohesion: 0.20
Nodes (5): KPI_COLORS, Manufacturing(), STATUS_COLORS, WO_STATUS_CONFIG, WO_STATUS_ORDER

### Community 64 - "Reports.tsx"
Cohesion: 0.22
Nodes (8): attainColor(), card, DATE_RANGE_OPTIONS, fmt(), FUNNEL_LABEL, Reports(), STAGE_COLOR, STAGE_LABEL

### Community 65 - "workflowEngine.ts"
Cohesion: 0.36
Nodes (9): ApproverInfo, evaluateConditions(), filterStepsByRules(), getMyPendingApprovals(), getWorkflowHistory(), mapStepToStatus(), performAction(), resolveApprover() (+1 more)

### Community 66 - "frontend/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 67 - "useAuthStore"
Cohesion: 0.31
Nodes (7): Can(), CanProps, usePermission(), usePermissions(), AuthState, AuthUser, useAuthStore

### Community 68 - "useCustomer360.ts"
Cohesion: 0.36
Nodes (9): Page, useCompanyContacts(), useCompanyDeals(), useCompanyInstallations(), useCompanyInvoices(), useCompanyLeads(), useCompanyProjects(), useCompanyScoped() (+1 more)

### Community 69 - "useProjectBilling.ts"
Cohesion: 0.29
Nodes (8): BillingInvoice, BillingPayment, invalidate(), ProjectBilling, useCancelInvoice(), useGenerateProjectInvoice(), useRecordPayment(), useSendInvoice()

### Community 70 - "useSupport.ts"
Cohesion: 0.20
Nodes (4): TICKET_PRIORITIES, TICKET_STATUS_LABEL, TICKET_STATUSES, TicketAPI

### Community 71 - "useTasks.ts"
Cohesion: 0.31
Nodes (8): inval(), Task, TaskFilter, useCompleteTask(), useCreateTask(), useDeleteTask(), useSubmitTask(), useUpdateTask()

### Community 72 - "toast.tsx"
Cohesion: 0.20
Nodes (5): COLORS, Ctx, Toast, ToastCtx, ToastType

### Community 73 - "Dashboard.tsx"
Cohesion: 0.27
Nodes (6): card, Dashboard(), fmtInr(), lastSixMonths(), statusStyle, timeAgo()

### Community 74 - "Service.tsx"
Cohesion: 0.24
Nodes (5): REQ_STATUS_STYLES, ServiceRecordCard(), Tab, WarrantyBadge(), warrantyDaysLeft()

### Community 75 - "sequences.ts"
Cohesion: 0.42
Nodes (7): main(), nextGRNumber(), nextInvoiceNumber(), nextLeadNumber(), nextMRNumber(), nextSeq(), nextWONumber()

### Community 76 - "auditLogger.ts"
Cohesion: 0.33
Nodes (8): ACTION_BY_METHOD, ACTION_OVERRIDES, actionFor(), auditLogger(), moduleFromPath(), MUTATING_METHODS, resolveUserName(), userNameCache

### Community 77 - "useInstallations.ts"
Cohesion: 0.22
Nodes (3): INSTALL_STATUS_LABEL, INSTALL_STATUSES, InstallationAPI

### Community 78 - "Calendar.tsx"
Cohesion: 0.22
Nodes (7): barData, blankForm, CalEvent, COLOR_OPTIONS, HOURS, initEvents, WEEKDAYS

### Community 79 - "RawComponents.tsx"
Cohesion: 0.31
Nodes (6): ageDays(), blankForm, inp(), RawComponents(), STATUS_STYLE, warrantyStatus()

### Community 80 - "Settings.tsx"
Cohesion: 0.25
Nodes (6): initNotifications, inp(), Settings(), Tab, TAB_ICONS, tabs

### Community 81 - "notificationScan.ts"
Cohesion: 0.54
Nodes (7): alreadyNotifiedRecently(), checkLowStock(), checkOverdueCards(), checkServiceDue(), inventoryRecipientIds(), runNotificationScan(), serviceRecipientIds()

### Community 82 - "BOMPDF.tsx"
Cohesion: 0.32
Nodes (7): BOMItemPDF, BOMPDF(), BOMPDFProps, CO, fmt(), fmtDate(), s

### Community 83 - "PurchaseOrderPDF.tsx"
Cohesion: 0.32
Nodes (7): CO, fmt(), fmtDate(), POItem, PurchaseOrderPDF(), PurchaseOrderPDFProps, s

### Community 84 - "QuotationPDF.tsx"
Cohesion: 0.32
Nodes (7): CO, fmt(), fmtDate(), QuotationPDF(), QuotationPDFItem, QuotationPDFProps, s

### Community 85 - "ServiceReportPDF.tsx"
Cohesion: 0.32
Nodes (7): CO, fmt(), fmtDate(), s, ServiceReportPDF(), ServiceReportPDFProps, ServiceRequestPDF

### Community 86 - "useAttachments.ts"
Cohesion: 0.25
Nodes (3): AttachmentAPI, DocumentType, RelatedModule

### Community 87 - "Budget.tsx"
Cohesion: 0.29
Nodes (5): barColorMap, Budget(), colorMap, getStatusStyle(), ProjectBudget

### Community 88 - "Customer360.tsx"
Cohesion: 0.25
Nodes (5): CALENDAR_CATEGORIES, CARD, SECTION_TITLE, TabKey, TABS

### Community 89 - "Leave.tsx"
Cohesion: 0.29
Nodes (7): fmtDate(), Holiday, Leave(), LeaveBalance, LeaveRequest, LeaveType, statusStyle

### Community 90 - "Recruitment.tsx"
Cohesion: 0.36
Nodes (6): candStatusColors, fdate(), fmt(), inp(), jobStatusColors, Recruitment()

### Community 91 - "Reimbursements.tsx"
Cohesion: 0.32
Nodes (7): fmtAmt(), fmtDate(), ReimbursementAllItem, ReimbursementClaim, Reimbursements(), ReimbursementType, statusStyle

### Community 92 - "attachments.ts"
Cohesion: 0.29
Nodes (6): canAccessAttachmentTarget(), DOCUMENT_TYPES, OWNERSHIP_RESOLVERS, RELATED_MODULES, router, upload

### Community 93 - "kanban.ts"
Cohesion: 0.29
Nodes (6): boardSchema, CARD_INCLUDE, cardSchema, columnSchema, moveSchema, router

### Community 94 - "HandoverDocumentPDF.tsx"
Cohesion: 0.38
Nodes (6): CO, fmt(), fmtDate(), HandoverDocumentPDF(), HandoverDocumentPDFProps, s

### Community 95 - "SalarySlipPDF.tsx"
Cohesion: 0.38
Nodes (6): fmt(), MONTHS, Props, s, SalarySlipPDF(), SalaryRecord

### Community 96 - "useAuditLogs.ts"
Cohesion: 0.29
Nodes (3): AuditLogEntry, AuditLogFilters, PaginatedAuditLogs

### Community 100 - "types/index.ts"
Cohesion: 0.29
Nodes (6): CalendarEvent, Invoice, KanbanCard, KanbanColumn, Product, Task

### Community 101 - "Accessibility Expert"
Cohesion: 0.29
Nodes (6): Accessibility Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 102 - "Account Management Specialist"
Cohesion: 0.29
Nodes (6): Account Management Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 103 - "Activity Tracking Specialist"
Cohesion: 0.29
Nodes (6): Activity Tracking Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 104 - "Agent Workflow Designer"
Cohesion: 0.29
Nodes (6): Agent Workflow Designer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 105 - "AI CRM Assistant"
Cohesion: 0.29
Nodes (6): AI CRM Assistant, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 106 - "Analytics Engineer"
Cohesion: 0.29
Nodes (6): Analytics Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 107 - "API Documentation Writer"
Cohesion: 0.29
Nodes (6): API Documentation Writer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 108 - "API Engineer"
Cohesion: 0.29
Nodes (6): API Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 109 - "Authentication Specialist"
Cohesion: 0.29
Nodes (6): Authentication Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 110 - "Authorization Specialist"
Cohesion: 0.29
Nodes (6): Authorization Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 111 - "AWS Architect"
Cohesion: 0.29
Nodes (6): AWS Architect, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 112 - "Backend Engineer"
Cohesion: 0.29
Nodes (6): Backend Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 113 - "Backend Performance Expert"
Cohesion: 0.29
Nodes (6): Backend Performance Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 114 - "Bug Hunter"
Cohesion: 0.29
Nodes (6): Bug Hunter, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 115 - "Business Analyst"
Cohesion: 0.29
Nodes (6): Business Analyst, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 116 - "Calendar Sync Expert"
Cohesion: 0.29
Nodes (6): Calendar Sync Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 117 - "CI/CD Engineer"
Cohesion: 0.29
Nodes (6): CI/CD Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 118 - "Code Reviewer"
Cohesion: 0.29
Nodes (6): Code Reviewer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 119 - "Codebase Maintainer"
Cohesion: 0.29
Nodes (6): Codebase Maintainer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 120 - "Compliance Specialist"
Cohesion: 0.29
Nodes (6): Compliance Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 121 - "Contact Management Specialist"
Cohesion: 0.29
Nodes (6): Contact Management Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 122 - "CRM Architect"
Cohesion: 0.29
Nodes (6): CRM Architect, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 123 - "Customer Success Specialist"
Cohesion: 0.29
Nodes (6): Customer Success Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 124 - "Dashboard Analytics Expert"
Cohesion: 0.29
Nodes (6): Dashboard Analytics Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 125 - "Dashboard Builder"
Cohesion: 0.29
Nodes (6): Dashboard Builder, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 126 - "Data Modeling Expert"
Cohesion: 0.29
Nodes (6): Data Modeling Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 127 - "Data Table Specialist"
Cohesion: 0.29
Nodes (6): Data Table Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 128 - "Database Architect"
Cohesion: 0.29
Nodes (6): Database Architect, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 129 - "Database Documentation Writer"
Cohesion: 0.29
Nodes (6): Database Documentation Writer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 130 - "Database Performance Expert"
Cohesion: 0.29
Nodes (6): Database Performance Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 131 - "Deal/Pipeline Specialist"
Cohesion: 0.29
Nodes (6): Deal/Pipeline Specialist, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 132 - "Dependency Manager"
Cohesion: 0.29
Nodes (6): Dependency Manager, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 133 - "DevOps Engineer"
Cohesion: 0.29
Nodes (6): DevOps Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 134 - "Docker Expert"
Cohesion: 0.29
Nodes (6): Docker Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 135 - "E2E Test Engineer"
Cohesion: 0.29
Nodes (6): E2E Test Engineer, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 136 - "Form Builder"
Cohesion: 0.29
Nodes (6): Form Builder, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 137 - "Frontend Performance Expert"
Cohesion: 0.29
Nodes (6): Frontend Performance Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 138 - "Graph API Expert"
Cohesion: 0.29
Nodes (6): Graph API Expert, Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 139 - "Integration Engineer"
Cohesion: 0.29
Nodes (6): Instructions, Integration Engineer, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 140 - "Integration Test Engineer"
Cohesion: 0.29
Nodes (6): Instructions, Integration Test Engineer, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 141 - "JWT Specialist"
Cohesion: 0.29
Nodes (6): Instructions, JWT Specialist, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill

### Community 142 - "KPI Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, KPI Specialist, Responsibilities, Role, When to Use This Skill

### Community 143 - "Lead Management Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Lead Management Specialist, Responsibilities, Role, When to Use This Skill

### Community 144 - "Microservices Architect"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Microservices Architect, Responsibilities, Role, When to Use This Skill

### Community 145 - "Microsoft 365 Integration Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Microsoft 365 Integration Expert, Responsibilities, Role, When to Use This Skill

### Community 146 - "TypeScript"
Cohesion: 0.40
Nodes (5): typescript, typescript, typescript, typescript, TypeScript

### Community 147 - "Migration Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Migration Specialist, Responsibilities, Role, When to Use This Skill

### Community 148 - "Monitoring Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Monitoring Specialist, Responsibilities, Role, When to Use This Skill

### Community 149 - "ASPCV CRM"
Cohesion: 0.67
Nodes (4): ASPCV CRM, graphify.yaml, Ollama, qwen3:4b

### Community 150 - "Multi-Tenant Architect"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Multi-Tenant Architect, Responsibilities, Role, When to Use This Skill

### Community 151 - "NLP Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, NLP Specialist, Responsibilities, Role, When to Use This Skill

### Community 152 - "Node.js Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Node.js Expert, Responsibilities, Role, When to Use This Skill

### Community 153 - "Outlook Integration Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Outlook Integration Expert, Responsibilities, Role, When to Use This Skill

### Community 154 - "OWASP Security Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, OWASP Security Expert, Responsibilities, Role, When to Use This Skill

### Community 155 - "Performance Engineer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Performance Engineer, Responsibilities, Role, When to Use This Skill

### Community 157 - "Performance Optimizer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Performance Optimizer, Responsibilities, Role, When to Use This Skill

### Community 158 - "PostgreSQL Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, PostgreSQL Expert, Responsibilities, Role, When to Use This Skill

### Community 159 - "Product Manager"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Product Manager, Responsibilities, Role, When to Use This Skill

### Community 160 - "QA Engineer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, QA Engineer, Responsibilities, Role, When to Use This Skill

### Community 161 - "Query Optimization Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Query Optimization Expert, Responsibilities, Role, When to Use This Skill

### Community 162 - "RBAC Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, RBAC Specialist, Responsibilities, Role, When to Use This Skill

### Community 163 - "React Developer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, React Developer, Responsibilities, Role, When to Use This Skill

### Community 164 - "Recommendation Engine Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Recommendation Engine Specialist, Responsibilities, Role, When to Use This Skill

### Community 165 - "Refactoring Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Refactoring Expert, Responsibilities, Role, When to Use This Skill

### Community 166 - "Reporting Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Reporting Specialist, Responsibilities, Role, When to Use This Skill

### Community 167 - "SaaS Architect"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, SaaS Architect, When to Use This Skill

### Community 168 - "Security Auditor"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Security Auditor, When to Use This Skill

### Community 169 - "Solution Architect"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Solution Architect, When to Use This Skill

### Community 170 - "State Management Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, State Management Expert, When to Use This Skill

### Community 171 - "System Architect"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, System Architect, When to Use This Skill

### Community 172 - "Task Management Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Task Management Specialist, When to Use This Skill

### Community 173 - "Teams Integration Expert"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Teams Integration Expert, When to Use This Skill

### Community 174 - "Technical Debt Auditor"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Technical Debt Auditor, When to Use This Skill

### Community 175 - "Technical Lead"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Technical Lead, When to Use This Skill

### Community 176 - "Technical Writer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Technical Writer, When to Use This Skill

### Community 177 - "UI Engineer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, UI Engineer, When to Use This Skill

### Community 178 - "Unit Test Generator"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, Unit Test Generator, When to Use This Skill

### Community 179 - "User Documentation Writer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, User Documentation Writer, When to Use This Skill

### Community 180 - "UX Designer"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, UX Designer, When to Use This Skill

### Community 181 - "Workflow Automation Specialist"
Cohesion: 0.29
Nodes (6): Instructions, Key Areas of Expertise, Responsibilities, Role, When to Use This Skill, Workflow Automation Specialist

### Community 182 - "encrypt.ts"
Cohesion: 0.60
Nodes (5): decrypt(), decryptIfPresent(), encrypt(), encryptIfPresent(), getKey()

### Community 183 - "attendance.ts"
Cohesion: 0.40
Nodes (3): getAttendanceConfig(), minutesLateCalc(), router

### Community 184 - "WarrantyCertificatePDF.tsx"
Cohesion: 0.40
Nodes (5): CO, fmtDate(), s, WarrantyCertificatePDF(), WarrantyCertificatePDFProps

### Community 185 - "LifecycleTimeline.tsx"
Cohesion: 0.47
Nodes (5): LifecycleTimeline(), Props, Stage, stageIndex(), STAGES

### Community 189 - "currencyContext.tsx"
Cohesion: 0.33
Nodes (3): Ctx, Currency, CurrencyCtx

### Community 190 - "Approvals.tsx"
Cohesion: 0.40
Nodes (5): ApprovalReq, Approvals(), STATUS_META, TIER_LABEL, typeLabel()

### Community 191 - "Items.tsx"
Cohesion: 0.40
Nodes (4): blankForm, iconBtn, inp(), Items()

### Community 192 - "Performance.tsx"
Cohesion: 0.40
Nodes (4): appraisalStatusColors, goalStatusColors, inp(), Performance()

### Community 193 - "service-records.ts"
Cohesion: 0.40
Nodes (4): router, serviceRecordUpdateSchema, serviceRequestSchema, serviceRequestUpdateSchema

### Community 195 - "LocationAutocomplete.tsx"
Cohesion: 0.40
Nodes (3): Area, City, Props

### Community 196 - "StatusBadge.tsx"
Cohesion: 0.40
Nodes (3): DEFAULT_FALLBACK, Props, StatusStyle

### Community 197 - "searchData.ts"
Cohesion: 0.40
Nodes (3): searchIndex, SearchResult, typeColor

### Community 199 - "FnFSettlement.tsx"
Cohesion: 0.60
Nodes (4): fmt(), FnFSettlement(), inp(), statusColors

### Community 200 - "Roles.tsx"
Cohesion: 0.40
Nodes (3): ALL_PERMISSIONS, PERMISSION_GROUPS, RoleDef

### Community 201 - "gstin.ts"
Cohesion: 0.83
Nodes (3): isValidGSTIN(), VALID_STATE_CODES, validateGSTIN()

### Community 204 - "goods-receipts.ts"
Cohesion: 0.50
Nodes (3): grItemSchema, grSchema, router

### Community 205 - "items.ts"
Cohesion: 0.50
Nodes (3): INCLUDE, itemSchema, router

### Community 213 - "CompanyAssets.tsx"
Cohesion: 0.67
Nodes (3): CompanyAssets(), inp(), statusColors

### Community 216 - "SalaryStructure.tsx"
Cohesion: 0.83
Nodes (3): card(), inp(), SalaryStructure()

### Community 217 - "Backend Agent"
Cohesion: 0.50
Nodes (3): Backend Agent, Security Checklist (review every output), Stack Context

### Community 218 - "Database Agent"
Cohesion: 0.50
Nodes (3): Database Agent, Review Checklist, Stack Context

### Community 219 - "Frontend Agent"
Cohesion: 0.50
Nodes (3): Do NOT generate (always write yourself), Frontend Agent, Stack Context

### Community 220 - "Testing Agent"
Cohesion: 0.50
Nodes (3): Review Checklist, Stack Context, Testing Agent

## Knowledge Gaps
- **1172 isolated node(s):** `node`, `name`, `version`, `description`, `main` (+1167 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Frontend Layout & Sidebar` to `Auth & JWT Core`, `service-records.ts`, `Currency Context`, `workflowEngine.ts`, `sequences.ts`, `auditLogger.ts`, `Prisma Schema & DB Models`, `Discussion & Timeline Services`, `expenses.ts`, `goods-receipts.ts`, `items.ts`, `rulesEngine.ts`, `notificationScan.ts`, `Kanban & Tasks Pages`, `Invoices Module`, `attendance.ts`, `attachments.ts`, `kanban.ts`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Contacts & Leads Pages` to `frontend/package.json`, `Frontend`, `TypeScript`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Backend Package Config` to `TypeScript`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _1172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & JWT Core` be split into smaller, more focused modules?**
  _Cohesion score 0.0770735524256651 - nodes in this community are weakly interconnected._
- **Should `Frontend Layout & Sidebar` be split into smaller, more focused modules?**
  _Cohesion score 0.0937766410912191 - nodes in this community are weakly interconnected._
- **Should `Currency Context` be split into smaller, more focused modules?**
  _Cohesion score 0.04107744107744108 - nodes in this community are weakly interconnected._