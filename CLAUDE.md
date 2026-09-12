# CLAUDE.md

Key Stash Manager is a local-first secrets manager: React/TypeScript frontend,
Express.js backend. Secrets are organized into folders within profiles. Client
data lives in TanStack DB collections persisted to SQLite/OPFS (wa-sqlite),
encrypted at rest, with optional whole-blob JSON sync to the Express server.
Auth (Clerk) and an OpenAI/OpenRouter spend tracker sit on top,
feature-gated behind a Pro plan — the core secrets workflow itself never
requires an account.

**Stack:** React 18 + TypeScript (strict) + Vite + shadcn/ui + Radix +
TailwindCSS · `@tanstack/db`/`@tanstack/react-db` + wa-sqlite/OPFS for client
data · `@clerk/react` for auth/billing · `react-dnd` for drag-and-drop ·
Express + Zod for the optional sync backend and API-spend proxy.

**Read `DOCS/CODEBASE.md` before making data-layer changes.** It covers the
collection schema, encryption model, reactivity pattern, seeding/migration
order, sync boundary, auth/billing gating, and a list of real TanStack DB/
wa-sqlite/Vite/Zod/react-dnd gotchas already hit and fixed — check it before
re-deriving a fix or reintroducing a regression (e.g. don't disable `strict`
in `tsconfig.app.json`, don't remove `optimizeDeps.exclude` in
`vite.config.ts`, don't loop single-key `.update()` calls to rewrite many
rows — use the batch form). `DOCS/code/api-spend-and-auth.md` has the
deeper narrative behind the proxy architecture and the Clerk
auth/billing/testing-bypass design specifically.

**Feature backlog:** no single active roadmap file right now —
`DOCS/feat/todo` has the small live UI todo list; `DOCS/deprecated/` holds
historical planning docs (options considered, not all of them chosen —
trust the code and `DOCS/CODEBASE.md` over anything in there).

## Development

Run `npm run dev --prefix frontend` and use chrome devtools MCP to visually
verify UI changes on localhost:5173.

**`VITE_IS_TESTING=true`** (set per-command, not in `.env`) skips
`ClerkProvider` entirely and unlocks every auth/billing-gated feature —
reach for it when testing/auditing the API Spend tab or anything behind
`PayWall.tsx` without real Clerk credentials, or when the e2e suite is
flaky for reasons unrelated to auth (see `DOCS/CODEBASE.md`'s Testing
section — Clerk's network load under parallel test workers is a known
source of unrelated flakes).

Before considering a data-layer change done:

- `npx tsc --noEmit -p frontend/tsconfig.app.json` (strict mode is intentional —
  see `DOCS/CODEBASE.md`)
- `npm test --prefix frontend` (Vitest unit tests)
- `npm run test:e2e --prefix frontend` (Playwright smoke tests; try
  `VITE_IS_TESTING=true npm run test:e2e --prefix frontend` too if a
  change touches anything auth/billing-gated)

Don't be afraid to kill ports as you desire. Kill any ports on 5173, 8888, 5001,
5000, and 3000.

## Conventions

- `collection.update(key, (draft) => { draft.field = x })` is Immer-style —
  mutate the draft, don't return a replacement object. When rewriting more
  than one row's field at once (e.g. a drag-and-drop reorder), use the
  batch form `collection.update(keys[], (drafts) => {...})` — a loop of
  single-key updates has actually lost writes under fast reload before.
- Components read/write data only through the hooks in `frontend/src/
  hooks/` (`useProfiles`, `useFolders`, `useSecrets`, `useConfig`,
  `useSpendProviders`, etc.), never the collections directly.
- Only `secrets.value` and `spendProviders.encryptedApiKey` are encrypted.
  Don't assume names/descriptions/labels are encrypted, and don't add new
  sensitive fields without also encrypting them (`frontend/src/lib/
  crypto.ts`).
- The nested `Secret`/`Folder`/`Profile`/`SecretsData` types
  (`frontend/src/types/index.ts`) are the wire format for JSON import/ export
  and `/api/sync` only — runtime storage is the flat schema in
  `frontend/src/lib/db/schema.ts`. Don't conflate the two.
- Auth is feature-gated, not app-wide — don't wrap the core Secrets/
  folders/search UI in a Clerk gate. If a new feature needs an account or
  a paid plan, gate it the same way `PayWall.tsx` gates API Spend, and
  make sure it also respects `VITE_IS_TESTING`.

## Auditing this codebase

Three project subagents exist for deeper passes — invoke via the Agent
tool with `subagent_type` set to one of these:

- **`security-auditor`** — read-only security review (encryption,
  secrets hygiene, the proxy/SSRF surface, auth bypass risks, dependency
  vulnerabilities).
- **`tech-debt-refactorer`** — finds subpar patterns/duplication/missing
  abstractions and proposes concrete before/after fixes with rationale;
  only edits files if explicitly told to.
- **`accessibility-auditor`** — WCAG-style review of the frontend,
  combining static JSX review with live chrome-devtools MCP testing when
  available.

All three produce a written, severity-ranked report by default rather
than silently fixing things.
