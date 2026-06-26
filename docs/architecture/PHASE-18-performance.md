---
phase: 18
title: "Web Performance Enhancement"
status: pending
depends_on: ["PHASE-13", "PHASE-14", "PHASE-16"]
estimated_tickets: 5
---

# PHASE-18 — Web Performance Enhancement

## Overview

This phase optimizes the application's frontend and backend performance to ensure fast load times, responsive interactions, and efficient resource utilization at scale. Performance is treated as a feature: slow apps lose users, and Cloudflare's edge infrastructure is only valuable if the application is built to take advantage of it.

Frontend performance work focuses on reducing bundle size (target: initial bundle < 150KB gzipped), optimizing TanStack Query cache configuration to minimize unnecessary network requests, and adding React performance patterns (memoization, virtual scrolling) for components that render in large quantities. Backend performance work focuses on Cloudflare KV caching for high-read public endpoints, D1 query optimization via composite indexes, and web vitals monitoring to establish a performance baseline and detect regressions.

This phase does not introduce new features — it is a targeted engineering phase to bring existing features up to performance standards before the application is considered production-ready. All changes must be verifiable: performance improvements must be measurable, not just theoretical.

## Goals

- [ ] Implement route-based code splitting via TanStack Router lazy routes (target: initial bundle < 150KB gzipped)
- [ ] Tune TanStack Query staleTime and gcTime per data type (feed, questionnaire detail, user profile)
- [ ] Implement hover-intent prefetch for questionnaire cards (reduce perceived navigation latency)
- [ ] Add `React.memo` to `QuestionnaireCard` to prevent unnecessary re-renders in large grids
- [ ] Implement virtual scrolling for questionnaire grids exceeding 50 items (`@tanstack/react-virtual`)
- [ ] Add `<img loading="lazy">` to all below-fold images
- [ ] Implement Cloudflare KV caching for all public feed endpoints (5-minute TTL) — review/verify from PHASE-13
- [ ] Add composite D1 indexes for high-frequency queries (responses, questions)
- [ ] Add `web-vitals` package and report LCP, CLS, TTFB to a logging endpoint
- [ ] Set up Vite bundle analysis and fail CI build if any chunk exceeds 500KB
- [ ] Document performance budget in STANDARD-performance-budget

## Architecture Decisions Required

**ADR-024: Virtual scrolling threshold** — Define when to activate virtual scrolling (>50 items) vs. pagination. Document why `@tanstack/react-virtual` is preferred over `react-window` (same monorepo ecosystem, lighter, composable).

**ADR-025: Web vitals reporting endpoint** — Decide whether to send web vitals to a dedicated Cloudflare Worker endpoint (adds API surface) or to use the Cloudflare Analytics engine directly (no custom code). For v1, recommend Worker endpoint with a simple `POST /api/vitals` that logs to console (Cloudflare Workers logs are queryable).

**STANDARD-performance-budget:** Define the performance targets:
- Initial JS bundle: < 150KB gzipped
- Largest Contentful Paint (LCP): < 2.5s on 4G
- Cumulative Layout Shift (CLS): < 0.1
- Time to First Byte (TTFB): < 600ms
- Individual Vite chunks: < 500KB (CI enforced)

## Technical Architecture

### Route-Based Code Splitting

TanStack Router supports lazy route components via `createLazyFileRoute()`. Convert all non-critical routes to lazy loading:

Routes that should be **eagerly loaded** (critical path):
- `/` (homepage)
- `/sign-in`, `/sign-up`
- `/q/:shareToken` (taking flows)

Routes that should be **lazy loaded** (deferred):
- `/results/:responseId`
- `/profile/:username`
- `/my-analytics`
- `/analytics/:questionnaireId`
- `/admin/*` (entire admin section)
- `/category/:slug`
- `/my-quizzes`, `/my-drafts`

In TanStack Router, lazy routes are defined by splitting the route file into two files:
```
routes/results/$responseId.tsx        ← route config (loader, head, errorBoundary)
routes/results/$responseId.lazy.tsx   ← lazy component (the actual JSX)
```

The `$responseId.tsx` file exports `createFileRoute` with loader only:
```typescript
export const Route = createFileRoute('/results/$responseId')({
  loader: ...,
});
```

The `$responseId.lazy.tsx` file exports the component:
```typescript
export const Route = createLazyFileRoute('/results/$responseId')({
  component: ResultsPage,
});
```

TanStack Router automatically code-splits these files.

### Heavy Component Lazy Loading

Components that include large dependencies (Recharts, heavy icons):

```typescript
// In analytics route component
const TimelineChart = React.lazy(() =>
  import('@quiz/ui/components/timeline-chart').then(m => ({ default: m.TimelineChart }))
);
const DistributionChart = React.lazy(() =>
  import('@quiz/ui/components/distribution-chart').then(m => ({ default: m.DistributionChart }))
);
```

Wrap lazy components in `<Suspense fallback={<ChartSkeleton />}>`.

### TanStack Query Cache Configuration

Define a centralized query configuration object in `apps/web/src/lib/query-config.ts`:

```typescript
export const queryConfig = {
  feed: {
    staleTime: 5 * 60 * 1000,       // 5 minutes
    gcTime: 30 * 60 * 1000,         // 30 minutes
  },
  questionnaireDetail: {
    staleTime: 2 * 60 * 1000,       // 2 minutes
    gcTime: 10 * 60 * 1000,         // 10 minutes
  },
  userProfile: {
    staleTime: 10 * 60 * 1000,      // 10 minutes
    gcTime: 30 * 60 * 1000,         // 30 minutes
  },
  results: {
    staleTime: Infinity,             // immutable — never re-fetch
    gcTime: 60 * 60 * 1000,         // 1 hour
  },
  analytics: {
    staleTime: 5 * 60 * 1000,       // 5 minutes
    gcTime: 15 * 60 * 1000,         // 15 minutes
  },
} as const;
```

Apply in each query hook:
```typescript
useQuery({
  queryKey: ['feed', filters],
  queryFn: fetchFeed,
  ...queryConfig.feed,
})
```

### Hover-Intent Prefetch

In `QuestionnaireCard`, implement prefetch on hover using TanStack Router's `router.preloadRoute()`:

```typescript
const router = useRouter();
const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();

const handleMouseEnter = () => {
  hoverTimeout.current = setTimeout(() => {
    router.preloadRoute({
      to: '/q/$shareToken',
      params: { shareToken: questionnaire.shareToken },
    });
  }, 200);  // 200ms intent delay
};

const handleMouseLeave = () => {
  clearTimeout(hoverTimeout.current);
};
```

This triggers the route loader (which fetches taking data) 200ms after hover, so data may already be in cache when the user clicks.

### React.memo for QuestionnaireCard

`QuestionnaireCard` is rendered dozens of times in the feed grid. Wrap with `React.memo` using a custom comparison:

```typescript
export const QuestionnaireCard = React.memo(
  function QuestionnaireCard({ questionnaire, variant }: QuestionnaireCardProps) {
    // component body
  },
  (prev, next) => prev.questionnaire.id === next.questionnaire.id &&
                   prev.questionnaire.takeCount === next.questionnaire.takeCount &&
                   prev.variant === next.variant
);
```

Only re-render when `id`, `takeCount`, or `variant` changes. This prevents full grid re-renders when only filters or sort order changes (which should cause a new query, not a re-render of existing cards).

### Virtual Scrolling

When the feed grid has more than 50 items accumulated via infinite scroll, switch to virtual rendering using `@tanstack/react-virtual`:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const allItems = pages.flatMap(p => p.data);

const rowVirtualizer = useVirtualizer({
  count: allItems.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 300,          // estimated card height
  overscan: 5,
});
```

Only activate virtualizer when `allItems.length > 50`. Below that threshold, use standard rendering (virtualizer has overhead that outweighs benefit for small lists).

### Image Optimization

All `<img>` elements below the fold must have `loading="lazy"`:

```tsx
<img
  src={questionnaire.thumbnailUrl ?? undefined}
  alt={questionnaire.title}
  loading="lazy"
  width="280"
  height="157"
/>
```

Always specify `width` and `height` attributes to prevent layout shift (CLS improvement).

For above-fold images (featured banner): use `loading="eager"` (default, no attribute needed) and consider adding `fetchpriority="high"` on the featured banner image.

Gradient placeholder for missing thumbnails: CSS-only, no extra network request:
```css
.thumbnail-placeholder {
  background: linear-gradient(135deg, var(--color-primary-100), var(--color-primary-300));
}
```

### Cloudflare KV Caching Audit

PHASE-13 established the KV caching middleware. This phase verifies its correctness and fills gaps:

1. Confirm all `GET /api/feed*` routes use the KV cache middleware
2. Add caching for `GET /api/questionnaires/:shareToken/take`: 10-minute TTL, key `q:take:{shareToken}`
3. Add caching for `GET /api/users/:username/profile`: 5-minute TTL, key `profile:{username}`
4. Verify cache invalidation fires correctly on questionnaire publish and profile update

Cache key inventory:
| Key Pattern | TTL | Invalidated When |
|---|---|---|
| `feed:{version}:{type}:{sort}:{page}:{limit}` | 5 min | New questionnaire published |
| `featured` | 30 min | Featured flag changes |
| `q:take:{shareToken}` | 10 min | Questionnaire updated/archived |
| `profile:{username}` | 5 min | Profile updated |

### D1 Query Optimization

Add composite indexes in a new migration file `packages/db/migrations/0002_performance_indexes.sql`:

```sql
-- Responses: lookup by questionnaire (for analytics)
CREATE INDEX IF NOT EXISTS idx_responses_questionnaire_submitted
ON responses (questionnaireId, submittedAt DESC);

-- Responses: lookup by respondent (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_responses_respondent
ON responses (respondentId);

-- Answers: lookup by response (for result calculation)
CREATE INDEX IF NOT EXISTS idx_answers_response
ON answers (responseId);

-- Answers: lookup by question (for analytics distribution)
CREATE INDEX IF NOT EXISTS idx_answers_question
ON answers (questionId);

-- Questions: ordering within questionnaire
CREATE INDEX IF NOT EXISTS idx_questions_questionnaire_order
ON questions (questionnaireId, "order" ASC);

-- Questionnaires: feed queries
CREATE INDEX IF NOT EXISTS idx_questionnaires_feed
ON questionnaires (status, publishedAt DESC, takeCount DESC);

-- Questionnaires: category filter
CREATE INDEX IF NOT EXISTS idx_questionnaires_category_status
ON questionnaires (category, status, publishedAt DESC);
```

After adding indexes, run `EXPLAIN QUERY PLAN` on the top 5 highest-frequency queries to verify index usage.

### Web Vitals Reporting

Add `web-vitals` to `apps/web`:

```typescript
// apps/web/src/lib/vitals.ts
import { onCLS, onLCP, onTTFB, onFID, onINP } from 'web-vitals';

const reportVital = (metric: Metric) => {
  if (import.meta.env.PROD) {
    navigator.sendBeacon('/api/vitals', JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      url: window.location.href,
    }));
  }
};

export function initVitals() {
  onCLS(reportVital);
  onLCP(reportVital);
  onTTFB(reportVital);
  onFID(reportVital);
  onINP(reportVital);
}
```

Call `initVitals()` in `apps/web/src/main.tsx` after app mount.

Backend: add `POST /api/vitals` endpoint in Hono that logs the vital to `console.log` (visible in Cloudflare Workers Logs). This keeps it simple for v1 — metrics are queryable via Cloudflare dashboard.

### Vite Bundle Analysis CI Check

Add `rollup-plugin-visualizer` to `apps/web/vite.config.ts` as an optional dev tool. More importantly, add a CI step to fail if any output chunk exceeds 500KB:

Add to `apps/web/package.json`:
```json
{
  "scripts": {
    "build:analyze": "vite build && node scripts/check-bundle-size.js"
  }
}
```

Create `apps/web/scripts/check-bundle-size.js`:
```javascript
const fs = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '../dist/assets');
const MAX_CHUNK_SIZE = 500 * 1024; // 500KB

const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
let failed = false;

for (const file of files) {
  const size = fs.statSync(path.join(distDir, file)).size;
  if (size > MAX_CHUNK_SIZE) {
    console.error(`FAIL: ${file} is ${(size / 1024).toFixed(1)}KB (limit: 500KB)`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Bundle size check passed.');
```

Add to `ci.yml`:
```yaml
- name: Bundle size check
  run: npm run build:analyze -w @quiz/web
```

## Monorepo Touch Points

**apps/web:**
- Modified: all route files → split lazy routes using `createLazyFileRoute`
- Modified: `src/lib/` → add `query-config.ts` and `vitals.ts`
- Modified: `src/main.tsx` → call `initVitals()`
- New: `src/scripts/check-bundle-size.js`
- Add dependency: `web-vitals`, `@tanstack/react-virtual`

**packages/ui:**
- Modified: `QuestionnaireCard` → `React.memo` wrapper
- Modified: `FeedGrid` → optional virtualizer integration

**packages/db:**
- New: `migrations/0002_performance_indexes.sql`

**apps/api:**
- New: `POST /api/vitals` endpoint
- Modified: feed service → add caching for taking and profile endpoints

## Directory Structure

```
apps/web/src/
  lib/
    query-config.ts            ← centralized query staleTime/gcTime config
    vitals.ts                  ← web-vitals initialization and reporting
  scripts/
    check-bundle-size.js       ← CI bundle size enforcement

packages/db/
  migrations/
    0002_performance_indexes.sql

apps/api/src/
  routes/
    vitals.ts                  ← POST /api/vitals endpoint
```

## Implementation Steps

1. **Implement route-based code splitting for lazy routes**
   - Split all non-critical routes into `route.tsx` (config) + `route.lazy.tsx` (component)
   - Verify with Vite build output that lazy chunks are created
   - Measure initial bundle size before and after

2. **Tune TanStack Query cache configuration**
   - Create `apps/web/src/lib/query-config.ts` with all staleTime/gcTime values
   - Update all `useQuery` and `useInfiniteQuery` calls to use `queryConfig.*`

3. **Implement hover-intent prefetch in QuestionnaireCard**
   - Add `mouseenter`/`mouseleave` handlers with 200ms timeout
   - Call `router.preloadRoute()` on hover intent
   - Verify with Network panel that prefetch fires correctly

4. **Wrap QuestionnaireCard in React.memo**
   - Add `React.memo` wrapper with custom comparison function
   - Verify with React DevTools Profiler that cards do not re-render on filter change

5. **Implement virtual scrolling for large feed grids**
   - Add `@tanstack/react-virtual` to `apps/web`
   - Modify `FeedGrid.tsx` to activate virtualizer when `allItems.length > 50`
   - Test with 100+ item feed to verify smooth scrolling

6. **Add lazy loading and dimensions to all images**
   - Audit all `<img>` usage in `apps/web`
   - Add `loading="lazy"` to below-fold images
   - Add explicit `width` and `height` attributes

7. **Audit and extend Cloudflare KV caching**
   - Review existing KV cache coverage from PHASE-13
   - Add caching to `GET /api/questionnaires/:shareToken/take`
   - Add caching to `GET /api/users/:username/profile`
   - Update KV key inventory documentation

8. **Add D1 performance indexes migration**
   - Create `packages/db/migrations/0002_performance_indexes.sql` with all indexes from spec
   - Run `EXPLAIN QUERY PLAN` on top queries to verify index usage
   - Apply migration to preview and production D1

9. **Add web vitals reporting**
   - Install `web-vitals` in `apps/web`
   - Create `apps/web/src/lib/vitals.ts`
   - Call `initVitals()` in `main.tsx`
   - Create `POST /api/vitals` Hono endpoint
   - Verify vitals are logged in Workers Logs

10. **Add Vite bundle size CI check**
    - Create `apps/web/scripts/check-bundle-size.js`
    - Add `build:analyze` script to `apps/web/package.json`
    - Add bundle size check step to `.github/workflows/ci.yml`
    - Verify CI fails correctly when limit is exceeded (test with a temporary large import)

## Tickets to Create

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-1800 | Implement route-based code splitting for all lazy routes | chore | Nova | P0 |
| QZ-1801 | Tune TanStack Query staleTime/gcTime per data type | chore | Nova | P0 |
| QZ-1802 | Implement React.memo for QuestionnaireCard and virtual scrolling for large grids | chore | Nova | P1 |
| QZ-1803 | Add lazy image loading and explicit dimensions to all img elements | chore | Nova | P1 |
| QZ-1804 | Audit and extend Cloudflare KV caching (taking + profile endpoints) | chore | Sage | P1 |
| QZ-1805 | Add D1 composite indexes migration and verify with EXPLAIN QUERY PLAN | chore | Sage | P0 |
| QZ-1806 | Add web vitals reporting (web-vitals package + POST /api/vitals endpoint) | feature | Nova | P2 |
| QZ-1807 | Add Vite bundle size CI check (500KB chunk limit) | chore | Axel | P1 |

## Acceptance Criteria

- [ ] Vite build output shows separate chunks for lazy routes (e.g., `results-[hash].js` separate from main bundle)
- [ ] Initial JS bundle is < 150KB gzipped (measured with `gzip -9` on main chunk)
- [ ] CI `bundle size check` step passes with all chunks under 500KB
- [ ] `QuestionnaireCard` does not re-render when feed filters change (verify with React DevTools Profiler)
- [ ] Feed grid with 100+ items scrolls at 60fps (measure with Chrome DevTools Performance panel)
- [ ] Hovering a questionnaire card for 200ms triggers a prefetch network request for the taking route
- [ ] All `<img>` elements below the fold have `loading="lazy"` attribute
- [ ] `GET /api/questionnaires/:shareToken/take` responds with `X-Cache: HIT` on second request within 10 min
- [ ] D1 EXPLAIN QUERY PLAN for feed query shows index usage (not full table scan)
- [ ] Web vitals are posted to `/api/vitals` and visible in Cloudflare Workers Logs in production
- [ ] LCP measured in Lighthouse is < 2.5s on the homepage

## Out of Scope

- Server-side rendering (SSR) or edge rendering — Cloudflare Pages serves static assets; SSR adds complexity that is out of scope for v1
- Image CDN or resizing service — v1 uses static images; R2 + Cloudflare Images is a follow-up
- Service worker / PWA caching — not in v1
- HTTP/2 push or `<link rel="preload">` for API calls — rely on TanStack Router prefetch instead
- Database connection pooling — not applicable to D1 (serverless model)

## Phase Dependencies

- **PHASE-13 (Homepage Feed) must be complete** because KV caching, feed queries, and the QuestionnaireCard component are all created in that phase — this phase optimizes them
- **PHASE-14 (User Profile & Analytics) must be complete** because Recharts lazy loading and analytics query configuration are included in this phase
- **PHASE-16 (Cloudflare Deployment) must be complete** because bundle size CI check requires the CI workflow, and web vitals reporting requires a deployed Worker

## Agent Assignments

- **Architect:** Write ADR-024 (virtual scrolling threshold), ADR-025 (web vitals reporting endpoint), STANDARD-performance-budget
- **Dev/Nova (Frontend):** QZ-1800, QZ-1801, QZ-1802, QZ-1803, QZ-1806 — all frontend performance work
- **Dev/Sage (Backend):** QZ-1804, QZ-1805 — KV caching and D1 indexes
- **Dev/Milo (Visual/CSS):** No specific tasks; may be consulted on image placeholder CSS approach
- **QA/Ivy:** Run Lighthouse audits before and after performance changes, report Core Web Vitals baseline
- **DevOps/Axel:** QZ-1807 — CI bundle check; monitor Workers Logs for vitals data after deployment
- **Remy (Producer):** Confirm performance budget targets with stakeholders, sign off on Lighthouse scores

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Virtual scrolling breaks infinite scroll intersection observer | Medium | Medium | Test virtual + infinite scroll combination with large dataset in staging before merging |
| TanStack Query staleTime too aggressive causes users to see stale feed | Medium | Low | Start with conservative values (5 min); tune based on web vitals user data after launch |
| Bundle size check false positives for vendor chunks during CI | Low | Low | Exclude `vendor-*.js` chunks from the 500KB limit check; set higher limit for vendor chunks |
| KV cache prevents new questionnaires from appearing in feed for up to 5 minutes | Medium | Low | This is acceptable and documented; creators are told "may take up to 5 minutes to appear" |

## Estimated Effort

M
