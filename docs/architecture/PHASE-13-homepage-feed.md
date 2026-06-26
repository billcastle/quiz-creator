---
phase: 13
title: "Homepage Feed & Discovery"
status: pending
depends_on: ["PHASE-01", "PHASE-02", "PHASE-03", "PHASE-04", "PHASE-05"]
estimated_tickets: 6
---

# PHASE-13 — Homepage Feed & Discovery

## Overview

This phase builds the public landing page and discovery experience — the first thing every visitor sees. The homepage serves two audiences simultaneously: anonymous visitors discovering questionnaires to take, and authenticated creators navigating to their own content. It is both a marketing surface and a navigation hub.

The design (from wireframes) follows a familiar content discovery pattern: left sidebar for navigation and category filters, main area with a featured banner and questionnaire grid, top bar with search and type filters. Questionnaire cards show a type badge (Quiz/Survey/Exam), title, category, and take count. The grid supports infinite scroll, type filtering, and text search. Category pages reuse the same grid component, pre-filtered to a specific category.

Performance is a first-class concern: the public feed is the highest-read endpoint in the application. Cloudflare KV caching with 5-minute TTLs keeps latency low while keeping content fresh. TanStack Query manages client-side cache invalidation and background refetching. Skeleton loaders ensure the page feels fast even before data arrives.

## Goals

- [ ] Implement homepage layout: top nav, left sidebar, main content area (responsive)
- [ ] Implement questionnaire grid with cards showing type badge, title, category, take count
- [ ] Implement featured questionnaire banner (weekly pick or most popular fallback)
- [ ] Implement category rails (horizontal scroll, one per category in main area)
- [ ] Implement type filter (All / Quiz / Survey / Exam) and sort (Popular / Recent / Trending)
- [ ] Implement debounced search: results replace the grid, empty state shown when no results
- [ ] Implement infinite scroll using TanStack Query `useInfiniteQuery`
- [ ] Implement `/category/:slug` pages pre-filtered to a category
- [ ] Implement `/my-quizzes` and `/my-drafts` authenticated routes
- [ ] Implement Cloudflare KV caching for public feed endpoints (5-minute TTL)
- [ ] Implement cache invalidation on questionnaire publish

## Architecture Decisions Required

**ADR-015: Infinite scroll vs. pagination for the feed** — Evaluate TanStack Query `useInfiniteQuery` (infinite scroll via intersection observer) vs. page-based pagination (numbered pages). Recommend infinite scroll for the discovery feed but document the trade-off: infinite scroll is harder to share as a deep link.

**ADR-016: Feed caching strategy with Cloudflare KV** — Document the cache key scheme `feed:{type}:{sort}:{page}:{search}`, TTL rationale (5 minutes for public feed), and cache invalidation trigger points (on publish). Include decision on whether to cache search results (recommendation: do not cache search results to avoid unbounded key growth).

**STANDARD-api-pagination:** Define the standard pagination envelope used by all list endpoints: `{ data: T[], total: number, page: number, limit: number, hasNextPage: boolean }`. All paginated endpoints must conform.

## Technical Architecture

### Route Structure

```
/                       → Homepage feed
/category/:slug         → Category-filtered feed
/my-quizzes             → Authenticated: user's published questionnaires
/my-drafts              → Authenticated: user's draft questionnaires
```

TanStack Router files:
```
apps/web/src/routes/
  index.tsx               ← homepage feed
  category/
    $slug.tsx             ← category filtered feed
  my-quizzes.tsx          ← authenticated, redirects if not logged in
  my-drafts.tsx           ← authenticated, redirects if not logged in
```

### Feed API Endpoints

**`GET /api/feed`**

Query parameters:
- `q` — search term (optional, debounced client-side before sending)
- `type` — `quiz` | `survey` | `exam` | `all` (default: `all`)
- `sort` — `popular` | `recent` | `trending` (default: `popular`)
- `category` — category slug (optional)
- `page` — 1-based page number (default: 1)
- `limit` — items per page (default: 20, max: 100)

Response (conforms to STANDARD-api-pagination):
```typescript
{
  data: QuestionnaireCard[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
```

`QuestionnaireCard` shape:
```typescript
{
  id: string;
  shareToken: string;
  title: string;
  type: "quiz" | "survey" | "exam";
  category: string | null;
  categorySlug: string | null;
  thumbnailUrl: string | null;
  takeCount: number;
  questionCount: number;
  createdAt: string;
  publishedAt: string;
  creator: {
    username: string;
    avatarUrl: string | null;
  };
}
```

Sort logic:
- `popular`: ORDER BY `takeCount` DESC
- `recent`: ORDER BY `publishedAt` DESC
- `trending`: ORDER BY `takeCount / MAX(1, (julianday('now') - julianday(publishedAt)))` DESC (SQLite expression — takes per day since publish)

**`GET /api/feed/featured`**

Returns a single `QuestionnaireCard` where `questionnaires.featured = true`. If none is marked featured, fall back to the single most popular questionnaire (highest takeCount). Cached in KV for 30 minutes, key: `featured`.

**`GET /api/feed/categories`**

Returns the list of available categories with counts:
```typescript
Array<{
  name: string;
  slug: string;
  questionnaireCount: number;
}>
```

Categories are a fixed enum in the database (not user-defined for v1): Education, Trivia & Fun, Health, Product Research, Personality.

### Caching Strategy (Cloudflare KV)

Cache key format: `feed:{type}:{sort}:{page}:{limit}` (search terms are NOT cached — see ADR-016).

Cache flow in Hono middleware:
1. Compute cache key from query params
2. Check KV for cached response: `env.QUIZ_KV.get(cacheKey, 'json')`
3. If cache hit: return cached response with `X-Cache: HIT` header
4. If cache miss: execute D1 query, store result in KV with 300-second TTL, return with `X-Cache: MISS` header

Cache invalidation: When a questionnaire is published (status changes from `draft` to `published`), delete relevant feed cache keys. Since keys are parameterized, the practical invalidation strategy is to delete all keys matching the relevant type and sort combinations (KV does not support wildcard delete; maintain a list of active cache keys or use a generation counter).

**Generation counter approach:** Store a `feed_version` counter in KV. Increment on publish. Include version in all cache keys: `feed:{version}:{type}:{sort}:{page}`. Old keys naturally expire via TTL.

### Homepage Layout

Top navigation bar (sticky, full-width):
- Left: "Questify" logo (links to `/`)
- Center: Search `<Input>` with debounced onChange (300ms), magnifier icon
- Right: Type filter `<Select>` (All / Quiz / Survey / Exam) + Sort `<Select>` (Popular / Recent / Trending) + user avatar dropdown (if authenticated) or "Sign in" button

Left sidebar (desktop only, 240px fixed, hidden on mobile):
- Navigation links: Explore (→ `/`), My Quizzes (→ `/my-quizzes`, auth required), Drafts (→ `/my-drafts`, auth required)
- Section heading "Categories"
- Category list: Education, Trivia & Fun, Health, Product Research, Personality (each links to `/category/:slug`)
- "+ Create now" CTA button at bottom (links to builder)

Main content area:
- Featured banner (full-width, 360px height on desktop)
- Category rails (horizontal scroll, one per category) — shown on homepage only, not on search/filtered views
- Questionnaire grid (below rails or when search/filter active)

Mobile layout:
- Left sidebar collapses to a bottom navigation bar or slide-out drawer
- Top nav search moves to a full-width search bar below the logo row
- Category rails scroll horizontally with touch

### Questionnaire Card Component

Used in the grid, category rails, and My Quizzes/Drafts pages.

```typescript
interface QuestionnaireCardProps {
  questionnaire: QuestionnaireCard;
  variant?: "grid" | "rail";    // grid = 280px wide, rail = 200px wide
}
```

Card anatomy:
- Thumbnail area (16:9 aspect ratio): image if `thumbnailUrl` set, else gradient placeholder with first letter of title
- Type badge (top-left overlay): "Quiz" | "Survey" | "Exam" (distinct colors per type)
- Card body: title (2-line clamp), creator username, category name, take count with icon
- Hover state: slight scale transform, shadow increase (CSS transition)

On click: navigate to `/q/:shareToken` (the taking flow).

Prefetch on hover (intent prefetch via TanStack Router): when the card is hovered for 200ms, prefetch the questionnaire data for the taking route to reduce perceived load time.

### Featured Banner Component

Full-width banner (Cloudflare Pages can serve images from the public directory or a CDN):

```typescript
interface FeaturedBannerProps {
  questionnaire: QuestionnaireCard;
}
```

Layout:
- Background: questionnaire thumbnail if available, else gradient background using category color
- Overlay: "Featured" pill badge, questionnaire title (large), type badge, take count, creator info
- CTA button: "Take now" (links to `/q/:shareToken`)

### Category Rail Component

Horizontal scrolling row of QuestionnaireCards filtered to one category:

```typescript
interface CategoryRailProps {
  categoryName: string;
  categorySlug: string;
}
```

Rail fetches its own data: `GET /api/feed?category={slug}&limit=6&sort=popular`. Shows 6 cards, "See all" link (→ `/category/:slug`). Uses TanStack Query with `staleTime: 5 * 60 * 1000` (5 min).

### Search and Filtering

Search input debounce: 300ms (useDebounce custom hook or `useDeferredValue`).

When `q` param is non-empty or `type` filter is not `all`:
- Category rails are hidden
- Featured banner is hidden
- Grid shows filtered results only
- Empty state shown when `data.length === 0`: illustration + "No questionnaires found for your search" + "Clear filters" button

Infinite scroll implementation:
- `useInfiniteQuery` with `getNextPageParam: (last) => last.hasNextPage ? last.page + 1 : undefined`
- Intersection Observer on a sentinel div at bottom of grid
- Load more triggered automatically when sentinel enters viewport
- Loading spinner shown while next page fetches

### My Quizzes / My Drafts Pages

Route guard: if `useSession()` returns no session, redirect to `/sign-in?redirect=/my-quizzes`.

API: reuse `GET /api/feed` with additional `creatorId=me` query param (resolved server-side from session). My Quizzes: `status=published`. My Drafts: `status=draft`.

On these pages, questionnaire cards show additional creator actions: Edit (→ builder), Delete (confirmation dialog), View Analytics (→ `/analytics/:id`).

## Monorepo Touch Points

**packages/ui:**
- New: `QuestionnaireCard` component (grid and rail variants)
- New: `FeaturedBanner` component
- New: `CategoryRail` component
- New: `QuestionnaireGrid` component (grid layout with infinite scroll sentinel)
- New: `SearchInput` component (with debounce behavior)
- New: `TypeFilterSelect`, `SortSelect` components
- New: `EmptyState` component (with illustration slot)

**packages/shared:**
- New: `QuestionnaireCard` Zod schema + type
- New: `FeedQuery` Zod schema (query param validation)
- New: `PaginatedResponse<T>` generic schema
- New: Category enum / list

**apps/api:**
- New: `GET /api/feed` route
- New: `GET /api/feed/featured` route
- New: `GET /api/feed/categories` route
- New: `apps/api/src/services/feed.service.ts` (query construction, KV caching)
- New: `apps/api/src/middleware/kv-cache.ts` (KV cache middleware)

**apps/web:**
- New: `routes/index.tsx`
- New: `routes/category/$slug.tsx`
- New: `routes/my-quizzes.tsx`
- New: `routes/my-drafts.tsx`
- New: `features/feed/` directory
- New: `hooks/useDebounce.ts`

## Directory Structure

```
apps/web/src/
  routes/
    index.tsx                  ← homepage
    category/
      $slug.tsx                ← category feed
    my-quizzes.tsx             ← authenticated
    my-drafts.tsx              ← authenticated
  features/
    feed/
      HomePage.tsx             ← composes all homepage sections
      FeedGrid.tsx             ← infinite scroll grid
      HomeSidebar.tsx          ← left sidebar
      TopNav.tsx               ← top navigation bar
  hooks/
    useDebounce.ts

packages/ui/src/
  components/
    questionnaire-card/
      QuestionnaireCard.tsx
      QuestionnaireCard.stories.tsx
    featured-banner/
      FeaturedBanner.tsx
    category-rail/
      CategoryRail.tsx
    feed-grid/
      FeedGrid.tsx
    empty-state/
      EmptyState.tsx
    search-input/
      SearchInput.tsx

packages/shared/src/
  schemas/
    feed.ts                    ← QuestionnaireCard, FeedQuery, PaginatedResponse
  constants/
    categories.ts              ← CATEGORIES constant with name/slug pairs

apps/api/src/
  routes/
    feed.ts                    ← /api/feed, /api/feed/featured, /api/feed/categories
  services/
    feed.service.ts            ← query logic, KV cache read/write
  middleware/
    kv-cache.ts                ← generic KV cache middleware
```

## Implementation Steps

1. **Define feed schemas and category constants in packages/shared**
   - Add `QuestionnaireCard`, `FeedQuery`, `PaginatedResponse<T>` schemas to `packages/shared/src/schemas/feed.ts`
   - Add `CATEGORIES` constant to `packages/shared/src/constants/categories.ts`
   - Export all from `packages/shared/src/index.ts`

2. **Implement KV cache middleware for Hono**
   - Create `apps/api/src/middleware/kv-cache.ts`
   - Accept `ttl` and `keyFn` parameters
   - Check KV for cached response, bypass if `q` param present
   - Implement generation counter invalidation strategy
   - Add `X-Cache` response header

3. **Implement feed service and API routes**
   - Create `apps/api/src/services/feed.service.ts` with D1 queries for feed, featured, categories
   - Implement trending sort SQL expression
   - Create `apps/api/src/routes/feed.ts` wiring routes to service with KV cache middleware
   - Validate query params with Zod `FeedQuery` schema

4. **Build QuestionnaireCard component**
   - Implement grid and rail variants
   - Thumbnail with gradient fallback
   - Type badge with type-specific colors
   - Hover prefetch via TanStack Router `router.preloadRoute`
   - Write Storybook stories

5. **Build FeaturedBanner component**
   - Full-width banner with background image/gradient
   - "Featured" pill, title, type badge, take count, CTA button
   - Responsive: full height on desktop, reduced height on mobile

6. **Build CategoryRail component**
   - Horizontal scroll container
   - Fetches own data via TanStack Query
   - 6 cards + "See all" link
   - Scroll controls (arrow buttons on desktop)

7. **Build SearchInput, TypeFilterSelect, SortSelect, EmptyState components**
   - `SearchInput`: controlled input with debounce, clear button
   - `TypeFilterSelect`: shadcn Select wrapping the type filter options
   - `SortSelect`: shadcn Select wrapping sort options
   - `EmptyState`: icon slot, title, description, action button slot

8. **Implement FeedGrid with infinite scroll**
   - `useInfiniteQuery` for paginated questionnaire cards
   - Intersection Observer on sentinel div
   - Skeleton loading states (show 8 skeleton cards while initial data loads)
   - Grid layout: responsive CSS grid (1 col mobile, 2 col tablet, 3-4 col desktop)

9. **Implement homepage layout and route**
   - Create `apps/web/src/routes/index.tsx`
   - `HomeSidebar` with navigation links, categories, Create CTA
   - `TopNav` with logo, search, filters, auth controls
   - Compose `FeaturedBanner` + category rails + `FeedGrid`
   - Responsive layout (sidebar hidden on mobile)

10. **Implement category page route**
    - Create `apps/web/src/routes/category/$slug.tsx`
    - Route loader validates slug against CATEGORIES constant
    - Pre-filter FeedGrid to category; hide featured banner and rails

11. **Implement My Quizzes and My Drafts routes**
    - Create `apps/web/src/routes/my-quizzes.tsx` and `my-drafts.tsx`
    - Route guard: redirect to `/sign-in` if unauthenticated
    - Fetch with `creatorId=me` + appropriate status filter
    - Show Edit / Delete / View Analytics actions on cards

12. **Wire cache invalidation on publish**
    - In the publish endpoint (PHASE-09 or PHASE-10), after status update, increment `feed_version` in KV
    - Verify old feed cache is not served after publish via integration test

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1300 | Define feed schemas and category constants in packages/shared | chore | Sage | P0 |
| QZ-1301 | Implement KV cache middleware for Hono | feature | Sage | P0 |
| QZ-1302 | Implement feed service and API routes (GET /api/feed, featured, categories) | feature | Sage | P0 |
| QZ-1303 | Build QuestionnaireCard component (grid + rail variants) | feature | Milo | P0 |
| QZ-1304 | Build FeaturedBanner component | feature | Milo | P1 |
| QZ-1305 | Build CategoryRail component with horizontal scroll | feature | Nova | P1 |
| QZ-1306 | Build SearchInput, TypeFilterSelect, SortSelect, EmptyState components | feature | Nova | P0 |
| QZ-1307 | Implement FeedGrid with infinite scroll (useInfiniteQuery + IntersectionObserver) | feature | Nova | P0 |
| QZ-1308 | Implement homepage layout and route (index.tsx) | feature | Nova | P0 |
| QZ-1309 | Implement /category/:slug route | feature | Nova | P1 |
| QZ-1310 | Implement /my-quizzes and /my-drafts authenticated routes | feature | Nova | P1 |
| QZ-1311 | Wire feed cache invalidation on questionnaire publish | chore | Sage | P1 |

## Acceptance Criteria

- [ ] Homepage loads at `/` showing featured banner, category rails, and questionnaire grid
- [ ] Questionnaire cards display type badge (Quiz/Survey/Exam) in distinct colors
- [ ] Type filter dropdown filters the grid to only the selected type
- [ ] Sort dropdown changes grid order (Popular / Recent / Trending)
- [ ] Typing in search input (with 300ms debounce) filters the grid by title
- [ ] Empty search state shows illustration and "No questionnaires found" message
- [ ] Grid loads additional cards when user scrolls to the bottom (infinite scroll)
- [ ] Featured banner shows a questionnaire marked as featured, or falls back to most popular
- [ ] `/category/education` shows only Education category questionnaires
- [ ] Visiting `/my-quizzes` without auth redirects to `/sign-in`
- [ ] `/my-quizzes` shows the authenticated user's published questionnaires
- [ ] `/my-drafts` shows the authenticated user's draft questionnaires
- [ ] Feed API response includes `X-Cache: HIT` on second request within 5 minutes
- [ ] Feed cache is invalidated after publishing a new questionnaire
- [ ] Skeleton cards display while initial feed data is loading
- [ ] Left sidebar is hidden on mobile and accessible via a menu toggle

## Out of Scope

- Questionnaire thumbnails via file upload — v1 uses gradient placeholders; image upload addressed in PHASE-14
- User-defined custom categories — categories are a fixed enum for v1
- Personalized feed algorithm — v1 uses simple popularity/recency sort
- Search by creator username — v1 searches title only
- Social features (likes, bookmarks) — not in v1

## Phase Dependencies

- **PHASE-01 (Monorepo Setup) must be complete** because package workspace and shared package imports are required
- **PHASE-02 (Database Schema) must be complete** because `questionnaires.takeCount`, `questionnaires.featured`, `questionnaires.category` columns must exist
- **PHASE-03 (API Foundation) must be complete** because Hono app structure and KV bindings are prerequisites
- **PHASE-04 (Authentication) must be complete** because My Quizzes/Drafts routes require session checking and the nav shows auth state
- **PHASE-05 (Design System) must be complete** because card and layout components depend on shadcn primitives

## Agent Assignments

- **Architect:** Write ADR-015 (infinite scroll vs. pagination), ADR-016 (KV caching strategy), STANDARD-api-pagination
- **Dev/Sage (Backend):** QZ-1300, QZ-1301, QZ-1302, QZ-1311 — API endpoints, KV middleware, cache invalidation
- **Dev/Nova (Frontend):** QZ-1305, QZ-1306, QZ-1307, QZ-1308, QZ-1309, QZ-1310 — feed components, routes, infinite scroll
- **Dev/Milo (Visual/CSS):** QZ-1303, QZ-1304 — card components, featured banner, responsive layout polish
- **QA/Ivy:** Test filter combinations, infinite scroll edge cases, cache behavior, mobile layout
- **DevOps/Axel:** Verify KV namespace is provisioned in wrangler.toml for local dev and production
- **Remy (Producer):** Confirm category list, confirm card design matches wireframes, sign off on search behavior

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| KV cache key explosion from search queries | High | Low | Never cache search results (q param present = bypass cache) per ADR-016 |
| Infinite scroll causes memory leak (accumulating React nodes) | Medium | Medium | Use react-virtual or windowing if grid exceeds 100 items |
| Trending sort SQL expression is slow without index | Medium | Medium | Add composite index on (publishedAt, takeCount); analyze with EXPLAIN QUERY PLAN |
| Category rail fires 5 concurrent API requests on homepage load | Medium | Low | Batch category rail data into a single `/api/feed/categories-preview` endpoint returning top 6 per category |

## Estimated Effort

L
