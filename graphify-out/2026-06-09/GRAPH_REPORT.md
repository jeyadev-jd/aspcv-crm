# Graph Report - .  (2026-06-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 434 nodes · 400 edges · 74 communities (30 shown, 44 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
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
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `useIsMobile()` - 16 edges
3. `compilerOptions` - 16 edges
4. `compilerOptions` - 11 edges
5. `useCurrency()` - 10 edges
6. `scripts` - 7 edges
7. `scripts` - 7 edges
8. `scripts` - 5 edges
9. `Accounts()` - 5 edges
10. `Leads()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AppLayout()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/AppLayout.tsx → frontend/src/lib/useIsMobile.ts
- `Topbar()` --calls--> `useIsMobile()`  [INFERRED]
  frontend/src/components/layout/Topbar.tsx → frontend/src/lib/useIsMobile.ts
- `Accounts()` --calls--> `useCrmData()`  [INFERRED]
  frontend/src/pages/Accounts.tsx → frontend/src/lib/crmDataContext.tsx
- `Leads()` --calls--> `useCrmData()`  [INFERRED]
  frontend/src/pages/Leads.tsx → frontend/src/lib/crmDataContext.tsx
- `Accounts()` --calls--> `useCurrency()`  [INFERRED]
  frontend/src/pages/Accounts.tsx → frontend/src/lib/currencyContext.tsx

## Import Cycles
- None detected.

## Communities (74 total, 44 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (26): Ctx, Currency, CurrencyCtx, useCurrency(), card, cohortData, DATE_RANGES, dealsTrend (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (27): author, dependencies, cors, dotenv, express, @prisma/client, description, devDependencies (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tailwindcss, @tailwindcss/vite (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (19): AppLayout(), navGroups, SidebarProps, initNotifs, Notif, titles, Topbar(), TopbarProps (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, ignoreDeprecations, jsx, lib, module (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (21): dependencies, class-variance-authority, clsx, date-fns, @hello-pangea/dnd, lucide-react, @radix-ui/react-avatar, @radix-ui/react-checkbox (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (14): Account, Contact, CrmDataContext, CrmDataContextValue, initAccounts, initContacts, useCrmData(), avatarColors (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (13): assignees, blankForm, clients, dropdownStyle, initTickets, inp(), menuItem, priorities (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule, rootDir (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (7): prisma, router, router, router, router, router, app

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (10): card, Dashboard(), events, fmtInr(), installData, miniData, pipelineData, recentDeals (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (11): accounts, blankForm, Deal, Deals(), dropdownStyle, initDeals, inp(), menuItem (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (11): blankForm, categoriesMeta, catIconMap, dropdownStyle, initProducts, inp(), menuItem, pieData (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (11): blankForm, clients, dropdownStyle, initProjects, inp(), managers, menuItem, Project (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (11): blankForm, initNotifications, initUsers, inp(), roles, roleStyle, Settings(), statusStyle (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): name, private, scripts, build:backend, build:frontend, db:generate, db:migrate, dev:backend (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (9): blankForm, dropdownStyle, initLeads, inp(), Lead, Leads(), menuItem, productOptions (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (9): avatarColors, barData, initTasks, SORT_OPTS, SortKey, sortTasks(), statusStyle, Task (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): Accounts(), blankForm, dropdownStyle, industries, inp(), menuItem, statusStyle

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (7): avatarColors, barData, Column, initialColumns, KanbanCard, overviewStats, sparkData

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (7): avatarColors, blankForm, fmtAmt(), initInvoices, Invoice, Invoices(), statusStyle

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (6): CalendarEvent, Invoice, KanbanCard, KanbanColumn, Product, Task

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (3): searchIndex, SearchResult, typeColor

## Knowledge Gaps
- **298 isolated node(s):** `allow`, `name`, `version`, `description`, `main` (+293 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useIsMobile()` connect `Community 3` to `Community 7`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `useCurrency()` connect `Community 0` to `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `useIsMobile()` (e.g. with `AppLayout()` and `Topbar()`) actually correct?**
  _`useIsMobile()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _298 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._