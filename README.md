# ASPCV CRM

Full-stack CRM — React + Vite + TypeScript + Tailwind CSS frontend, Node.js + Express + Prisma + PostgreSQL backend.

## Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, @hello-pangea/dnd, React Router
- **Backend**: Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL

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
npm run db:seed       # optional: load demo data
npm run dev           # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

Frontend proxies `/api/*` → `http://localhost:4000`.

## Pages

| Route | Page |
|-------|------|
| `/` | Dashboard — stats, charts, latest sales |
| `/kanban` | Kanban board — drag & drop cards across columns |
| `/tasks` | Task list — filter by status, inline create |
| `/calendar` | Calendar — month/week/day view |
| `/products` | Products — list/grid view, add modal |
| `/invoices` | Invoices — list + detail modal with activities |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/products` | List / create products |
| GET/PUT/DELETE | `/api/products/:id` | Get / update / delete product |
| GET/POST | `/api/invoices` | List / create invoices |
| GET/PUT/DELETE | `/api/invoices/:id` | Get / update / delete invoice |
| GET/POST | `/api/tasks` | List / create tasks |
| PUT/DELETE | `/api/tasks/:id` | Update / delete task |
| GET/POST | `/api/kanban` | List / create kanban cards |
| PUT/DELETE | `/api/kanban/:id` | Update / delete card |
| GET/POST | `/api/calendar` | List / create events |
| PUT/DELETE | `/api/calendar/:id` | Update / delete event |
