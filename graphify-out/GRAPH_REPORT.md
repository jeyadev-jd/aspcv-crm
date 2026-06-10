# Graph Report - ASPCV CRM  (2026-06-10)

## Corpus Check
- 96 files · ~1,541,238 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 664 nodes · 800 edges · 54 communities (41 shown, 13 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & JWT Core|Auth & JWT Core]]
- [[_COMMUNITY_Frontend Layout & Sidebar|Frontend Layout & Sidebar]]
- [[_COMMUNITY_Currency Context|Currency Context]]
- [[_COMMUNITY_Existing API Endpoints|Existing API Endpoints]]
- [[_COMMUNITY_Backend Package Config|Backend Package Config]]
- [[_COMMUNITY_Frontend Package Config|Frontend Package Config]]
- [[_COMMUNITY_Accounts & CRM Context|Accounts & CRM Context]]
- [[_COMMUNITY_TS App Config|TS App Config]]
- [[_COMMUNITY_Auth Pages (LoginProtected)|Auth Pages (Login/Protected)]]
- [[_COMMUNITY_TS Node Config|TS Node Config]]
- [[_COMMUNITY_Contacts & Leads Pages|Contacts & Leads Pages]]
- [[_COMMUNITY_Module Registry|Module Registry]]
- [[_COMMUNITY_Backend Routes (Enterprise)|Backend Routes (Enterprise)]]
- [[_COMMUNITY_Prisma Schema & DB Models|Prisma Schema & DB Models]]
- [[_COMMUNITY_Discussion & Timeline Services|Discussion & Timeline Services]]
- [[_COMMUNITY_File Storage Abstraction|File Storage Abstraction]]
- [[_COMMUNITY_TanStack Query Hooks|TanStack Query Hooks]]
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Location Autocomplete|Location Autocomplete]]
- [[_COMMUNITY_Products Page|Products Page]]
- [[_COMMUNITY_Kanban & Tasks Pages|Kanban & Tasks Pages]]
- [[_COMMUNITY_Dashboard & Reports|Dashboard & Reports]]
- [[_COMMUNITY_Settings & Support Pages|Settings & Support Pages]]
- [[_COMMUNITY_Invoices Module|Invoices Module]]
- [[_COMMUNITY_Calendar Module|Calendar Module]]
- [[_COMMUNITY_Deals & Projects Pages|Deals & Projects Pages]]
- [[_COMMUNITY_Backend Middleware (RBAC)|Backend Middleware (RBAC)]]
- [[_COMMUNITY_Zod Validation Schemas|Zod Validation Schemas]]
- [[_COMMUNITY_Tech Stack Concepts|Tech Stack Concepts]]
- [[_COMMUNITY_ASPCV Project Docs|ASPCV Project Docs]]
- [[_COMMUNITY_Graphify Config & LLM|Graphify Config & LLM]]
- [[_COMMUNITY_React Assets|React Assets]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Backend Seed Script|Backend Seed Script]]
- [[_COMMUNITY_Error Handling|Error Handling]]
- [[_COMMUNITY_DiscussionPanel Component|DiscussionPanel Component]]
- [[_COMMUNITY_useDiscussionsTimeline Hooks|useDiscussions/Timeline Hooks]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `useIsMobile()` - 18 edges
3. `compilerOptions` - 16 edges
4. `authenticate()` - 14 edges
5. `AuthRequest` - 11 edges
6. `compilerOptions` - 11 edges
7. `useCurrency()` - 10 edges
8. `Deals()` - 10 edges
9. `Projects()` - 10 edges
10. `appendEvent()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AppLayout()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/useIsMobile.ts
- `Topbar()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/Topbar.tsx → frontend/src/lib/useIsMobile.ts
- `LoginPage()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/auth/LoginPage.tsx → frontend/src/lib/useIsMobile.ts
- `Deals()` --calls--> `useDeals()`  [INFERRED]
  frontend/src/pages/Deals.tsx → frontend/src/hooks/useDeals.ts
- `Deals()` --calls--> `useCreateDeal()`  [INFERRED]
  frontend/src/pages/Deals.tsx → frontend/src/hooks/useDeals.ts

## Import Cycles
- None detected.

## Communities (54 total, 13 thin omitted)

### Community 0 - "Auth & JWT Core"
Cohesion: 0.08
Nodes (37): signToken(), verifyToken(), prisma, companySchema, contactSchema, dealSchema, discussionSchema, installationSchema (+29 more)

### Community 1 - "Frontend Layout & Sidebar"
Cohesion: 0.20
Nodes (9): recharts, barData, blankForm, CalEvent, COLOR_OPTIONS, HOURS, initEvents, WEEKDAYS (+1 more)

### Community 2 - "Currency Context"
Cohesion: 0.06
Nodes (26): Ctx, Currency, CurrencyCtx, useCurrency(), card, cohortData, DATE_RANGES, dealsTrend (+18 more)

### Community 3 - "Existing API Endpoints"
Cohesion: 0.05
Nodes (45): Calendar API, Invoices API, Kanban API, Products API, Tasks API, ASPCV CRM, aspcv-logo.png, Backend (+37 more)

### Community 4 - "Backend Package Config"
Cohesion: 0.08
Nodes (24): author, dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, multer (+16 more)

### Community 5 - "Frontend Package Config"
Cohesion: 0.09
Nodes (22): dependencies, axios, class-variance-authority, clsx, date-fns, lucide-react, @radix-ui/react-avatar, @radix-ui/react-checkbox (+14 more)

### Community 6 - "Accounts & CRM Context"
Cohesion: 0.07
Nodes (24): useCrmData(), Accounts(), blankForm, dropdownStyle, industries, inp(), menuItem, statusStyle (+16 more)

### Community 7 - "TS App Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+14 more)

### Community 8 - "Auth Pages (Login/Protected)"
Cohesion: 0.12
Nodes (10): LoginPage(), ProtectedRoute(), api, AuthState, AuthUser, useAuthStore, Account, Contact (+2 more)

### Community 9 - "TS Node Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 10 - "Contacts & Leads Pages"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+14 more)

### Community 11 - "Module Registry"
Cohesion: 0.10
Nodes (21): TICKET_PRIORITIES, TICKET_STATUS_LABEL, TICKET_STATUSES, TicketAPI, useCreateTicket(), useDeleteTicket(), useTickets(), useUpdateTicket() (+13 more)

### Community 12 - "Backend Routes (Enterprise)"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule, rootDir (+5 more)

### Community 13 - "Prisma Schema & DB Models"
Cohesion: 0.17
Nodes (10): card, Dashboard(), events, fmtInr(), installData, miniData, pipelineData, recentDeals (+2 more)

### Community 14 - "Discussion & Timeline Services"
Cohesion: 0.11
Nodes (18): DEAL_STAGES, DealAPI, STAGE_LABEL, useCreateDeal(), useDeals(), useDeleteDeal(), useUpdateDeal(), useUpdateDealStage() (+10 more)

### Community 15 - "File Storage Abstraction"
Cohesion: 0.17
Nodes (11): blankForm, categoriesMeta, catIconMap, dropdownStyle, initProducts, inp(), menuItem, pieData (+3 more)

### Community 16 - "TanStack Query Hooks"
Cohesion: 0.12
Nodes (18): PROJECT_STATUSES, ProjectAPI, STATUS_LABEL, useCreateProject(), useDeleteProject(), useProjects(), useUpdateProject(), useUpdateProjectStatus() (+10 more)

### Community 17 - "Shared UI Components"
Cohesion: 0.17
Nodes (11): blankForm, initNotifications, initUsers, inp(), roles, roleStyle, Settings(), statusStyle (+3 more)

### Community 18 - "Location Autocomplete"
Cohesion: 0.20
Nodes (9): Discussion, useCreateDiscussion(), useDeleteDiscussion(), useDiscussions(), DiscussionPanel(), Props, TYPE_ICONS, TYPE_LABELS (+1 more)

### Community 19 - "Products Page"
Cohesion: 0.18
Nodes (10): name, private, scripts, build:backend, build:frontend, db:generate, db:migrate, dev:backend (+2 more)

### Community 21 - "Dashboard & Reports"
Cohesion: 0.13
Nodes (6): router, upload, fileStorage, IFileStorage, LocalFileStorage, SharePointFileStorage

### Community 22 - "Settings & Support Pages"
Cohesion: 0.25
Nodes (6): TimelineEvent, useTimeline(), EVENT_COLORS, EVENT_ICONS, Props, TimelinePanel()

### Community 23 - "Invoices Module"
Cohesion: 0.29
Nodes (7): avatarColors, blankForm, fmtAmt(), initInvoices, Invoice, Invoices(), statusStyle

### Community 25 - "Deals & Projects Pages"
Cohesion: 0.29
Nodes (6): CalendarEvent, Invoice, KanbanCard, KanbanColumn, Product, Task

### Community 26 - "Backend Middleware (RBAC)"
Cohesion: 0.40
Nodes (3): searchIndex, SearchResult, typeColor

### Community 27 - "Zod Validation Schemas"
Cohesion: 0.40
Nodes (3): Area, City, Props

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (18): INSTALL_STATUS_LABEL, INSTALL_STATUSES, InstallationAPI, useCreateInstallation(), useDeleteInstallation(), useInstallations(), useUpdateInstallation(), useUpdateInstallationStatus() (+10 more)

### Community 42 - "Community 42"
Cohesion: 0.16
Nodes (4): CalendarEvent, ICalendarProvider, LocalCalendarProvider, OutlookCalendarProvider

### Community 43 - "Community 43"
Cohesion: 0.22
Nodes (9): avatarColors, barData, initTasks, SORT_OPTS, SortKey, sortTasks(), statusStyle, Task (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (4): EmailMessage, IEmailProvider, OutlookEmailProvider, SmtpEmailProvider

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (7): avatarColors, barData, Column, initialColumns, KanbanCard, overviewStats, sparkData

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (8): 1. Backend, 2. Frontend, API Endpoints, ASPCV CRM, Pages, Prerequisites, Setup, Stack

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (6): initNotifs, Notif, titles, Topbar(), TopbarProps, typeIcon

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (3): AppLayout(), navGroups, SidebarProps

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (5): LifecycleTimeline(), Props, Stage, stageIndex(), STAGES

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (3): useIsMobile(), CalendarPage(), Kanban()

## Knowledge Gaps
- **354 isolated node(s):** `PreToolUse`, `allow`, `name`, `version`, `description` (+349 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useIsMobile()` connect `Community 51` to `Accounts & CRM Context`, `Auth Pages (Login/Protected)`, `Community 41`, `Module Registry`, `Community 43`, `Prisma Schema & DB Models`, `Discussion & Timeline Services`, `Community 47`, `Community 48`, `File Storage Abstraction`, `TanStack Query Hooks`, `Shared UI Components`, `Invoices Module`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `useCurrency()` connect `Currency Context` to `Accounts & CRM Context`, `Prisma Schema & DB Models`, `Discussion & Timeline Services`, `File Storage Abstraction`, `TanStack Query Hooks`, `Shared UI Components`, `Invoices Module`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Package Config` to `Frontend Layout & Sidebar`, `Contacts & Leads Pages`, `Existing API Endpoints`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `useIsMobile()` (e.g. with `LoginPage()` and `AppLayout()`) actually correct?**
  _`useIsMobile()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PreToolUse`, `allow`, `name` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & JWT Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07879428873611846 - nodes in this community are weakly interconnected._
- **Should `Currency Context` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._