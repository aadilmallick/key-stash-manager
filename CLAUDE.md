# CLAUDE.md

Key Stash Manager is a local-first secrets manager: React/TypeScript frontend,
Express.js backend. Secrets are organized into folders within profiles. Client
data lives in TanStack DB collections persisted to SQLite/OPFS (wa-sqlite),
encrypted at rest, with optional whole-blob JSON sync to the Express server.

**Stack:** React 18 + TypeScript (strict) + Vite + shadcn/ui + Radix +
TailwindCSS · `@tanstack/db`/`@tanstack/react-db` + wa-sqlite/OPFS for client
data · Express + Zod for the optional sync backend.

**Read `DOCS/CODEBASE.md` before making data-layer changes.** It covers the
collection schema, encryption model, reactivity pattern, seeding/migration
order, sync boundary, and a list of real TanStack DB/wa-sqlite/Vite/Zod gotchas
already hit and fixed — check it before re-deriving a fix or reintroducing a
regression (e.g. don't disable `strict` in `tsconfig.app.json`, don't remove
`optimizeDeps.exclude` in `vite.config.ts`).

**Feature backlog:** `DOCS/feat/roadmap.md`.

## Development

We will only focus on client-side for this release, so run
`npm run dev --prefix frontend` and then use chrome devtools MCP to visually
verify everything is working on localhost:5173.

Before considering a data-layer change done:

- `npx tsc --noEmit -p frontend/tsconfig.app.json` (strict mode is intentional —
  see `DOCS/CODEBASE.md`)
- `npm test --prefix frontend` (Vitest unit tests)
- `npm run test:e2e --prefix frontend` (Playwright smoke tests)

Don't be afraid to kill ports as you desire. Kill any ports on 5173, 8888, 5001,
5000, and 3000.

## Conventions

- `collection.update(key, (draft) => { draft.field = x })` is Immer-style —
  mutate the draft, don't return a replacement object.
- Components read/write data only through the hooks in `frontend/src/
  hooks/`
  (`useProfiles`, `useFolders`, `useSecrets`, `useConfig`), never the
  collections directly.
- Only `secrets.value` is encrypted. Don't assume names/descriptions are
  encrypted, and don't add new sensitive fields without also encrypting them
  (`frontend/src/lib/crypto.ts`).
- The nested `Secret`/`Folder`/`Profile`/`SecretsData` types
  (`frontend/src/types/index.ts`) are the wire format for JSON import/ export
  and `/api/sync` only — runtime storage is the flat schema in
  `frontend/src/lib/db/schema.ts`. Don't conflate the two.
