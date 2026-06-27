# ASPCV CRM

Full-stack CRM for Aspiration Cleantech Ventures — covers the full customer lifecycle from lead to deal, project, installation, support, plus HR/payroll/attendance, inventory, material requests, invoicing, and role-based access control.

React + Vite + TypeScript + Tailwind CSS frontend, Node.js + Express + Prisma + PostgreSQL backend, JWT auth with dynamic RBAC.

## Screenshots

| Dashboard | Leads |
|---|---|
| ![Dashboard](screenshots/dashboard.png) | ![Leads](screenshots/leads.png) |

| Deals | Projects |
|---|---|
| ![Deals](screenshots/deals.png) | ![Projects](screenshots/projects.png) |

| Invoices | Inventory |
|---|---|
| ![Invoices](screenshots/invoices.png) | ![Inventory](screenshots/inventory.png) |

| HR |
|---|
| ![HR](screenshots/hr.png) |

## Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, @hello-pangea/dnd, React Router, TanStack Query, Zustand, @react-pdf/renderer
- **Backend**: Node.js, Express 5, TypeScript, Prisma, PostgreSQL, JWT auth, Zod validation

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (default: `localhost:5432`)

### 1. Backend

```bash
cd backend

# Set DB URL in .env
# DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/aspcv_crm?schema=public"

npm install
npm run db:generate
npm run db:migrate    # creates DB tables (requires running Postgres)
npm run db:seed       # optional: load demo data + default users
npm run dev           # starts on http://localhost:4000
```

Default seeded logins: `admin@aspcv.com` / `admin123` (SuperAdmin), `james@aspcv.com` / `sales123` (Manager).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

Frontend proxies `/api/*` → `http://localhost:4000`.

## Modules / Pages

| Area | Routes |
|------|--------|
| Sales | `/leads`, `/accounts`, `/contacts`, `/deals`, `/dealers` |
| Catalog & Delivery | `/products`, `/projects`, `/tasks`, `/kanban`, `/calendar` |
| HR | `/hr`, `/attendance`, `/payroll`, `/profile` |
| Warehouse | `/material-requests`, `/inventory`, `/raw-components` |
| Finance | `/invoices`, `/financials` |
| Support | `/support` |
| Admin | `/reports`, `/settings`, `/roles`, `/users`, `/approvals` |

Each customer-facing entity (lead/deal/project/installation/support) shares reusable Discussion and Timeline panels keyed by `entityType` + `entityId`.

## RBAC

Permissions are dynamic and DB-backed — roles and their per-module permissions are managed at `/roles`, enforced server-side via `requirePermission(resource, action)` middleware on every route, and mirrored in the frontend nav/sidebar.

## Repo layout

```
backend/    Express + Prisma API (src/routes, src/middleware, prisma/schema.prisma)
frontend/   React + Vite SPA (src/pages, src/components, src/hooks)
```
