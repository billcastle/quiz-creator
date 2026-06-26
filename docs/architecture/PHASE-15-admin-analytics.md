---
phase: 15
title: "Admin Analytics Dashboard"
status: pending
depends_on: ["PHASE-14"]
estimated_tickets: 5
---

# PHASE-15 — Admin Analytics Dashboard

## Overview

This phase implements the admin-only analytics and management dashboard, giving platform operators visibility into platform-wide metrics, user management capabilities, and questionnaire oversight. The admin dashboard is a protected section of the application accessible only to users with the `admin` role, enforced at both the route level (frontend redirect) and API level (middleware check).

Admin capabilities cover three areas: platform analytics (growth metrics, usage trends, content distribution), user management (view all users, assign roles, suspend accounts), and questionnaire management (view all questionnaires regardless of creator, archive content, mark featured). These tools give operators the control needed to maintain platform quality and respond to abuse.

The Better-auth admin plugin handles role management. Platform analytics are computed on-demand from the existing database tables, consistent with the approach established in PHASE-14. Charts reuse the Recharts wrapper components built in that phase.

## Goals

- [ ] Implement `/admin` layout with admin navigation sidebar and access control guard
- [ ] Implement Overview Stats page: total users, questionnaires, responses, daily active users
- [ ] Implement User Management page at `/admin/users`: searchable user list with role/suspend actions
- [ ] Implement Questionnaire Management page at `/admin/questionnaires`: all questionnaires with archive/feature actions
- [ ] Implement Platform Analytics page: top questionnaires, top users, response trends chart, type/category distribution charts
- [ ] Implement all admin API endpoints with admin-role middleware enforcement
- [ ] Integrate Better-auth admin plugin for role assignment endpoints

## Architecture Decisions Required

**ADR-019: Admin route protection strategy** — Define how admin access is enforced at the frontend route level (check session role in route loader → redirect) and API level (Hono middleware reads session, checks `user.role === 'admin'`). Document that both layers are required.

**ADR-020: Admin role assignment workflow** — Define how the first admin user is created (manual SQL seed or environment variable bootstrap) and how subsequent admin assignments are made (via admin panel UI → Better-auth admin plugin endpoint). Document that self-service role elevation is impossible.

**STANDARD-admin-api-contracts:** Define the standard shape of all admin list endpoints including pagination, filter, and sort parameters consistent with STANDARD-api-pagination from PHASE-13.

## Technical Architecture

### Route Structure

```
/admin                           → redirect to /admin/overview
/admin/overview                  → platform stats
/admin/users                     → user management
/admin/questionnaires            → questionnaire management
/admin/analytics                 → platform analytics charts
```

TanStack Router files:
```
apps/web/src/routes/
  admin/
    _layout.tsx          ← admin layout + route guard
    overview.tsx
    users.tsx
    questionnaires.tsx
    analytics.tsx
```

Route guard implementation in `_layout.tsx`:
```typescript
// In loader:
const session = await getSession();
if (!session || session.user.role !== 'admin') {
  throw redirect({ to: '/' });
}
```

The `_layout.tsx` provides the admin navigation sidebar and wraps all admin child routes. The guard runs once in the layout loader and is inherited by all child routes.

### Admin Middleware (Hono)

All admin API routes are protected by a Hono middleware:

```typescript
// apps/api/src/middleware/admin.ts
export const requireAdmin = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.role !== 'admin') {
    return c.json({ error: 'Forbidden', code: 'NOT_ADMIN' }, 403);
  }
  c.set('adminUser', session.user);
  await next();
};
```

All `/api/admin/*` routes are registered under a Hono group with this middleware applied.

### Better-Auth Admin Plugin

The Better-auth admin plugin provides role management endpoints out of the box. Configure in `apps/api/src/lib/auth.ts`:

```typescript
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),
  ],
});
```

This adds endpoints:
- `POST /api/auth/admin/set-role` — set a user's role (admin only)
- `POST /api/auth/admin/ban-user` — ban a user (admin only)
- `POST /api/auth/admin/unban-user` — unban a user (admin only)

The frontend admin user management UI calls these endpoints through Better-auth's client SDK.

### API Endpoints

**`GET /api/admin/stats`** — Admin only

Response:
```typescript
{
  users: {
    total: number;
    last30Days: number;
    growthPercentage: number;    // compared to prior 30-day period
  };
  questionnaires: {
    published: number;
    draft: number;
    archived: number;
    total: number;
  };
  responses: {
    total: number;
    last30Days: number;
  };
  dau: {
    // daily active users = unique respondentIds per day, last 30 days
    data: Array<{ date: string; count: number }>;
    avgLast30Days: number;
  };
}
```

**`GET /api/admin/users`** — Admin only

Query params: `q` (search by username/email), `role` (user | admin | all), `status` (active | suspended | all), `page`, `limit`, `sort` (joined_desc | username_asc | questionnaires_desc)

Response (paginated):
```typescript
{
  data: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    status: "active" | "banned";
    questionnaireCount: number;
    responseCount: number;         // responses to their questionnaires
    joinedAt: string;
    lastSeenAt: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

**`PATCH /api/admin/users/:id`** — Admin only

Request body (any combination):
```typescript
{
  role?: "user" | "admin";
  status?: "active" | "banned";
}
```

Delegates role changes to Better-auth admin plugin endpoints internally.

**`GET /api/admin/questionnaires`** — Admin only

Query params: `q` (search by title), `type`, `status` (published | draft | archived | all), `page`, `limit`

Response (paginated):
```typescript
{
  data: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    creator: { username: string; id: string };
    responseCount: number;
    featured: boolean;
    createdAt: string;
    publishedAt: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

**`PATCH /api/admin/questionnaires/:id`** — Admin only

Request body:
```typescript
{
  status?: "published" | "archived";
  featured?: boolean;
}
```

**`GET /api/admin/analytics`** — Admin only

Response:
```typescript
{
  topQuestionnaires: Array<{
    id: string;
    title: string;
    type: string;
    creator: string;
    responseCount: number;
  }>;  // top 10 by response count
  topCreators: Array<{
    username: string;
    questionnaireCount: number;
    totalResponses: number;
  }>;  // top 10 by questionnaires created
  responseTrend: Array<{
    date: string;
    count: number;
  }>;  // last 30 days
  typeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
}
```

### Frontend: Admin Layout

`apps/web/src/routes/admin/_layout.tsx`

Layout structure:
- Fixed left sidebar (220px): "Admin" heading, navigation links (Overview, Users, Questionnaires, Analytics), "Back to site" link at bottom
- Main content area with page-level heading and content

Admin navigation links:
- Overview → `/admin/overview`
- Users → `/admin/users`
- Questionnaires → `/admin/questionnaires`
- Analytics → `/admin/analytics`

Sidebar uses the same shadcn navigation patterns from the main app sidebar (established in PHASE-13).

### Frontend: Overview Stats Page

4 large stat cards in a 2×2 grid:
- Total Users (with "+N in last 30 days" subtitle)
- Total Questionnaires (with "published / draft / archived" breakdown)
- Total Responses (with "last 30 days" number)
- Avg Daily Active Users (last 30 days)

Below the cards: DAU trend chart (reuse `TimelineChart` from PHASE-14, data from `dau.data`).

### Frontend: User Management Page

`AdminUserTable` component:
- Search input (filters by username or email)
- Role filter tabs: All / Users / Admins
- Status filter: Active / Suspended
- Data table with columns: Avatar+Username, Email, Role badge, Status badge, Questionnaires, Responses, Joined, Actions
- Actions per row (dropdown menu):
  - View profile (→ `/profile/:username`)
  - Make admin / Remove admin (toggles role)
  - Suspend / Unsuspend

Role and status badges:
- Admin role: blue badge
- User role: gray badge (no badge)
- Suspended: red badge

Confirmation dialogs required for: making admin, removing admin, suspending user.

### Frontend: Questionnaire Management Page

`AdminQuestionnaireTable` component:
- Search input (filters by title)
- Type filter tabs: All / Quiz / Survey / Exam
- Status filter: All / Published / Draft / Archived
- Data table: Title, Type badge, Status badge, Creator link, Responses, Featured toggle, Created, Actions
- Actions per row:
  - View questionnaire (→ `/q/:shareToken`)
  - Archive / Unarchive
  - Mark as Featured / Remove Featured (toggle)

Featured toggle: an inline switch in the table row for quick toggling. Changes call `PATCH /api/admin/questionnaires/:id` immediately.

### Frontend: Platform Analytics Page

Four chart sections:
1. Response Trend (full-width): `TimelineChart` reused from PHASE-14, 30-day data
2. Top Questionnaires (left half): horizontal bar chart of top 10 by responses (reuse `DistributionChart`)
3. Questionnaire Type Distribution (right half): donut/pie chart (Recharts `PieChart`)
4. Category Distribution (right half below): donut/pie chart

New chart component needed: `DonutChart.tsx` wrapping Recharts `PieChart` with `innerRadius` set for donut style.

## Monorepo Touch Points

**packages/ui:**
- New: `AdminNavSidebar` component
- New: `DataTable` component (sortable, with action menus) — this is a significant reusable component
- New: `DonutChart` component (Recharts PieChart wrapper)
- New: `StatusBadge` component (colored badge for role/status display)
- Reuse: `StatCard`, `TimelineChart`, `DistributionChart` from PHASE-14

**packages/shared:**
- New: `AdminStats`, `AdminUser`, `AdminQuestionnaire`, `AdminAnalytics` Zod schemas
- New: `AdminUserUpdatePayload`, `AdminQuestionnaireUpdatePayload` schemas

**apps/api:**
- Add Better-auth admin plugin configuration in `apps/api/src/lib/auth.ts`
- New: `apps/api/src/middleware/admin.ts`
- New: `apps/api/src/routes/admin.ts` (all admin routes grouped)
- New: `apps/api/src/services/admin.service.ts`

**apps/web:**
- New: `routes/admin/_layout.tsx`
- New: `routes/admin/overview.tsx`
- New: `routes/admin/users.tsx`
- New: `routes/admin/questionnaires.tsx`
- New: `routes/admin/analytics.tsx`
- New: `features/admin/` directory

## Directory Structure

```
apps/web/src/
  routes/
    admin/
      _layout.tsx
      overview.tsx
      users.tsx
      questionnaires.tsx
      analytics.tsx
  features/
    admin/
      AdminOverview.tsx
      AdminUserTable.tsx
      AdminQuestionnaireTable.tsx
      AdminAnalyticsPage.tsx

packages/ui/src/
  components/
    data-table/
      DataTable.tsx
      DataTable.stories.tsx
    donut-chart/
      DonutChart.tsx
    status-badge/
      StatusBadge.tsx
    admin-nav-sidebar/
      AdminNavSidebar.tsx

packages/shared/src/
  schemas/
    admin.ts             ← all admin API schemas

apps/api/src/
  middleware/
    admin.ts             ← requireAdmin middleware
  routes/
    admin.ts             ← all /api/admin/* routes
  services/
    admin.service.ts     ← admin query logic
```

## Implementation Steps

1. **Configure Better-auth admin plugin**
   - Add admin plugin to `apps/api/src/lib/auth.ts` with `defaultRole: "user"`, `adminRole: "admin"`
   - Verify plugin adds `role` column to users table via Better-auth migration
   - Document first admin creation process (manual SQL update to `user.role = 'admin'` in D1)

2. **Implement admin middleware**
   - Create `apps/api/src/middleware/admin.ts` with `requireAdmin` middleware function
   - Apply to all `/api/admin/*` routes via Hono route grouping

3. **Define admin Zod schemas in packages/shared**
   - Add `AdminStats`, `AdminUser`, `AdminQuestionnaire`, `AdminAnalytics` schemas
   - Add `AdminUserUpdatePayload`, `AdminQuestionnaireUpdatePayload` schemas
   - Export from `packages/shared/src/index.ts`

4. **Implement admin service and API routes**
   - Create `apps/api/src/services/admin.service.ts` with all query functions
   - Implement stats aggregation (users, questionnaires, responses, DAU)
   - Implement user list with search, role/status filters, pagination
   - Implement questionnaire list with search, type/status filters, pagination
   - Implement analytics aggregations (top questionnaires, top creators, distributions)
   - Create `apps/api/src/routes/admin.ts` wiring all routes with `requireAdmin` middleware

5. **Build DataTable component**
   - Create `packages/ui/src/components/data-table/DataTable.tsx`
   - Generic columns definition (column key, header, render function)
   - Sortable column headers
   - Row actions slot (accepts `ReactNode` per row)
   - Loading skeleton state
   - Empty state slot

6. **Build DonutChart and StatusBadge components**
   - `DonutChart`: Recharts PieChart wrapper with inner radius, legend, tooltip
   - `StatusBadge`: color-coded badge for role (admin=blue, user=gray) and status (active=green, banned=red)

7. **Implement admin layout and route guard**
   - Create `apps/web/src/routes/admin/_layout.tsx`
   - Route loader: check session role, redirect to `/` if not admin
   - Admin nav sidebar with links to all admin sections

8. **Implement admin overview page**
   - Create `apps/web/src/routes/admin/overview.tsx`
   - 4 stat cards from `GET /api/admin/stats`
   - DAU trend `TimelineChart`

9. **Implement admin user management page**
   - Create `apps/web/src/routes/admin/users.tsx`
   - Search + filter controls
   - `AdminUserTable` with all columns, role/status badges, action menus
   - Confirmation dialogs for role change and suspend actions
   - Mutations calling Better-auth admin plugin endpoints

10. **Implement admin questionnaire management page**
    - Create `apps/web/src/routes/admin/questionnaires.tsx`
    - Search + filter controls
    - `AdminQuestionnaireTable` with inline featured toggle and action menu
    - Archive confirmation dialog

11. **Implement admin analytics page**
    - Create `apps/web/src/routes/admin/analytics.tsx`
    - Response trend chart (TimelineChart)
    - Top questionnaires chart (DistributionChart horizontal)
    - Type distribution donut (DonutChart)
    - Category distribution donut (DonutChart)

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1500 | Configure Better-auth admin plugin and document first admin creation | chore | Sage | P0 |
| QZ-1501 | Implement admin middleware and define admin Zod schemas | chore | Sage | P0 |
| QZ-1502 | Implement admin service and all admin API routes | feature | Sage | P0 |
| QZ-1503 | Build DataTable, DonutChart, StatusBadge UI components | feature | Milo | P0 |
| QZ-1504 | Implement admin layout, route guard, and navigation sidebar | feature | Nova | P0 |
| QZ-1505 | Implement admin overview page with stats cards and DAU chart | feature | Nova | P1 |
| QZ-1506 | Implement admin user management page with role/suspend actions | feature | Nova | P0 |
| QZ-1507 | Implement admin questionnaire management page with archive/feature actions | feature | Nova | P1 |
| QZ-1508 | Implement admin platform analytics page with distribution charts | feature | Nova | P2 |

## Acceptance Criteria

- [ ] Visiting `/admin` without auth redirects to `/`
- [ ] Visiting `/admin` with a non-admin user redirects to `/`
- [ ] Admin users see the admin navigation sidebar with all section links
- [ ] Overview page displays correct user count, questionnaire count, and response count
- [ ] User management table shows all users with searchable username/email
- [ ] Assigning admin role to a user updates their role and shows blue badge
- [ ] Suspending a user calls the Better-auth ban endpoint and shows red badge
- [ ] All admin API endpoints return 403 for non-admin authenticated users
- [ ] All admin API endpoints return 401 for unauthenticated requests
- [ ] Questionnaire management table shows all questionnaires (including other creators')
- [ ] Featured toggle for a questionnaire updates the `featured` field immediately
- [ ] Archiving a questionnaire changes its status to `archived` (not visible in public feed)
- [ ] Platform analytics page shows response trend, type distribution, and category distribution charts
- [ ] Top 10 questionnaires list is sorted by response count (descending)

## Out of Scope

- Admin content moderation with specific reason codes — simple archive action only for v1
- Audit log of admin actions — not in v1
- Admin email notifications — not in v1
- Bulk user operations (bulk suspend, bulk delete) — not in v1
- Admin impersonation (log in as another user) — not in v1
- Platform-wide announcements or messages — not in v1

## Phase Dependencies

- **PHASE-14 (User Profile & Analytics) must be complete** because the admin dashboard reuses `StatCard`, `TimelineChart`, and `DistributionChart` components, and the admin service queries the same tables as creator analytics
- **PHASE-04 (Authentication) must be complete** because the Better-auth admin plugin extends the auth configuration established in that phase

## Agent Assignments

- **Architect:** Write ADR-019 (admin route protection), ADR-020 (admin role assignment workflow), STANDARD-admin-api-contracts
- **Dev/Sage (Backend):** QZ-1500, QZ-1501, QZ-1502 — Better-auth admin plugin, middleware, and all API routes
- **Dev/Nova (Frontend):** QZ-1504, QZ-1505, QZ-1506, QZ-1507, QZ-1508 — all admin page implementations
- **Dev/Milo (Visual/CSS):** QZ-1503 — DataTable, DonutChart, StatusBadge components
- **QA/Ivy:** Test admin access control thoroughly (unauthenticated, wrong role, correct role), verify all CRUD actions in admin panel, verify charts display correct data
- **DevOps/Axel:** Provide procedure for setting first admin user in production D1 via wrangler CLI
- **Remy (Producer):** Confirm admin UX requirements, document admin onboarding process for ops team

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Admin role accidentally assigned to wrong user | Low | High | Require confirmation dialog for all role changes; log role changes with admin userId in app-level audit (console.log to Worker logs for v1) |
| Admin middleware bypass via direct D1 queries | Low | High | Admin middleware must read session from Better-auth, not from request header directly; never trust client-provided role claim |
| DAU calculation is slow (scanning all responses for unique respondentIds) | Medium | Medium | Add index on responses(respondentId, submittedAt); consider caching DAU data with 1-hour KV TTL |
| DataTable component complexity causes over-engineering | Medium | Low | Keep DataTable scope minimal for v1 — no virtualization, no column resizing; add only what admin pages need |

## Estimated Effort

L
