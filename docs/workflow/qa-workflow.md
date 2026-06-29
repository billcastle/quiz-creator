# QA Workflow — Ivy's Playbook

## Ivy's Role

Test everything. Break things. File bugs. Do NOT fix bugs — file them as GitHub Issues.

You are the last line of defence before code reaches production. If you sign off and it breaks in prod, that's a shared miss. If you don't sign off and Remy merges anyway, that's on Remy.

---

## When Ivy Gets Involved

1. Dev team opens a PR and tags `ivy-review` label
2. Remy notifies Ivy that a sprint is ready for QA
3. Ivy runs tests, files bugs, and writes sign-off
4. Remy waits for sign-off before merging (blockers = no merge)

---

## Test Suite Commands

```bash
# Run all unit tests (Vitest)
npm run test

# Run unit tests in watch mode (during development)
npm run test:watch

# Run E2E tests (Playwright)
npm run test:e2e

# Run E2E tests with browser visible (debugging)
npm run test:e2e -- --headed

# Run a specific E2E test file
npx playwright test tests/smoke/login.spec.ts

# Generate Playwright report
npx playwright show-report
```

---

## QA Process Per Sprint

### 1. Setup
```bash
git checkout main
git pull origin main
npm install
npm run db:migrate
npm run db:seed     # load test data
npm run dev         # start app in background
```

### 2. Automated tests
```bash
npm run test        # all unit tests — must be 100% pass
npm run test:e2e    # E2E smoke — must pass
```

### 3. Manual playthrough

Walk through every story in `docs/sprint-N/plan.md` as a user. For each story:
- [ ] Happy path works as described
- [ ] Error states are handled gracefully (try invalid inputs)
- [ ] Edge cases (empty cart, zero qty, max length strings, duplicate barcode)
- [ ] No `console.error` or unhandled promise rejections (open DevTools)
- [ ] No visible layout breaks at 1280px and 375px (mobile terminal view)

### 4. File bugs

For every bug found, file a GitHub Issue:

```markdown
**Component:** [e.g. CartPanel, OrderCreation, TableMap]
**Severity:** blocker / major / minor
**Steps to reproduce:**
1. Navigate to /pos/terminal/1
2. Add 3 items to cart
3. Click "Checkout"
4. Enter cash amount less than total

**Expected:** Error message "Insufficient cash"
**Actual:** Page crashes with TypeError

**Environment:** Chrome 125, macOS 14, localhost:3000
```

Labels to add: `bug`, plus ONE of: `severity:blocker`, `severity:major`, `severity:minor`

**Severity guide:**
- `blocker` — prevents core POS operation (login, checkout, order save)
- `major` — feature works but important functionality is broken
- `minor` — cosmetic, edge case, or workaround exists

### 5. Sign-off

Write `docs/qa/sprint-N-signoff.md`:

```markdown
# QA Sign-off — Sprint N
**Date:** YYYY-MM-DD
**Tester:** Ivy

## Test Results
- Unit tests: X/X passing
- E2E tests: X/X passing
- Manual playthrough: completed

## Issues Filed
- #12 — [blocker] Order creation crashes when tip > total
- #13 — [minor] Product grid misaligned on 375px

## Verdict
❌ BLOCKED — blocker issue #12 must be resolved before merge
# OR
✅ PASS — minor issues filed; safe to merge
```

Report to Remy: share the sign-off path and verdict.

---

## Test File Locations

```
tests/
  smoke/
    login.spec.ts         ← POS login flow (Sprint 0)
    checkout.spec.ts      ← Order creation (Sprint 2)
    table-map.spec.ts     ← Table management (Sprint 3)
  unit/
    transform/
      money.test.ts       ← toCents(), formatPrice()
      date.test.ts
      status.test.ts
    lib/
      currency.test.ts
      orders.test.ts      ← Sprint 2
```

---

## Playwright Tips

### Waiting for elements (not sleep)
```ts
// Good — wait for specific element
await page.waitForSelector('[data-testid="cart-total"]');

// Bad — arbitrary sleep
await page.waitForTimeout(2000);
```

### SSE testing (table state)
```ts
// Connect to SSE and collect events for 5 seconds
const events: string[] = [];
page.on('response', async (response) => {
  if (response.url().includes('/api/pos/tables/sse')) {
    const body = await response.text();
    events.push(body);
  }
});
```

### Test data attributes
Dev team adds `data-testid` attributes to interactive elements:
- `data-testid="login-submit"`
- `data-testid="cart-panel"`
- `data-testid="checkout-button"`
- `data-testid="product-grid"`

Use these in Playwright selectors — never CSS class selectors (they change).

---

---

## Offline Mode Testing (Sprint 7+)

Offline-first is a hard requirement (see ADR-007). Every sprint from Sprint 7 onward must include an offline regression pass.

### Prerequisites

Service Worker must be registered before offline tests run:
```bash
npm run build && npm run start  # SW only registers in production build
# Do NOT use npm run dev for offline testing — SW is disabled in dev
```

### Chrome DevTools offline simulation

```
DevTools → Application → Service Workers → verify "Activated and running"
DevTools → Network → throttle dropdown → "Offline"
```

Playwright equivalent:
```ts
await context.setOffline(true)   // simulate offline
await context.setOffline(false)  // restore network
```

### Offline test scenarios (mandatory per sprint)

#### OT-01 — Create order offline
```ts
test('creates order while offline and syncs on reconnect', async ({ context, page }) => {
  await page.goto('/pos/terminal/1')
  await page.waitForSelector('[data-testid="product-grid"]')

  // Go offline
  await context.setOffline(true)
  await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible()

  // Add items and create order
  await page.click('[data-testid="product-grid"] >> nth=0')
  await page.click('[data-testid="checkout-button"]')
  await page.click('[data-testid="payment-cash"]')

  // Order created with temporary client ID
  await expect(page.locator('[data-testid="pending-sync-badge"]')).toBeVisible()

  // Come back online
  await context.setOffline(false)
  await expect(page.locator('[data-testid="sync-toast"]')).toBeVisible({ timeout: 10000 })

  // Verify real order number assigned (not a UUID)
  const orderNum = await page.locator('[data-testid="order-number"]').textContent()
  expect(orderNum).toMatch(/^#\d+$/)  // real sequential number, not UUID
})
```

#### OT-02 — No duplicate orders on re-sync
```ts
test('does not create duplicate orders when sync retries', async ({ context, page }) => {
  // Go offline, create order
  await context.setOffline(true)
  await createTestOrder(page)

  // Come online, disconnect again before sync completes
  await context.setOffline(false)
  await page.waitForTimeout(500)
  await context.setOffline(true)
  await context.setOffline(false)

  // Should have exactly 1 order (idempotency check)
  await page.waitForSelector('[data-testid="sync-complete"]')
  const orders = await page.locator('[data-testid="order-row"]').count()
  expect(orders).toBe(1)
})
```

#### OT-03 — Card payment blocked offline
```ts
test('card payment is disabled with clear message when offline', async ({ context, page }) => {
  await page.goto('/pos/terminal/1')
  await context.setOffline(true)

  await createTestOrder(page)
  await page.click('[data-testid="checkout-button"]')

  // Card button disabled, not hidden
  const cardBtn = page.locator('[data-testid="payment-card"]')
  await expect(cardBtn).toBeDisabled()
  await expect(cardBtn).toBeVisible()

  // Cash still works
  await expect(page.locator('[data-testid="payment-cash"]')).toBeEnabled()
})
```

#### OT-04 — Offline banner visibility and pending count
```ts
test('offline banner shows and counts pending operations', async ({ context, page }) => {
  await page.goto('/pos/terminal/1')
  await context.setOffline(true)

  await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible()

  // Perform 2 operations
  await createTestOrder(page)
  await createTestOrder(page)

  await expect(page.locator('[data-testid="pending-count"]')).toHaveText('2')
})
```

#### OT-05 — Table assignment offline
```ts
test('table assignment persists offline and syncs', async ({ context, page }) => {
  await page.goto('/pos/tables')
  await context.setOffline(true)

  await page.click('[data-testid="table-3"]')
  await page.click('[data-testid="assign-table"]')

  // Table shows occupied locally
  await expect(page.locator('[data-testid="table-3"]')).toHaveClass(/occupied/)

  // Sync
  await context.setOffline(false)
  await page.waitForSelector('[data-testid="sync-complete"]')

  // Reload and verify server has the assignment
  await page.reload()
  await expect(page.locator('[data-testid="table-3"]')).toHaveClass(/occupied/)
})
```

#### OT-06 — SSE disconnects cleanly offline
```ts
test('SSE shows offline state when network drops', async ({ context, page }) => {
  await page.goto('/pos/tables')
  await expect(page.locator('[data-testid="sse-status"]')).toHaveText('Live')

  await context.setOffline(true)
  await expect(page.locator('[data-testid="sse-status"]')).toHaveText('Offline', { timeout: 8000 })

  await context.setOffline(false)
  await expect(page.locator('[data-testid="sse-status"]')).toHaveText('Live', { timeout: 8000 })
})
```

### Offline manual test checklist (Sprint 7+)

Run after every automated pass. Simulate network loss via DevTools → Network → Offline:

- [ ] Offline banner appears within 2 seconds of going offline
- [ ] Pending operation counter increments correctly
- [ ] Orders created offline appear in order history with "(pending)" label
- [ ] Cash payment completes offline without error
- [ ] Card payment button is disabled (not crashing), has tooltip
- [ ] Table map reflects local state while offline
- [ ] Kitchen display shows "offline" state — no crash
- [ ] Page refresh while offline: pending operations survive (IndexedDB persistent)
- [ ] Network returns: banner disappears within 5 seconds
- [ ] Sync toast fires with correct count
- [ ] Synced orders get real sequential order numbers
- [ ] No ghost/duplicate orders after sync
- [ ] Negative stock alert fires if oversold offline (verify in reports)

### Service Worker health checks

Before any offline test run, verify SW is healthy:

```ts
// Check SW is registered and active
const swState = await page.evaluate(() => navigator.serviceWorker.controller?.state)
expect(swState).toBe('activated')

// Verify IndexedDB exists
const hasDb = await page.evaluate(async () => {
  const dbs = await indexedDB.databases()
  return dbs.some(db => db.name === 'sahabat-pos-offline')
})
expect(hasDb).toBe(true)
```

### Offline test file location

```
tests/
  offline/
    create-order.spec.ts       ← OT-01, OT-02
    payment-offline.spec.ts    ← OT-03
    banner-sync.spec.ts        ← OT-04
    table-offline.spec.ts      ← OT-05
    sse-offline.spec.ts        ← OT-06
```

### Bugs Ivy files for offline failures

If offline sync produces a duplicate order → `severity:blocker`  
If offline banner doesn't appear → `severity:major`  
If card payment button is hidden (not disabled) → `severity:major`  
If pending operations lost on page refresh → `severity:blocker`  
If sync takes >30 seconds on reconnect → `severity:major`

---

## Things Ivy Does NOT Do

- Edit application code in `src/` or `db/`
- Fix bugs (file them, let Sage handle it)
- Merge PRs (Remy does that)
- Approve PRs that have open `severity:blocker` issues
