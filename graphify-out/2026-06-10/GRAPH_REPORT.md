# Graph Report - .  (2026-06-09)

## Corpus Check
- Large corpus: 147 files · ~1,535,221 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 550 nodes · 632 edges · 41 communities (30 shown, 11 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.74)
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `useIsMobile()` - 16 edges
3. `compilerOptions` - 16 edges
4. `compilerOptions` - 11 edges
5. `authenticate()` - 10 edges
6. `useCurrency()` - 10 edges
7. `scripts` - 7 edges
8. `AuthRequest` - 7 edges
9. `LocalFileStorage` - 7 edges
10. `scripts` - 7 edges

## Surprising Connections (you probably didn't know these)
- `AppLayout()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/useIsMobile.ts
- `Topbar()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/Topbar.tsx → frontend/src/lib/useIsMobile.ts
- `Accounts()` --calls--> `useCurrency()`  [INFERRED]
  frontend/src/pages/Accounts.tsx → frontend/src/lib/currencyContext.tsx
- `Dashboard()` --calls--> `useCurrency()`  [INFERRED]
  frontend/src/pages/Dashboard.tsx → frontend/src/lib/currencyContext.tsx
- `Deals()` --calls--> `useCurrency()`  [INFERRED]
  frontend/src/pages/Deals.tsx → frontend/src/lib/currencyContext.tsx

## Import Cycles
- None detected.

## Communities (41 total, 11 thin omitted)

### Community 0 - "Auth & JWT Core"
Cohesion: 0.08
Nodes (31): signToken(), verifyToken(), prisma, companySchema, contactSchema, discussionSchema, leadSchema, loginSchema (+23 more)

### Community 1 - "Frontend Layout & Sidebar"
Cohesion: 0.05
Nodes (37): recharts, AppLayout(), navGroups, SidebarProps, initNotifs, Notif, titles, Topbar() (+29 more)

### Community 2 - "Currency Context"
Cohesion: 0.06
Nodes (26): Ctx, Currency, CurrencyCtx, useCurrency(), card, cohortData, DATE_RANGES, dealsTrend (+18 more)

### Community 3 - "Existing API Endpoints"
Cohesion: 0.08
Nodes (34): Calendar API, Invoices API, Kanban API, Products API, Tasks API, ASPCV CRM, aspcv-logo.png, Backend (+26 more)

### Community 4 - "Backend Package Config"
Cohesion: 0.06
Nodes (33): author, dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, multer (+25 more)

### Community 5 - "Frontend Package Config"
Cohesion: 0.06
Nodes (31): dependencies, axios, class-variance-authority, clsx, date-fns, lucide-react, @radix-ui/react-avatar, @radix-ui/react-checkbox (+23 more)

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
Cohesion: 0.12
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+7 more)

### Community 11 - "Module Registry"
Cohesion: 0.14
Nodes (13): assignees, blankForm, clients, dropdownStyle, initTickets, inp(), menuItem, priorities (+5 more)

### Community 12 - "Backend Routes (Enterprise)"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule, rootDir (+5 more)

### Community 13 - "Prisma Schema & DB Models"
Cohesion: 0.17
Nodes (10): card, Dashboard(), events, fmtInr(), installData, miniData, pipelineData, recentDeals (+2 more)

### Community 14 - "Discussion & Timeline Services"
Cohesion: 0.17
Nodes (11): accounts, blankForm, Deal, Deals(), dropdownStyle, initDeals, inp(), menuItem (+3 more)

### Community 15 - "File Storage Abstraction"
Cohesion: 0.17
Nodes (11): blankForm, categoriesMeta, catIconMap, dropdownStyle, initProducts, inp(), menuItem, pieData (+3 more)

### Community 16 - "TanStack Query Hooks"
Cohesion: 0.17
Nodes (11): blankForm, clients, dropdownStyle, initProjects, inp(), managers, menuItem, Project (+3 more)

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
Cohesion: 0.25
Nodes (3): fileStorage, IFileStorage, LocalFileStorage

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

## Knowledge Gaps
- **317 isolated node(s):** `allow`, `name`, `version`, `description`, `main` (+312 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useIsMobile()` connect `Frontend Layout & Sidebar` to `Accounts & CRM Context`, `Module Registry`, `Prisma Schema & DB Models`, `Discussion & Timeline Services`, `File Storage Abstraction`, `TanStack Query Hooks`, `Shared UI Components`, `Invoices Module`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `useCurrency()` connect `Currency Context` to `Accounts & CRM Context`, `Prisma Schema & DB Models`, `Discussion & Timeline Services`, `File Storage Abstraction`, `TanStack Query Hooks`, `Shared UI Components`, `Invoices Module`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `typescript` connect `Existing API Endpoints` to `Backend Package Config`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `useIsMobile()` (e.g. with `AppLayout()` and `Topbar()`) actually correct?**
  _`useIsMobile()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _317 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & JWT Core` be split into smaller, more focused modules?**
  _Cohesion score 0.08127721335268505 - nodes in this community are weakly interconnected._
- **Should `Frontend Layout & Sidebar` be split into smaller, more focused modules?**
  _Cohesion score 0.04734299516908213 - nodes in this community are weakly interconnected._