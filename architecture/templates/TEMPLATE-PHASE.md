---
phase: NN
title: "Phase Title"
status: pending
depends_on: ["PHASE-XX"]   # empty array [] if no dependencies
estimated_tickets: N
---

# PHASE-NN — Phase Title

## Overview

[2–3 paragraphs explaining what this phase achieves and why it matters at this point in the build. A new agent or developer should be able to understand the goal and motivation without reading prior phases. Mention what state the project is in when this phase begins and what state it will be in when complete.]

---

## Goals

- [ ] Specific, measurable goal 1 — what exactly gets built or documented
- [ ] Goal 2
- [ ] Goal 3

---

## Architecture Decisions Required

ADRs and STANDARDs that MUST be written during this phase. Format each as:

**ADR-NNN: [Title]** — one-line description of what the decision is about.  
**STANDARD-[slug]:** — what the standard covers and who it applies to.

If this phase requires no new ADRs or STANDARDs, write: *None — all relevant decisions are captured in prior phases.*

---

## Technical Architecture

### [Sub-section Name]

[Detailed technical specification. Be specific — agents will use this to write actual code. Include:]
- Configuration details (exact config file shapes)
- Key TypeScript interfaces/types
- Contracts between systems (API shapes, function signatures)
- Important constraints and rules ("must", "never", "always")
- File naming expectations

### [Another Sub-section]

[Continue as needed. One sub-section per major concern area.]

---

## Monorepo Touch Points

| Package / App | Change type | Description |
|---|---|---|
| `apps/web` | New files / Modified | What changes |
| `apps/api` | New files / Modified | What changes |
| `packages/ui` | New files / Modified | What changes |
| `packages/db` | New files / Modified | What changes |
| `packages/shared` | New files / Modified | What changes |

---

## Directory Structure

New files and folders to create. Annotate each.

```
apps/web/src/
  routes/
    example-route.tsx       ← description
  components/
    example-component.tsx   ← description
apps/api/src/
  routes/
    example.ts              ← description
```

---

## Implementation Steps

Numbered atomic steps. Each step should roughly correspond to one ticket. Use sub-steps for complex steps.

1. **Step Title**
   - Sub-step a: specific action
   - Sub-step b: specific action
   - Deliverable: what proves this step is done

2. **Step Title**
   - Sub-step a
   - Deliverable: what proves this step is done

3. **Step Title**
   - ...

---

## Tickets to Create

Create these tickets at phase kick-off. `QZ-XXXX` are placeholders — assign real IDs from `docs/tickets/` at that time.

| Placeholder | Title | Type | Assigned | Priority |
|---|---|---|---|---|
| QZ-XXXX | Title of ticket | feature / chore / spike | Nova / Sage / Milo / Ivy / Axel | P0 / P1 / P2 |
| QZ-XXXX | Title of ticket | feature | Nova | P1 |

---

## Acceptance Criteria

The phase is complete when ALL of the following are true:

- [ ] Specific, testable criterion — observable outcome, not "build X"
- [ ] All tickets for this phase are `status: done`
- [ ] QA (Ivy) has signed off on all feature tickets
- [ ] README.md updated by Rex to reflect any new setup steps or env vars
- [ ] Phase status in `architecture/TAXONOMY.md` updated to `complete`

---

## Out of Scope

- **Thing A** — addressed in PHASE-XX; do not implement here even if it seems related
- **Thing B** — explicitly excluded for [reason]; will be revisited in PHASE-YY

---

## Phase Dependencies

- **PHASE-XX must be complete** because [specific reason — what exactly does this phase need from PHASE-XX]

If this phase has no dependencies: *None — this phase can begin independently.*

---

## Agent Assignments

| Agent | Responsibility in this phase |
|---|---|
| **Architect** | [What architectural decisions or reviews they own] |
| **Dev / Nova (Frontend)** | [Frontend files, components, pages they build] |
| **Dev / Sage (Backend)** | [API routes, services, DB queries they implement] |
| **Dev / Milo (Visual)** | [CSS, design system, visual polish work] |
| **QA / Ivy** | [What they test, what Playwright tests they write] |
| **DevOps / Axel** | [Infrastructure, deployment, CI/CD changes they make] |
| **Remy (Producer)** | [Tickets they create, reviews they coordinate, phase they close] |
| **Rex (README)** | [README sections to update after phase completes] |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| [Risk description] | High / Med / Low | High / Med / Low | [Concrete mitigation action] |
| [Risk description] | High / Med / Low | High / Med / Low | [Concrete mitigation action] |

---

## Estimated Effort

**S** (< 1 day) / **M** (1–3 days) / **L** (3–7 days) / **XL** (1–2 weeks)

Rationale: [brief justification for the estimate]
