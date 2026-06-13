# Dynamic RBAC + Approval-Gated Mutations — Design Spec
**Date:** 2026-06-12  
**Status:** Approved by user

---

## Problem

1. All 26 non-user routes unprotected (authenticate only, no role check)
2. Roles hardcoded as Prisma enum — cannot rename, create, or delete roles at runtime
3. No per-user permission overrides (user X gets extra access beyond their role)
4. No approval workflow for edit/delete actions
5. HR creates users → no admin approval gate
6. No admin UI to manage permissions dynamically

---

## Solution: Dynamic Permission Engine

Move from static `requireRole('SuperAdmin','HR')` strings to a **DB-backed permission table** checked at runtime. Admin UI controls everything — no code deploy needed to change who can do what.

---

## Architecture

### Core Concepts

```
RoleDefinition (DB) ──has──▶ RolePermission[] (DB)
       ▲                          │ resource + action + allowed
       │                          ▼
     User ──has──▶ UserPermissionOverride[] (DB)  ← trumps role
       │
       └──▶ role: String (matches RoleDefinition.name)
```

**Resolution order:** UserPermissionOverride → RolePermission → deny

### Resources + Actions

| Resource | Actions |
|----------|---------|
| `lead` | `create`, `read_own`, `read_all`, `edit`, `delete` |
| `deal` | `create`, `read_own`, `read_all`, `edit`, `delete` |
| `contact` | `create`, `read_own`, `read_all`, `edit`, `delete` |
| `company` | `create`, `read_all`, `edit`, `delete` |
| `project` | `create`, `read_all`, `edit`, `delete` |
| `material_request` | `create`, `read_own`, `read_all`, `approve_manager`, `approve_bizhead`, `approve_accountant`, `reject` |
| `inventory` | `create`, `read_all`, `edit`, `assign` |
| `attendance` | `checkin`, `read_own`, `read_all` |
| `salary` | `generate`, `approve`, `mark_paid`, `read_own`, `read_all` |
| `hr_user` | `create`, `read_all`, `edit`, `deactivate` |
| `financials` | `create`, `read_all`, `edit`, `delete` |
| `task` | `create`, `read_own`, `read_all`, `edit`, `delete` |
| `discussion` | `create`, `read_all`, `edit_own`, `delete_own` |
| `approval_request` | `create`, `review` |
| `role_admin` | `manage` | ← only SuperAdmin system role |

---

## New Prisma Models

### 1. RoleDefinition (replaces Role enum)
```prisma
model RoleDefinition {
  id          String   @id @default(cuid())
  name        String   @unique   // 'SuperAdmin', 'SalesRepresentative', etc.
  displayName String             // admin-editable label shown in UI
  isSystem    Boolean  @default(false)  // system roles cannot be deleted
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(99)
  permissions RolePermission[]
  users       User[]   @relation("UserRole")
  createdAt   DateTime @default(now())
}
```

### 2. RolePermission
```prisma
model RolePermission {
  id               String         @id @default(cuid())
  roleDefinitionId String
  roleDefinition   RoleDefinition @relation(fields: [roleDefinitionId], references: [id], onDelete: Cascade)
  resource         String         // 'lead', 'deal', etc.
  action           String         // 'create', 'read_all', etc.
  allowed          Boolean        @default(true)
  @@unique([roleDefinitionId, resource, action])
}
```

### 3. UserPermissionOverride
```prisma
model UserPermissionOverride {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resource  String
  action    String
  allowed   Boolean  // true = grant beyond role, false = restrict below role
  grantedById String
  grantedBy User     @relation("GrantedBy", fields: [grantedById], references: [id])
  reason    String?
  createdAt DateTime @default(now())
  @@unique([userId, resource, action])
}
```

### 4. ApprovalRequest
```prisma
model ApprovalRequest {
  id             String   @id @default(cuid())
  requestedById  String
  requestedBy    User     @relation("ARRequested", fields: [requestedById], references: [id])
  entityType     String   // 'lead' | 'deal' | 'contact' | etc.
  entityId       String
  action         String   // 'edit' | 'delete' | 'user_create'
  payload        Json?    // edit payload so admin sees what changes
  status         String   @default("pending") // pending | approved | rejected | used | expired
  reviewedById   String?
  reviewedBy     User?    @relation("ARReviewed", fields: [reviewedById], references: [id])
  reviewedAt     DateTime?
  expiresAt      DateTime?   // now + 30min on approval
  reason         String?
  rejectReason   String?
  createdAt      DateTime @default(now())
}
```

### 5. User model changes
```prisma
// REMOVE: role Role (enum)
// ADD:
roleId     String?
roleDef    RoleDefinition? @relation("UserRole", fields: [roleId], references: [id])
roleName   String   // keep as denormalized string for fast JWT checks ('SuperAdmin' etc.)
createdById String?  // for own-data scoping on leads/deals/contacts
```

---

## Backend Changes

### 1. Permission Resolution Middleware (`middleware/permissions.ts`)
```typescript
// Replaces requireRole()
export function requirePermission(resource: string, action: string) {
  return async (req: AuthRequest, res, next) => {
    const allowed = await resolvePermission(req.user.id, req.user.roleName, resource, action)
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' })
    next()
  }
}

async function resolvePermission(userId, roleName, resource, action): Promise<boolean> {
  // 1. Check UserPermissionOverride first
  const override = await prisma.userPermissionOverride.findUnique({
    where: { userId_resource_action: { userId, resource, action } }
  })
  if (override) return override.allowed

  // 2. Fall back to RolePermission
  const rolePerm = await prisma.rolePermission.findFirst({
    where: { roleDefinition: { name: roleName }, resource, action }
  })
  return rolePerm?.allowed ?? false
}
```

Cache permission results per request in-memory (Redis optional later).

### 2. Own-data scoping helper (`middleware/scoping.ts`)
```typescript
export async function getScopeFilter(userId: string, roleName: string, resource: string) {
  const canReadAll = await resolvePermission(userId, roleName, resource, 'read_all')
  if (canReadAll) return {}  // no filter
  return { createdById: userId }  // own only
}
```

### 3. All 27 route files — swap `requireRole` → `requirePermission`
Each route gets `requirePermission('resource', 'action')` per matrix.

### 4. Approval check in PATCH/DELETE handlers
```typescript
// Before executing edit/delete:
if (roleName !== 'SuperAdmin') {
  const approval = await prisma.approvalRequest.findFirst({
    where: { requestedById: userId, entityType, entityId, action: 'edit',
             status: 'approved', expiresAt: { gt: new Date() } }
  })
  if (!approval) return res.status(403).json({ error: 'approval_required' })
  await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: 'used' } })
}
```

### 5. New route files
- `routes/role-definitions.ts` — CRUD roles, manage permissions per role
- `routes/user-permissions.ts` — CRUD user-level overrides
- `routes/approval-requests.ts` — create, list, approve/reject

### 6. HR user creation → approval gate
```typescript
// POST /api/users (HR role)
// Instead of creating directly:
await prisma.approvalRequest.create({
  data: { requestedById: req.user.id, entityType: 'hr_user', entityId: 'pending',
          action: 'user_create', payload: req.body, status: 'pending' }
})
res.status(202).json({ message: 'User creation pending SuperAdmin approval' })

// POST /api/approval-requests/:id/approve (SuperAdmin)
// If entityType === 'hr_user' && action === 'user_create':
//   create the user from approval.payload
```

---

## Seed Data (RoleDefinitions + default permissions)

On `prisma db seed`, create 12 RoleDefinitions with their default RolePermissions matching the matrix below:

### Default Permission Matrix (seeded)

| Role | lead | deal | contact | project | MR | attendance | salary | hr_user | financials |
|------|------|------|---------|---------|-----|-----------|--------|---------|-----------|
| SuperAdmin | all | all | all | all | all | all | all | all | all |
| BusinessHead | read_all | read_all | read_all | read_all | read_all,approve_bizhead | read_all | read_all | read_all | read_all |
| ProjectHead | — | — | read_all | read_all,edit,create | read_all,approve_manager | read_all | read_own | — | — |
| SalesHead | read_all | read_all,create | read_all | — | — | read_own | read_own | — | — |
| Manager | read_all,create,edit* | read_all,create,edit* | read_all,create | read_all,create,edit* | create,read_all,approve_manager | read_all | read_own | — | — |
| SeniorEngineer | — | — | — | read_all | create,read_own | read_own,checkin | read_own | — | — |
| Engineer | — | — | — | read_all | create,read_own | read_own,checkin | read_own | — | — |
| Technician | — | — | — | read_all | create,read_own | read_own,checkin | read_own | — | — |
| Accountant | — | — | — | — | read_all,approve_accountant | — | read_own | — | read_all,create |
| HR | — | — | — | — | — | read_all | read_all,generate,approve,mark_paid | create,read_all,edit* | — |
| **SalesRepresentative** | read_own,create | read_own,create | read_own,create | — | — | read_own,checkin | read_own | — | — |
| Viewer | read_all | read_all | read_all | read_all | read_all | — | — | — | — |

*edit = approval-gated on backend

---

## Frontend Changes

### 1. Permission hook (`hooks/usePermission.ts`)
```typescript
// Calls GET /api/auth/my-permissions → returns flat map
// Cached in memory for session
export function usePermission(resource: string, action: string): boolean
export function usePermissions(): PermissionMap
```

### 2. `GET /api/auth/my-permissions`
Returns flat object: `{ 'lead:create': true, 'lead:read_all': false, ... }`  
Computed server-side with full override resolution. Cached 5min.

### 3. Smart permission components
```tsx
<Can do="edit" on="lead" fallback={<RequestEditButton />}>
  <button onClick={openModal}>Edit</button>
</Can>
```

### 4. Sidebar — nav filtered by permissions
```typescript
// Show nav item only if user has read_all or read_own for that resource
const showLeads = usePermission('lead', 'read_own') || usePermission('lead', 'read_all')
```

### 5. Admin pages (SuperAdmin only)
- `/admin/roles` — list roles, create/rename/delete custom roles
- `/admin/roles/:id/permissions` — toggle permission matrix for that role (grid of resource × action checkboxes)
- `/admin/users/:id/permissions` — user-level overrides (add/remove per user)
- `/admin/approvals` — pending approval requests (badge count in sidebar)

### 6. SalesRepresentative scoping (client-side filter)
Leads/Deals/Contacts pages filter `items.filter(i => i.createdById === user.id)` as secondary guard (backend is primary).

---

## Migration Plan

1. Create `RoleDefinition` + `RolePermission` + `UserPermissionOverride` + `ApprovalRequest` tables
2. Add `roleName String` + `roleDef RoleDefinition?` + `createdById String?` to User
3. Remove `Role` enum — change `User.role` to `User.roleName String`
4. SQL: `UPDATE "User" SET "roleName" = role::text` (copy enum → string)
5. Seed 12 RoleDefinitions + all default RolePermissions
6. Backfill: `UPDATE "Lead" SET "createdById" = (SELECT id FROM "User" WHERE role='SuperAdmin' LIMIT 1)` etc.
7. Swap all `requireRole()` calls → `requirePermission()` across 27 routes
8. Add approval checks to all PATCH/DELETE handlers
9. Build frontend admin pages + permission hook

---

## Out of Scope (Future)
- Field-level visibility (hide salary field from SalesRep in contact view)
- Permission inheritance (role B inherits from role A)
- Time-based permissions (role active only 9am–6pm)
- Multi-SuperAdmin approval chains

---

## Success Criteria
- SuperAdmin: edit/delete anything directly, no approval prompt
- Manager: click Edit on deal → "Request Edit" → admin approves → 30min window
- SalesRepresentative: sees only own leads/deals/contacts; create works; edit blocked
- HR: creates user → pending approval → SuperAdmin approves → user created
- Admin toggles `lead:edit` OFF for Manager role → Manager immediately loses edit request option (no deploy)
- Admin creates custom role "RegionalManager" → assigns permissions → assigns to user → works
- All 27 routes return 403 for unauthorized resource+action
- `tsc` clean, no console errors
