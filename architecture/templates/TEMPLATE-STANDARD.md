---
title: "STANDARD: [Standard Name]"
applies_to: "[All | Frontend | Backend | DB | API | Testing]"
status: "Active"
date: "YYYY-MM-DD"
authors: "[Architect/Role]"
enforced_by: "[ESLint rule | CI check | Code review checklist | Build step]"
tags: ["standard"]
related_adrs: ["ADR-NNN-slug.md"]
---

# STANDARD: [Standard Name]

## Rule

> **[The rule in one imperative sentence. Use "Always X" or "Never Y". Be unambiguous.]**

## Rationale

[Why does this standard exist? What incident, ADR decision, or architectural principle drives it? A developer who understands the rationale can apply the rule correctly in edge cases a reviewer may not anticipate.]

## ✅ Correct

```typescript
// Correct — brief comment explaining why this is right
[correct code example]
```

## ❌ Incorrect

```typescript
// Wrong — brief comment explaining what goes wrong here
[incorrect code example]
```

## Enforcement

[Name the specific mechanism that enforces this standard:]

- **Tooling:** `[ESLint rule name]` / `[CI step name]`
- **Code review:** checklist item — "[exact wording reviewers look for]"
- **Build:** `[command that fails if violated]`

If this standard is enforced by convention only (no tooling), explain why and note the review expectation explicitly.

## Exceptions

[Legitimate exceptions to this standard. If there are none, write: "No exceptions."]

[If exceptions exist: name the specific scenario, the alternative approach, and who must approve the exception (Architect / Remy).]

## References

- [ADR or PATTERN that established this rule — relative path]
