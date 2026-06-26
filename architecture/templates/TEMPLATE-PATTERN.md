---
title: "PATTERN: [Pattern Name]"
category: "[Data | API | UI | Auth | Offline | Real-time | Testing | DB]"
status: "Draft"
date: "YYYY-MM-DD"
authors: "[Author/Role]"
tags: ["pattern"]
related_adrs: ["ADR-NNN-slug.md"]
---

# PATTERN: [Pattern Name]

## Intent

[One sentence: what recurring problem does this pattern solve?]

## Motivation

[Why does this pattern exist in this codebase? What goes wrong without it? Describe a concrete scenario where the absence of this pattern causes pain.]

## Structure

[Describe the pattern's shape — the components involved, how they relate, the flow of data or control. Use a diagram or pseudo-code if that is clearer than prose.]

```
[Diagram or structural overview]
```

## Implementation

[Step-by-step instructions for applying this pattern in the Sahabat POS codebase. Be specific about file locations, hook names, and conventions.]

### Step 1 — [Name]

[Detail]

### Step 2 — [Name]

[Detail]

### Example

```typescript
// Real code from this codebase demonstrating the pattern.
// Must be actual working code, not pseudo-code.
// Include the file path as a comment on the first line.
// src/path/to/file.ts
```

## When to Use

- [Condition: use this pattern when X is true]
- [Condition: use this pattern when Y is required]

## When NOT to Use

- [Anti-condition: do not use when Z — use [alternative] instead]
- [Anti-condition: do not use for [scenario] — it adds complexity without benefit]

## Known Uses in This Codebase

- [`src/path/file.ts`](../../src/path/file.ts) — [brief description of how the pattern is applied here]

## Related Documents

- [ADR-NNN-slug.md](ADR-NNN-slug.md) — decision that established this pattern
- [STANDARD-slug.md](STANDARD-slug.md) — standards this pattern enforces
