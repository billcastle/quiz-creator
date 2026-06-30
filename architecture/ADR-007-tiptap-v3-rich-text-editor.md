---
title: "ADR-007: TipTap v3 as rich text editor"
status: "Accepted"
date: "2026-06-30"
authors: "billcastle_bose"
tags: ["architecture", "decision", "design-system", "rich-text"]
supersedes: ""
superseded_by: ""
---

# ADR-007: TipTap v3 as rich text editor

## Context

QZ-0002 required a rich text editing component (`RichTextEditor`) to support formatted question and answer content. Required capabilities at QZ-0002 scope: Bold, Italic, BulletList, OrderedList. The component must be fully styleable via Tailwind utilities and CSS custom properties from the Questify token set — any library that ships its own stylesheet is a liability.

Candidates evaluated:

| Library | Headless | React 19 | Maintenance |
|---|---|---|---|
| TipTap v3 | Yes | Yes | Active |
| Quill | No | No | Low (last major release 2019) |
| Draft.js | Partial | No | Archived by Meta |
| Slate | Yes | Uncertain | Active, but API churn between minor versions |
| Lexical | Yes | Yes | Active (Meta), smaller extension ecosystem |

React 19 support is a hard requirement — `apps/web` targets React 19.

## Decision

TipTap v3 (`@tiptap/react` + `@tiptap/starter-kit`) is the rich text editing library for Questify. No TipTap stylesheet is imported — the editor is used in headless mode. All visual chrome (toolbar, focus ring, content area) is styled exclusively via Tailwind classes and `var(--color-*)` tokens. Extensions are loaded from `@tiptap/starter-kit` and selectively enabled per editor instance.

## Consequences

### Positive

- **POS-001**: Fully headless — no default stylesheet. `RichTextEditor` owns all visual styling through Tailwind and design tokens. Theme switching works without special handling in the editor.
- **POS-002**: Composable extension model — each formatting capability is an independent extension. Future capabilities (tables, images, custom blocks) are added by enabling new extensions without rewriting the base component.
- **POS-003**: ProseMirror document model is well-understood with large community support; low-level customization is possible if TipTap's API surface falls short.
- **POS-004**: Editor output is an HTML string (`editor.getHTML()`), a portable format that any Questify consumer can use without a custom deserializer.
- **POS-005**: TipTap v3 explicitly supports React 19, removing a compatibility risk.

### Negative

- **NEG-001**: Editor output is an HTML string. **Every surface that renders user-supplied editor output must sanitize it before rendering to prevent XSS.** This is a standing obligation for all consumers of `RichTextEditor` output.
- **NEG-002**: Debugging deep editor behavior requires understanding ProseMirror internals, which have a steep learning curve.
- **NEG-003**: `@tiptap/starter-kit` bundles all starter extensions. Teams needing a minimal bundle must replace it with individually imported extensions — a future optimization, not a launch blocker.

## Alternatives Considered

### Quill (rejected)

- **ALT-001**: **Description**: A rich text editor with a fixed HTML output format and its own default stylesheet.
- **ALT-001**: **Rejection reason**: Ships a heavy default stylesheet that conflicts with the Questify design system. No React 19 support. Minimal maintenance activity since 2019.

### Draft.js (rejected)

- **ALT-002**: **Description**: A React-controlled rich text editor originally built by Meta.
- **ALT-002**: **Rejection reason**: Archived by Meta. No future security patches or React compatibility updates.

### Slate (rejected)

- **ALT-003**: **Description**: A headless, fully customizable rich text framework built on React.
- **ALT-003**: **Rejection reason**: Major API surface churn between minor versions. No official extension registry — extensions are hand-rolled. High long-term maintenance cost.

### Lexical (rejected)

- **ALT-004**: **Description**: Meta's actively maintained headless editor with React 19 support.
- **ALT-004**: **Rejection reason**: Smaller third-party extension ecosystem than TipTap at evaluation time. Reconsider if TipTap v3 stability issues emerge.

## Implementation Notes

- **IMP-001**: `RichTextEditor` lives at `packages/ui/src/components/molecules/RichTextEditor.tsx`. Accepts `content: string` (initial HTML) and `onChange: (html: string) => void`.
- **IMP-002**: Extensions in use at QZ-0002: Bold, Italic, BulletList, OrderedList (via StarterKit with unused extensions disabled via `configure()`).
- **IMP-003**: **XSS obligation**: All consumers of `RichTextEditor` output that render the HTML string in the DOM must sanitize it. Enforcement: code review. A dedicated HTML sanitization STANDARD will be created when the first rendering surface ships.
- **IMP-004**: `immediatelyRender: false` is set on the TipTap editor instance to silence the SSR hydration warning in React StrictMode.

## References

- **REF-001**: [ADR-008-shadcn-ui-component-foundation.md](ADR-008-shadcn-ui-component-foundation.md) — `RichTextEditor` is a custom molecule outside the shadcn layer, but uses the same token-based styling approach.
- **REF-002**: [STANDARD-design-token-styling.md](STANDARD-design-token-styling.md) — `RichTextEditor` toolbar and chrome must use `var(--color-*)` tokens.
