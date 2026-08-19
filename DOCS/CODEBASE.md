# Codebase Architecture

Key Stash Manager is a local-first secrets manager. This doc describes the
**current, as-built** architecture of the frontend data layer after the
TanStack DB migration (2026-08). Planning docs in `DOCS/feat/` and
`DOCS/lib/` describe options considered along the way — some were not
chosen (e.g. master-password vaults) or use a hallucinated API
(`DOCS/lib/tanstack-sqlite.md`'s `createDB({tables})` doesn't exist). This
file is the source of truth for what's actually built; when in doubt, trust
the code over those planning docs.

## Stack

- **Frontend**: React 18 + TypeScript (strict), Vite, React Router, shadcn/ui
  + Radix, TailwindCSS.
- **Client data layer**: `@tanstack/db` + `@tanstack/react-db` (reactive
  collections, `useLiveQuery`), persisted via
  `@tanstack/browser-db-sqlite-persistence` (wa-sqlite compiled to WASM,
  running in OPFS via a dedicated Worker).
- **Backend**: Express.js + Zod (`server.js`), optional whole-blob JSON sync
  only — see [Sync](#sync-serverjs).
- **Tests**: Vitest (unit) + Playwright (e2e smoke tests).

## Data model

Four flat, relational TanStack DB collections replace the old nested
`Profile → Folder → Secret` tree (`frontend/src/lib/db/schema.ts`):

```
profiles: { id, name, createdAt, updatedAt }
folders:  { id, profileId, name, order? }        -- FK: profileId
secrets:  { id, folderId, name, value, description?, createdAt, updatedAt, order? }  -- FK: folderId
config:   { key, value }                          -- KV store
```

- `secrets.value` always holds **ciphertext** (base64(iv || AES-GCM
  ciphertext)). Never plaintext at rest. See [Encryption](#encryption).
- `config` holds `currentProfileId`, `selectedFolderId`, and a
  `seedComplete` marker — reactive and persisted, so switching profiles/
  folders survives reloads and multi-tab sessions.
- `order` columns exist on `folders`/`secrets` for a future drag-and-drop
  reordering feature (not yet built — no UI consumes them today).
- **No `tags` field anywhere.** Removed end-to-end in the migration.

There's also a separate, hand-written **nested wire format**
(`frontend/src/types/index.ts`: `Secret`/`Folder`/`Profile`/`SecretsData` +
matching Zod schemas) used only for JSON import/export and `/api/sync`
payloads. `frontend/src/lib/db/importExport.ts` converts between the two:
`buildNestedSecretsData` (flatten→decrypt, for export/push) and
`flattenAndUpsert`/`importAllFromJson`/`importSingleProfile` (parse→
encrypt→upsert, for import/pull).

## Directory map

```
frontend/src/lib/db/
  schema.ts        Zod row schemas + inferred types (ProfileRow, FolderRow, SecretRow, ConfigRow) + CONFIG_KEYS
  collections.ts    Bootstraps the 4 OPFS-backed collections (memoized), upsertConfig() helper
  migrations.ts     flattenNestedSecretsData (pure), migrateLegacyV1, seedCollectionsIfNeeded (first-run seed)
  importExport.ts   Nested<->flat conversions for JSON import/export and sync push/pull

frontend/src/lib/crypto.ts   AES-GCM encrypt/decrypt + per-device key management

frontend/src/hooks/
  useDb.tsx         DbProvider: bootstraps collections+key+seed, exposes {status, collections, vaultKey, isSyncing}
  useConfig.ts      useConfigValue() - reactive KV get/set over the config collection
  useProfiles.ts    useProfiles/useCurrentProfile/useProfileActions/useProfileFolderSecretCounts
  useFolders.ts     useFoldersForProfile/useFolderSecretCounts/useFolderActions/useSelectedFolderId
  useSecrets.ts     useDecryptedSecretsForFolder (async decrypt layer)/useSecretActions
  useAppState.tsx   AppStateProvider - ephemeral, non-persisted searchTerm
  useSync.tsx       /api/sync push/pull (plaintext at the transport boundary)
```

There is no more `src/store/` — the old Zustand `secretsStore.ts` was
deleted. `zustand` is not a dependency anymore.

## Reactivity pattern

Components never touch collections directly. They call the hooks above,
which wrap `useLiveQuery` (from `@tanstack/react-db`) and mutation actions
(`.insert`/`.update`/`.delete` on the underlying collections). Example
pattern used throughout:

```ts
const { data } = useLiveQuery((q) =>
  q.from({ secrets: collections.secrets })
   .where(({ secrets }) => eq(secrets.folderId, folderId)),
);
```

`.update(key, (draft) => { draft.field = x })` is **Immer-style** — mutate
the draft, don't return a replacement object.

Cascade deletes (deleting a profile/folder must also delete its
folders/secrets) are handled manually in `useProfileActions`/
`useFolderActions` — collections don't cascade foreign keys.

## Encryption

"Basic" client-side encryption at rest, chosen over a master-password vault
to avoid an unlock-screen UX: a random, **non-extractable** AES-256-GCM key
is generated on first run (`crypto.subtle.generateKey(..., false, [...])`)
and stored as a `CryptoKey` object directly in **IndexedDB**
(`key-stash-manager-keys` / store `keys`) — deliberately **not** colocated
with the SQLite/OPFS file, so copying just the DB doesn't also give you the
key. Non-extractable means the raw key bytes can never be read out (not
even by this app's own code) — only used via `crypto.subtle`. No password
prompt.

Users from before this hardening may still have an *extractable* JWK in
`localStorage` under `key-stash-manager-vault-key` — `getOrCreateVaultKey`
(`lib/crypto.ts`) migrates that into a non-extractable IndexedDB key on
first read and deletes the localStorage copy, so already-encrypted data
stays decryptable. `getOrCreateVaultKey` is wrapped in an in-flight-promise
guard (same pattern as `seedPromise` below) so concurrent first-run callers
share one generate/migrate/store operation instead of racing.

Only `secrets.value` is encrypted — names, descriptions, folder/profile
names stay plaintext (needed for display/search without decrypting
everything, and they aren't the sensitive payload).

`useDecryptedSecretsForFolder` (in `useSecrets.ts`) is the one place async
decryption meets synchronous `useLiveQuery` snapshots: it takes the
reactive ciphertext rows and decrypts them in a `useEffect`, giving a brief
per-folder-switch loading flicker that a plaintext store didn't have. This
is an accepted, deliberate tradeoff, not a bug.

**Security model**: protects data at rest (e.g. someone reading the raw
OPFS file or a backup) and stops the raw key material itself from being
exfiltrated (non-extractable). Does **not** fully protect against arbitrary
script execution in the same browser origin — injected same-origin script
could still call `crypto.subtle.decrypt` using the key, just not read the
key bytes out (there's no password gate).

## First-run seeding & migration (`lib/db/migrations.ts`)

On first load, `seedCollectionsIfNeeded` picks a data source in priority
order — **this order is load-bearing, don't reorder it**:

1. Real, previously-persisted user data:
   `localStorage["api-key-manager-secrets"]` (the legacy pre-migration
   key). Run through `migrateLegacyV1` (handles the true-V1
   `{folders:[...]}` shape) then `flattenNestedSecretsData`.
2. Dev-only fixture `frontend/mockdata/initdata.json`, gated behind
   `import.meta.env.DEV` so it tree-shakes out of production.
3. Empty default profile (cold start in production).

The legacy localStorage blob is **not deleted** after seeding — kept as an
inert backup.

This whole function is memoized behind a single in-flight promise
(`seedPromise` in `migrations.ts`) because React 18 StrictMode's dev-mode
double-effect-invoke can call it twice concurrently; without the memo, both
calls can pass the "already seeded?" check before either finishes writing,
and the second `.insert()` collides on the same deterministic mockdata IDs.
If you see `DuplicateKeyError` on load, check this hasn't regressed.

## Sync (`server.js`)

`server.js` is unchanged in spirit from before the migration — a plain
Express + Zod, whole-blob JSON-file store (`data/keys.json`), gated by
`VITE_USING_SERVER`/`USING_SERVER`. `/api/sync` always exchanges the
**nested wire format with plaintext values** — encryption-at-rest applies
only to the local wa-sqlite file, not the sync payload. This was a
deliberate scoping decision (see `CLAUDE.md`: client-side-only this
release) — no per-record diffing, no conflict resolution, no
E2E-encrypted transport. That's a distinct, separate roadmap item
(`DOCS/feat/04-e2e-encryption.md`).

## Testing

- `npm test` (Vitest, `frontend/vitest.config.ts`) — unit tests for pure
  logic only: `lib/db/migrations.test.ts` (flatten/legacy-migration),
  `lib/crypto.test.ts` (encrypt/decrypt round-trip, key persistence,
  legacy-JWK→IndexedDB migration). jsdom has no built-in IndexedDB, so
  `vitest.config.ts` loads `fake-indexeddb/auto` via `test.setupFiles` —
  needed by any test that touches the vault key.
- `npm run test:e2e` (Playwright, `frontend/playwright.config.ts`) —
  `e2e/secrets-crud.spec.ts`, `e2e/json-import-export.spec.ts`. Runs
  against `npm run dev` with `VITE_USING_SERVER=false` forced in the
  webServer env (isolated from the real sync backend).
- lucide-react icon class names are `lucide-{kebab-case-name}` — note
  `Trash2` → `lucide-trash2` (no hyphen before the trailing digit), not
  `lucide-trash-2`. Easy to get wrong when writing new e2e selectors.

## Known library gotchas (TanStack DB / wa-sqlite, pre-1.0)

These are documented in code comments at their exact location, summarized
here for orientation:

- **Vite dev server**: `@journeyapps/wa-sqlite` and
  `@tanstack/browser-db-sqlite-persistence` must be in
  `optimizeDeps.exclude` (`frontend/vite.config.ts`) — Vite's dev-mode
  dependency pre-bundler flattens the package and breaks its internal
  `new Worker(new URL(...))` construction, silently serving `index.html`
  instead of the worker script. Production builds are unaffected (Vite's
  build step emits the worker as a real asset chunk).
- **`persistedCollectionOptions`** needs explicit `<T, TKey, TSchema>`
  generics (`frontend/src/lib/db/collections.ts`) — its `getKey` callback
  can't be inferred backward, and omitting `TSchema` defaults it to
  `never`, conflicting with the `schema` field.
- **`createCollection`**, fed that result, has an overload-resolution
  mismatch between the schema type and the schema's *output* type in one
  internal callback signature. Worked around with an isolated `unknown`
  cast in `collections.ts` — a compile-time-only issue (runtime behavior:
  validation, persistence, reactivity — is unaffected).
- **`collection.createIndex(...)`** requires an explicit `indexType`
  (e.g. `{ indexType: BasicIndex }`) — there's no default. Indexes exist
  for `folders.profileId` and `secrets.folderId` to match the
  `where`/`join` clauses used throughout the hooks.
- **Zod type inference requires `strictNullChecks`.** `frontend/
  tsconfig.app.json` used to have `strict: false`; this silently made
  every Zod-inferred field optional regardless of `.optional()` (a
  documented Zod requirement, not a bug). Fixed by enabling `strict: true`
  — verified this doesn't ripple into pre-existing files outside the ones
  touched by this migration.

## Out of scope / follow-ups

- Drag-and-drop folder/secret reordering (schema-ready via `order`
  columns; no DnD library in the project yet).
- Master-password/vault-unlock UX (explicitly not chosen — see
  [Encryption](#encryption)).
- Deeper sync rearchitecture (per-record diffing, conflict resolution).
- E2E-encrypted manual sharing (`DOCS/feat/04-e2e-encryption.md`) — a
  distinct mechanism from at-rest encryption.
