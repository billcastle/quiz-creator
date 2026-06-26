---
phase: 14
title: "User Profile & Analytics"
status: pending
depends_on: ["PHASE-11", "PHASE-12", "PHASE-13"]
estimated_tickets: 6
---

# PHASE-14 — User Profile & Analytics

## Overview

This phase builds the creator-facing profile and analytics surfaces. Every registered user has a public profile page showing their published questionnaires and aggregate stats. Authenticated creators additionally have access to a private analytics dashboard showing performance metrics for their questionnaires: response counts, completion rates, average scores, and per-question answer distributions.

The user profile serves a dual purpose: a public showcase of a creator's questionnaires (comparable to a GitHub profile for quizzes) and a personal management hub when viewing your own profile. The analytics dashboard gives creators the data they need to understand how their questionnaires are performing — which questions are being answered well, where respondents drop off, and how engagement changes over time.

Charts are built with Recharts (added to `packages/ui` dependencies) for lightweight, composable charting that integrates cleanly with React. All analytics data is computed server-side from the existing responses/answers tables; no separate analytics event store is introduced in v1.

## Goals

- [ ] Implement public user profile page at `/profile/:username`: avatar, bio, questionnaire list, stats
- [ ] Implement profile edit for own profile: avatar upload placeholder, bio editing
- [ ] Implement analytics summary dashboard at `/my-analytics`: summary cards, per-questionnaire table
- [ ] Implement per-questionnaire analytics at `/analytics/:questionnaireId`: response timeline, per-question distributions
- [ ] Implement CSV export of responses for a questionnaire
- [ ] Implement all required API endpoints for profile and analytics data
- [ ] Integrate Recharts for timeline and distribution charts

## Architecture Decisions Required

**ADR-017: Client-side chart library selection** — Evaluate Recharts vs. Tremor vs. Chart.js for the analytics charts. Recommend Recharts: it is composable, has no peer-dependency on a specific component library, and is well-maintained. Document bundle size impact and lazy-loading strategy for charts.

**ADR-018: Analytics computation approach** — Decide between on-demand SQL aggregation (compute on each API request) vs. pre-computed/materialized stats. For v1, on-demand is acceptable given response volumes; document the plan to add materialized stats if performance degrades.

**STANDARD-analytics-access-control:** Define that analytics endpoints (`/api/questionnaires/:id/analytics*`) require the authenticated user to be the creator of the questionnaire. Define the 403 response shape for access denied.

## Technical Architecture

### Route Structure

```
/profile/:username          → public user profile
/my-analytics               → authenticated: creator analytics summary
/analytics/:questionnaireId → authenticated: per-questionnaire analytics detail
```

TanStack Router files:
```
apps/web/src/routes/
  profile/
    $username.tsx
  my-analytics.tsx
  analytics/
    $questionnaireId.tsx
```

Route guards:
- `/my-analytics` and `/analytics/:questionnaireId` redirect to `/sign-in` if unauthenticated
- `/analytics/:questionnaireId` additionally fetches the questionnaire and returns 403 if the session user is not the creator

### API Endpoints

**`GET /api/users/:username/profile`** — Public

Response:
```typescript
{
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  stats: {
    totalQuestionnaires: number;
    totalResponses: number;
  };
  questionnaires: QuestionnaireCard[];   // reuse type from PHASE-13, published only
}
```

**`PATCH /api/users/me/profile`** — Authenticated

Request body:
```typescript
{
  bio?: string;         // max 500 chars
  displayName?: string; // max 100 chars
  avatarUrl?: string;   // URL of uploaded avatar (avatar upload handled separately)
}
```

**`GET /api/users/me/analytics/summary`** — Authenticated

Response:
```typescript
{
  totalQuestionnaires: number;
  totalResponses: number;
  avgCompletionRate: number;          // 0-100 percentage
  mostPopular: QuestionnaireCard | null;
}
```

Completion rate = responses that reached submission / total started sessions. For v1, defined as: any response record in the database (since we only store completed submissions), so completion rate = 100% if no abandonment tracking. Note this in ADR-018.

**`GET /api/users/me/analytics/questionnaires`** — Authenticated

Query params: `page`, `limit`, `sort` (responses_desc | recent | alpha)

Response (paginated):
```typescript
{
  data: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    responseCount: number;
    avgScore: number | null;      // null for survey type
    completionRate: number;       // placeholder 100% for v1
    createdAt: string;
    publishedAt: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

**`GET /api/questionnaires/:id/analytics`** — Authenticated, creator only

Response:
```typescript
{
  questionnaireId: string;
  title: string;
  type: string;
  summary: {
    totalResponses: number;
    avgScore: number | null;
    completionRate: number;
    avgTimeToCompleteSeconds: number | null;  // (submittedAt - startedAt) avg
  };
  timeline: Array<{
    date: string;          // YYYY-MM-DD
    responseCount: number;
  }>;                      // last 30 days, one entry per day
  questions: Array<{
    questionId: string;
    prompt: string;
    type: string;
    order: number;
    analytics:
      | { type: "distribution"; options: Array<{ label: string; count: number; percentage: number }> }
      | { type: "text_common"; topAnswers: Array<{ value: string; count: number }> }  // text_input top 10
      | { type: "count_only"; totalResponses: number }  // textarea
  }>;
}
```

**`GET /api/questionnaires/:id/analytics/export`** — Authenticated, creator only

Returns CSV file with headers:
```
responseId,respondentId,submittedAt,startedAt,[questionId_1_prompt],[questionId_2_prompt],...
```

One row per response. Answer values are the raw submitted values (comma-separated for checkbox). Response includes `Content-Disposition: attachment; filename="questionnaire-{id}-responses.csv"` header.

### Timeline Data Query

The 30-day timeline is computed with a SQLite query grouping responses by date:

```sql
SELECT 
  date(submittedAt) as date,
  COUNT(*) as responseCount
FROM responses
WHERE questionnaireId = ?
  AND submittedAt >= datetime('now', '-30 days')
GROUP BY date(submittedAt)
ORDER BY date ASC
```

The API fills in missing dates (0-count days) in application code before returning, so the chart always has 30 data points.

### Per-Question Analytics Query

For radio/checkbox/select:
```sql
SELECT o.label, COUNT(a.id) as count
FROM questionOptions o
LEFT JOIN answers a ON a.questionId = o.questionId 
  AND (a.value = o.id OR a.value LIKE '%' || o.id || '%')
  AND a.responseId IN (SELECT id FROM responses WHERE questionnaireId = ?)
WHERE o.questionId = ?
GROUP BY o.id
```

For text_input (top answers):
```sql
SELECT value, COUNT(*) as count
FROM answers
WHERE questionId = ?
  AND responseId IN (SELECT id FROM responses WHERE questionnaireId = ?)
GROUP BY LOWER(TRIM(value))
ORDER BY count DESC
LIMIT 10
```

### Frontend Components

#### Public Profile Page

Layout:
1. Profile header: avatar (80px circle, initials fallback), display name, `@username`, bio paragraph, join date, stat chips (N questionnaires, N responses)
2. Edit profile button (visible only when viewing own profile): opens `EditProfileDialog`
3. Questionnaire grid: same `QuestionnaireCard` grid from PHASE-13, showing only published questionnaires for this creator

Profile data fetched via TanStack Query, `staleTime: 10 * 60 * 1000` (10 min).

#### Edit Profile Dialog

`EditProfileDialog` (shadcn Dialog):
- Avatar section: circle with current avatar or initials, "Change photo" button (placeholder for PHASE-17/future — for now, only a URL input field)
- Display name input (max 100 chars)
- Bio textarea (max 500 chars, character counter)
- Save / Cancel buttons
- On save: PATCH `/api/users/me/profile`, invalidate profile query

#### Analytics Summary Dashboard (`/my-analytics`)

Layout:
1. Summary cards row (4 cards): Total Questionnaires, Total Responses, Avg Completion Rate, Most Popular
2. Questionnaire analytics table with sorting

Summary cards use a generic `StatCard` component:
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}
```

Questionnaire table columns: Title, Type, Status, Responses, Avg Score, Created Date. Clicking a row navigates to `/analytics/:questionnaireId`.

#### Per-Questionnaire Analytics (`/analytics/:questionnaireId`)

Layout:
1. Breadcrumb: My Analytics > [Questionnaire Title]
2. Summary cards row: Total Responses, Avg Score (if scored type), Avg Time to Complete
3. Response timeline chart (Recharts `AreaChart` or `BarChart`): X = date, Y = response count, last 30 days
4. Per-question analytics section: one card per question

Per-question card layout:
- Question prompt (heading)
- Question type badge
- For distribution: horizontal `BarChart` (Recharts) with option labels on Y-axis, counts on X-axis + percentage text
- For text_common: ranked list with percentage bars (CSS, no chart lib needed)
- For count_only: simple "N responses received" text

#### Recharts Integration

Add `recharts` to `packages/ui/package.json`. Create wrapper components to avoid direct Recharts imports in features:
- `TimelineChart.tsx`: wraps Recharts AreaChart, accepts `data: Array<{ date: string; count: number }>`
- `DistributionChart.tsx`: wraps Recharts BarChart, accepts `data: Array<{ label: string; count: number; percentage: number }>`

Both components should be lazy-loaded (dynamic import) since they are large dependencies only needed on analytics pages.

## Monorepo Touch Points

**packages/ui:**
- Add dependency: `recharts`
- New: `StatCard` component
- New: `TimelineChart` component (lazy Recharts wrapper)
- New: `DistributionChart` component (lazy Recharts wrapper)
- New: `UserAvatar` component (image with initials fallback)
- New: `EditProfileDialog` component

**packages/shared:**
- New: `UserProfile` Zod schema
- New: `AnalyticsSummary`, `QuestionnaireAnalytics`, `TimelineEntry`, `QuestionAnalytics` Zod schemas
- New: `ProfileUpdatePayload` Zod schema

**apps/api:**
- New: `GET /api/users/:username/profile` route
- New: `PATCH /api/users/me/profile` route
- New: `GET /api/users/me/analytics/summary` route
- New: `GET /api/users/me/analytics/questionnaires` route
- New: `GET /api/questionnaires/:id/analytics` route
- New: `GET /api/questionnaires/:id/analytics/export` route
- New: `apps/api/src/services/analytics.service.ts`
- New: `apps/api/src/services/profile.service.ts`

**apps/web:**
- New: `routes/profile/$username.tsx`
- New: `routes/my-analytics.tsx`
- New: `routes/analytics/$questionnaireId.tsx`
- New: `features/profile/` directory
- New: `features/analytics/` directory

## Directory Structure

```
apps/web/src/
  routes/
    profile/
      $username.tsx
    my-analytics.tsx
    analytics/
      $questionnaireId.tsx
  features/
    profile/
      ProfilePage.tsx
      EditProfileDialog.tsx
    analytics/
      AnalyticsSummary.tsx
      AnalyticsTable.tsx
      QuestionnaireAnalyticsDetail.tsx
      QuestionAnalyticsCard.tsx

packages/ui/src/
  components/
    stat-card/
      StatCard.tsx
    timeline-chart/
      TimelineChart.tsx          ← lazy recharts wrapper
    distribution-chart/
      DistributionChart.tsx      ← lazy recharts wrapper
    user-avatar/
      UserAvatar.tsx
    edit-profile-dialog/
      EditProfileDialog.tsx

packages/shared/src/
  schemas/
    profile.ts                   ← UserProfile, ProfileUpdatePayload
    analytics.ts                 ← all analytics schemas

apps/api/src/
  routes/
    profile.ts                   ← /api/users/* profile routes
    analytics.ts                 ← /api/questionnaires/:id/analytics routes
    user-analytics.ts            ← /api/users/me/analytics routes
  services/
    profile.service.ts
    analytics.service.ts
```

## Implementation Steps

1. **Define Zod schemas for profile and analytics in packages/shared**
   - Add `UserProfile`, `ProfileUpdatePayload` to `packages/shared/src/schemas/profile.ts`
   - Add `AnalyticsSummary`, `QuestionnaireAnalytics`, `TimelineEntry`, `QuestionAnalytics` to `packages/shared/src/schemas/analytics.ts`
   - Export all from `packages/shared/src/index.ts`

2. **Implement profile API endpoints**
   - Create `apps/api/src/services/profile.service.ts` with user lookup by username and profile update logic
   - Create `apps/api/src/routes/profile.ts` with `GET /users/:username/profile` and `PATCH /users/me/profile`
   - Validate PATCH body with `ProfileUpdatePayload` schema
   - Compute `totalQuestionnaires` and `totalResponses` stats via aggregate SQL queries

3. **Implement analytics service and per-questionnaire analytics endpoint**
   - Create `apps/api/src/services/analytics.service.ts`
   - Implement `getQuestionnaireSummary()`: aggregate response count, avg score, avg time
   - Implement `getTimeline()`: 30-day response timeline with zero-fill for missing days
   - Implement `getQuestionAnalytics()`: per-question distribution, text top answers, count-only
   - Create `apps/api/src/routes/analytics.ts` with `GET /questionnaires/:id/analytics`
   - Enforce creator-only access using STANDARD-analytics-access-control middleware

4. **Implement user analytics summary and table endpoints**
   - Create `apps/api/src/routes/user-analytics.ts` with `GET /users/me/analytics/summary` and `/questionnaires`
   - Summary: aggregate across all user's questionnaires
   - Table: paginated list with per-questionnaire stats

5. **Implement CSV export endpoint**
   - Create `GET /api/questionnaires/:id/analytics/export` in `apps/api/src/routes/analytics.ts`
   - Query all responses + answers for the questionnaire
   - Build CSV string in application code (no library needed for simple CSV)
   - Stream response with `Content-Disposition: attachment` header

6. **Build StatCard and UserAvatar UI components**
   - `StatCard`: title, large value, optional subtitle and icon, shadcn Card base
   - `UserAvatar`: image with initials fallback (first letter of username), configurable size
   - Write Storybook stories for both

7. **Build TimelineChart and DistributionChart components**
   - Add `recharts` to `packages/ui/package.json`
   - `TimelineChart`: wraps Recharts AreaChart, responsive container, axes, tooltip
   - `DistributionChart`: wraps Recharts BarChart (horizontal), percentage annotations
   - Both use `React.lazy` + `Suspense` wrapping at call site in analytics pages

8. **Implement public profile page**
   - Create `apps/web/src/routes/profile/$username.tsx`
   - TanStack Query: `['profile', username]` with `staleTime: 600_000`
   - Profile header with avatar, name, bio, stats
   - Edit button visible only when `session?.user.username === username`
   - `EditProfileDialog` integration with PATCH mutation and cache invalidation

9. **Implement analytics summary dashboard**
   - Create `apps/web/src/routes/my-analytics.tsx` with auth guard
   - 4 `StatCard` components in a responsive grid
   - Sortable questionnaire table (click column headers)
   - Row click navigates to `/analytics/:questionnaireId`

10. **Implement per-questionnaire analytics detail page**
    - Create `apps/web/src/routes/analytics/$questionnaireId.tsx` with auth guard + creator check
    - Summary cards row
    - Lazy-loaded `TimelineChart`
    - Per-question cards with lazy-loaded `DistributionChart` or text list

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1400 | Define Zod schemas for profile and analytics in packages/shared | chore | Sage | P0 |
| QZ-1401 | Implement profile API endpoints (GET public profile, PATCH own profile) | feature | Sage | P0 |
| QZ-1402 | Implement per-questionnaire analytics API endpoint and service | feature | Sage | P0 |
| QZ-1403 | Implement user analytics summary and table API endpoints | feature | Sage | P0 |
| QZ-1404 | Implement CSV export endpoint for questionnaire responses | feature | Sage | P1 |
| QZ-1405 | Build StatCard, UserAvatar UI components | feature | Milo | P0 |
| QZ-1406 | Build TimelineChart and DistributionChart components (Recharts) | feature | Milo | P1 |
| QZ-1407 | Implement public user profile page (/profile/:username) | feature | Nova | P0 |
| QZ-1408 | Implement profile edit dialog with PATCH mutation | feature | Nova | P1 |
| QZ-1409 | Implement analytics summary dashboard (/my-analytics) | feature | Nova | P0 |
| QZ-1410 | Implement per-questionnaire analytics detail page (/analytics/:id) | feature | Nova | P1 |

## Acceptance Criteria

- [ ] `/profile/testuser` shows avatar, username, bio, join date, and published questionnaires
- [ ] Profile page stats show correct total questionnaires and total responses counts
- [ ] "Edit profile" button is visible only on the current user's own profile
- [ ] Editing bio and saving updates the profile without page reload
- [ ] Visiting `/my-analytics` without auth redirects to `/sign-in`
- [ ] `/my-analytics` summary cards show correct aggregate stats
- [ ] Questionnaire analytics table rows are clickable and navigate to detail page
- [ ] `/analytics/:id` shows a 403 error if the requesting user is not the questionnaire creator
- [ ] `/analytics/:id` response timeline chart shows 30 data points (including zero-fill days)
- [ ] Radio/Select questions show distribution bar chart with option labels and percentages
- [ ] Text input questions show top 10 most common answers
- [ ] Textarea questions show response count only
- [ ] "Export CSV" downloads a .csv file with one row per response
- [ ] CSV file includes all question prompts as column headers
- [ ] Charts are lazy-loaded (Recharts bundle not included in initial page load)

## Out of Scope

- Avatar file upload — v1 accepts URL only; file upload addressed in future phase
- Follower/following relationships — not in v1
- Questionnaire sharing analytics (link click tracking) — not in v1
- Time-range filtering for analytics charts — v1 is fixed 30-day window
- Comparison between multiple questionnaires — not in v1
- Email notifications for response milestones — not in v1

## Phase Dependencies

- **PHASE-11 (Taking Flows) must be complete** because analytics data comes from the responses/answers tables populated during taking
- **PHASE-12 (Results Pages) must be complete** because per-question correctness is calculated using the same scoring logic referenced in analytics
- **PHASE-13 (Homepage Feed) must be complete** because the profile page reuses `QuestionnaireCard` and `FeedGrid` components from that phase

## Agent Assignments

- **Architect:** Write ADR-017 (chart library selection), ADR-018 (analytics computation approach), STANDARD-analytics-access-control
- **Dev/Sage (Backend):** QZ-1400, QZ-1401, QZ-1402, QZ-1403, QZ-1404 — all API endpoints and services
- **Dev/Nova (Frontend):** QZ-1407, QZ-1408, QZ-1409, QZ-1410 — all frontend pages
- **Dev/Milo (Visual/CSS):** QZ-1405, QZ-1406 — chart components, stat cards, visual polish
- **QA/Ivy:** Test analytics accuracy (cross-check with raw response data), test CSV export correctness, test creator-only access enforcement
- **DevOps/Axel:** Verify Recharts does not exceed bundle size budget (PHASE-18); confirm lazy load strategy works in production build
- **Remy (Producer):** Confirm analytics metrics definitions, sign off on chart types per wireframes

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Analytics SQL aggregations are slow for high-response questionnaires | Medium | Medium | Add composite index on (questionnaireId, submittedAt) in responses table; document in ADR-018 |
| Recharts bundle size significantly increases initial load | Medium | Medium | Use React.lazy for chart components; enforce bundle size budget in PHASE-18 |
| CSV export times out for questionnaires with thousands of responses | Low | High | Stream CSV response using Hono streaming API; add pagination warning in UI for >10k responses |
| Per-question distribution query correctness for checkbox (multi-select) answers | Medium | Medium | Write dedicated unit tests for checkbox answer distribution logic before merge |

## Estimated Effort

L
