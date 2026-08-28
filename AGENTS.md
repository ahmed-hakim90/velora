<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- CODEX-PRODUCT-FOUNDATION:START -->
# Project Agent Rules

Read the relevant `docs/` files before changing product UI or shared architecture.

- Understand the affected journey, users, roles, permissions, data contracts, and downstream impact before coding.
- Diagnose root causes before UI workarounds. Preserve business logic unless explicitly asked to change it.
- Search and reuse existing tokens, components, patterns, validation, and domain logic before creating alternatives.
- Keep work mobile-first; verify RTL/LTR where supported or plausible using logical layout properties.
- Do not add arbitrary visual values, duplicate patterns, decorative clutter, generic AI-looking UI, or unnecessary dependencies.
- Cover loading, empty, error, partial, stale, disabled, validation, success, and permission states.
- Preserve semantics, keyboard access, focus, contrast, accessible names, touch targets, and reduced motion.
- Review performance, query/caching behavior, asset weight, render cost, and cross-screen regressions.
- Record durable decisions in `docs/`. Do not mass-redesign.
- Completion requires targeted tests and rendered visual QA across mobile, tablet, laptop, and desktop; compilation alone is insufficient.
<!-- CODEX-PRODUCT-FOUNDATION:END -->
