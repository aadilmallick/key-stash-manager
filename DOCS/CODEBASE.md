# Codebase Architecture

Key Stash Manager is a local-first secrets manager. This doc describes the
**current, as-built** architecture after the TanStack DB migration
(2026-08) and the auth/billing, API Spend, and UI-features work that
followed (2026-09: Clerk auth + billing paywall, an OpenAI/OpenRouter spend
tracker with a dual-runtime proxy, checkbox multi-select + export, global
search, and drag-and-drop reordering). Historical planning docs under
`DOCS/deprecated/` describe options considered along the way — some
weren't chosen (e.g. master-password vaults), and some (`DOCS/lib/
tanstack-sqlite.md`) describe a hallucinated API that was never real. This
file is the source of truth for what's actually built; when in doubt,
trust the code over those planning docs. For the deeper architectural
narrative behind auth/billing and the API Spend proxy specifically, see
`DOCS/code/api-spend-and-auth.md`.

## Stack

- **Frontend**: React 18 + TypeScript (strict), Vite, React Router, shadcn/ui
  + Radix, TailwindCSS.
- **Client data layer**: `@tanstack/db` + `@tanstack/react-db` (reactive
  collections, `useLiveQuery`), persisted via
  `@tanstack/browser-db-sqlite-persistence` (wa-sqlite compiled to WASM,
  running in OPFS via a dedicated Worker).
- **Auth & billing**: `@clerk/react` — sign-in/sign-up, and Clerk Billing
  gating the API Spend tab behind a Pro plan. See
  [Auth & billing](#auth--billing-clerk) below and `DOCS/code/
  api-spend-and-auth.md` for the full picture.
- **Drag-and-drop**: `react-dnd` + `react-dnd-html5-backend` (desktop
  mouse-only; no touch/keyboard backend).
- **Backend**: Express.js + Zod (`server.js`) for optional whole-blob JSON
  sync, plus a stateless CORS-bypass proxy for API Spend shared between
  `server.js` and a Netlify Function — see
  [Sync](#sync-serverjs) and `DOCS/code/api-spend-and-auth.md`.
- **Tests**: Vitest (unit) + Playwright (e2e smoke tests).

## Data model

Five flat, relational TanStack DB collections (`frontend/src/lib/db/
schema.ts`):

```
profiles:       { id, name, createdAt, updatedAt }
folders:        { id, profileId, name, order? }        -- FK: profileId
secrets:        { id, folderId, name, value, description?, createdAt, updatedAt, order? }  -- FK: folderId
config:         { key, value }                          -- KV store
spendProviders: { id, provider ("openai"|"openrouter"), label?, encryptedApiKey, budgetUsd?, lastSnapshot?, lastError?, createdAt, updatedAt }
```

- `secrets.value` always holds **ciphertext** (base64(iv || AES-GCM
  ciphertext)). Never plaintext at rest. See [Encryption](#encryption).
- `spendProviders.encryptedApiKey` follows the same convention as
  `secrets.value`. `lastSnapshot` (a `JSON.stringify`'d `SpendSnapshot`)
  is **not** encrypted — spend numbers aren't sensitive the way a billing
  key is. `spendProviders` is global, not scoped to `profileId` — billing
  keys belong to an account, not a profile — and is deliberately excluded
  from JSON import/export, `/api/sync`, and the manual E2E share feature
  (nothing generically iterates `Collections`, so this was a no-op scope
  cut, not extra code).
- `config` holds `currentProfileId`, `selectedFolderId`, and a
  `seedComplete` marker — reactive and persisted, so switching profiles/
  folders survives reloads and multi-tab sessions.
- `order` columns on `folders`/`secrets` are now **live** — drag-and-drop
  reordering (`FolderSidebar.tsx`/`SecretRow.tsx`) reads and writes them.
  See [Drag-and-drop](#drag-and-drop-react-dnd) for the one real gotcha
  hit while building this.
- **No `tags` field anywhere.** Removed end-to-end in the TanStack DB
  migration.

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
  schema.ts        Zod row schemas + inferred types (Profile/Folder/Secret/Config/SpendProviderRow) + CONFIG_KEYS
  collections.ts    Bootstraps the 5 OPFS-backed collections (memoized), upsertConfig() helper
  migrations.ts     flattenNestedSecretsData (pure), migrateLegacyV1, seedCollectionsIfNeeded (first-run seed)
  importExport.ts   Nested<->flat conversions for JSON import/export and sync push/pull

frontend/src/lib/crypto.ts           AES-GCM encrypt/decrypt + per-device key management
frontend/src/lib/e2eShare.ts         One-time-key manual encrypted share (separate from at-rest encryption)
frontend/src/lib/reorder.ts          Pure computeReorderedIds() - shared by folder/secret drag-and-drop
frontend/src/lib/secretFilter.ts     SecretFilter/SecretFilterBuilder - global search's filter logic (pure, unit-tested)
frontend/src/lib/secretExportFormat.ts  Shell-safe .env / `export KEY=VALUE` line formatting for the export modal
frontend/src/lib/dnd/itemTypes.ts    react-dnd ItemTypes + DraggedFolderItem/DraggedSecretItem shapes
frontend/src/lib/spend/              Provider-adapter abstraction for API Spend (types/registry/openai/openrouter/proxyClient)
frontend/src/lib/config/             env.ts (verifyEnv + VITE_* accessors incl. VITE_IS_TESTING), config.ts (Clerk plan slugs)

frontend/src/hooks/
  useDb.tsx                 DbProvider: bootstraps collections+key+seed, exposes {status, collections, vaultKey, isSyncing}
  useConfig.ts               useConfigValue() - reactive KV get/set over the config collection
  useProfiles.ts             useProfiles/useCurrentProfile/useProfileActions/useProfileFolderSecretCounts
  useFolders.ts              useFoldersForProfile/useAllFolders/useFolderSecretCounts/useFolderActions (incl. reorderFolders)/useSelectedFolderId
  useSecrets.ts               useDecryptedSecretsForFolder/useSecretValueDecryptor/useSecretActions (incl. reorderSecretsInFolder, findDuplicateInFolder, moveSecretToFolder)
  useSecretSelection.ts       Ephemeral checkbox-selection state, shared by the Secrets list and global search results
  useGlobalSecretSearch.ts   Cross-collection join (secrets+folders+profiles) filtered by a SecretFilter
  useGlobalHotkey.ts          Hand-rolled Ctrl/Cmd+<key> listener (not @tanstack/hotkeys - see gotchas)
  useSpendProviders.ts        useSpendProviders/useSpendProviderActions (add/refresh/updateBudget/deleteProvider)
  useAppState.tsx             AppStateProvider - ephemeral, non-persisted searchTerm
  useSync.tsx                 /api/sync push/pull (plaintext at the transport boundary)

frontend/src/components/
  FolderSidebar.tsx           Folder list + FolderRowItem (drag source + drop target: reorder, or accept a dragged secret)
  SecretsList.tsx             Secret list for the selected folder + checkbox selection + Export Selected
  secrets/SecretRow.tsx       One secret row (extracted so useDrag/useDrop can be called per-row)
  secrets/ExportSecretsModal.tsx  3-tab export modal (Download .env / View .env / Export statements)
  search/GlobalSearchModal.tsx    Ctrl/Cmd+K cross-profile/folder search, reuses ExportSecretsModal
  auth/AuthControls.tsx       Header Sign in/Sign up/UserButton, no-ops under VITE_IS_TESTING
  spend/                      SpendTab, SpendProviderCard, AddSpendProviderModal, PayWall

frontend/netlify/functions/
  proxy-spend.mts             Thin Netlify Function wrapper around the shared proxy logic
  _shared/spendProxy.cjs      The actual proxy logic, shared with server.js's /api/proxy-spend route
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
the draft, don't return a replacement object. `.update()` also has a
**batch form** — `update(keys[], (drafts) => { ... })` applies one
transaction across every key. Prefer it over looping single-key updates
when rewriting many rows at once (see the drag-and-drop gotcha below for
why this isn't just a style preference).

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

Only `secrets.value` (and `spendProviders.encryptedApiKey`, following the
same convention) is encrypted — names, descriptions, folder/profile names,
and spend snapshots stay plaintext (needed for display/search without
decrypting everything, and they aren't the sensitive payload).

`useDecryptedSecretsForFolder` (in `useSecrets.ts`) is the one place async
decryption meets synchronous `useLiveQuery` snapshots: it takes the
reactive ciphertext rows and decrypts them in a `useEffect`, giving a brief
per-folder-switch loading flicker that a plaintext store didn't have. This
is an accepted, deliberate tradeoff, not a bug. `useSecretValueDecryptor`
is the on-demand sibling used by global search - it decrypts exactly one
secret's value, lazily, only when a result row is explicitly unmasked, so
typing a search query never decrypts the whole vault.

**Security model**: protects data at rest (e.g. someone reading the raw
OPFS file or a backup) and stops the raw key material itself from being
exfiltrated (non-extractable). Does **not** fully protect against arbitrary
script execution in the same browser origin — injected same-origin script
could still call `crypto.subtle.decrypt` using the key, just not read the
key bytes out (there's no password gate).

## Auth & billing (Clerk)

`App.tsx` conditionally mounts `<ClerkProvider publishableKey={env.
VITE_CLERK_PUBLISHABLE_KEY()}>` around the whole app. Auth is
**feature-gated, not app-wide** — Secrets/folders/search/export/
drag-and-drop all work with no account, matching the local-first design;
only the API Spend tab (`PayWall.tsx`) requires sign-in + the Pro plan
(`config.payments.varstashProPlanKey`, checked via `useAuth().has({plan})`).
`AuthControls.tsx` in the header is optional sign-in/sign-up/account UI,
not a gate.

**`VITE_IS_TESTING`** (`lib/config/env.ts`) is a full bypass, set per-run
rather than baked into `.env`: when true, `ClerkProvider` is never mounted
at all (not just the plan check), and `AuthControls`/`PayWall` both check
the flag *before* calling any Clerk hook/component, since none of them
work without a mounted `ClerkProvider` ancestor. This means testing-mode
runs have **zero** Clerk network dependency, not just a bypassed check.
See `DOCS/code/api-spend-and-auth.md` for the full rationale and how it's
used in Playwright.

## API Spend

A client-side OpenAI/OpenRouter spend tracker behind a small
`ProviderAdapter` abstraction (`lib/spend/`), gated by the Pro plan
(above). Needs a proxy because browsers can't call `api.openai.com`/
`openrouter.ai` directly (no permissive CORS). The proxy logic lives in
exactly one place (`netlify/functions/_shared/spendProxy.cjs`) and is
shared, unmodified, by both a Netlify Function and an Express route in
`server.js` — see `DOCS/code/api-spend-and-auth.md` for why that file is
`.cjs`, how the SSRF risk of a generic pass-through proxy is closed
(the two upstream URLs are hardcoded server-side; the client can never
supply an arbitrary URL), and how each of the three deployment modes
(plain `vite dev`, `netlify dev`, Docker/Express) behaves.

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

`seedCollectionsOnce` also `await`s `collections.config.preload()` before
reading `SEED_COMPLETE` — without it, a **fresh** `Collections` instance
(e.g. a backgrounded tab getting discarded and reloaded, not just true
first launch) can read the config collection before it's hydrated from
OPFS, see "unseeded", and reseed from the dev mockdata fixture over real
data. If "No profile selected" or a stray "Default" profile ever
reappears spontaneously, check this hasn't regressed before re-deriving
the fix.

## Sync (`server.js`)

`server.js` is a plain Express + Zod, whole-blob JSON-file store (`data/
keys.json`), gated by `VITE_USING_SERVER`/`USING_SERVER`. `/api/sync`
always exchanges the **nested wire format with plaintext values** —
encryption-at-rest applies only to the local wa-sqlite file, not the sync
payload. This was a deliberate scoping decision — no per-record diffing,
no conflict resolution, no E2E-encrypted transport for the automatic sync
path (the separate, opt-in manual E2E share feature in `lib/e2eShare.ts`
covers person-to-person sharing instead). `server.js` also hosts
`/api/proxy-spend` — see [API Spend](#api-spend) above.

## Global search & checkbox export

`GlobalSearchModal.tsx` (Ctrl/Cmd+K, via `useGlobalHotkey`) joins
`secrets`/`folders`/`profiles` in JS (`useGlobalSecretSearch`) rather than
a TanStack DB query, since there's no cross-collection join utility and
the join is only over name/folder/profile — never a secret's decrypted
value. Filtering criteria (name substring, delimiter/case-insensitive;
profile/folder multiselect) live in `SecretFilter`/`SecretFilterBuilder`
(`lib/secretFilter.ts`), a pure, unit-tested builder class, deliberately
separate from the React query layer.

Checkbox selection (`useSecretSelection`) is ephemeral, non-persisted
state — same precedent as `useAppState`'s `searchTerm` — shared by both
`SecretsList.tsx` (in-folder) and `GlobalSearchModal.tsx` (cross-folder
results), feeding the same `ExportSecretsModal.tsx`. Export line
formatting (shell-safe quoting for values containing spaces, quotes, `$`,
etc.) is pure and unit-tested in `lib/secretExportFormat.ts`.

## Drag-and-drop (react-dnd)

Folders (`FolderSidebar.tsx`) and secrets (`secrets/SecretRow.tsx`) are
each both a drag source and a drop target (`react-dnd` + `HTML5Backend`,
mounted once around the Secrets tab in `Index.tsx`). Folder rows also
accept a dropped **secret** (cross-folder move) — `useDrop`'s `accept`
takes an array of item types, and `monitor.getItemType()` branches the
handler.

Reordering is computed **on drop only**, not as a live "list reshuffles
while you drag" preview — `lib/reorder.ts`'s pure `computeReorderedIds()`
takes the drop's cursor position vs. the target row's vertical midpoint
and returns the new id order, which is then persisted and the existing
`useLiveQuery`-backed hooks re-render the real result. No local shadow-
order state to keep in sync with the live query.

Moving a secret into a folder that already has a same-named secret goes
through a duplicate check **before** any mutation
(`useSecretActions().findDuplicateInFolder`) — if there's a collision, a
`useConfirm()` dialog asks to overwrite; declining is a true no-op (the
"rollback" is achieved by never having mutated anything, not by undoing a
mutation).

**Gotcha**: the first implementation of `reorderFolders`/
`reorderSecretsInFolder` looped individual `collection.update(id, ...)`
calls, one per row. This **lost writes** under fast reload - reproducible
in Playwright as a real, unpersisted reorder after a `page.reload()`, not
just a timing flake (confirmed by switching to the batch `update(keys[],
callback)` form, which fixed it deterministically across repeated runs and
also made the writes noticeably faster). **Always use the batch form when
rewriting more than one row's `order` at once** - see [Reactivity
pattern](#reactivity-pattern) above.

## Testing

- `npm test` (Vitest, `frontend/vitest.config.ts`) — unit tests for pure
  logic: `lib/db/migrations.test.ts`, `lib/crypto.test.ts`,
  `lib/e2eShare.test.ts`, `lib/reorder.test.ts`, `lib/secretFilter.test.ts`,
  `lib/secretExportFormat.test.ts`, `lib/spend/openaiAdapter.test.ts`,
  `lib/spend/openrouterAdapter.test.ts`, and `netlify/functions/_shared/
  spendProxy.test.ts` (the `include` glob covers both `src/**` and
  `netlify/functions/**`). jsdom has no built-in IndexedDB, so
  `vitest.config.ts` loads `fake-indexeddb/auto` via `test.setupFiles` —
  needed by any test that touches the vault key.
- `npm run test:e2e` (Playwright, `frontend/playwright.config.ts`) —
  `secrets-crud`, `json-import-export`, `encrypted-share`,
  `checkbox-export-and-global-search`, `api-spend-tab`,
  `testing-mode-bypass`, `drag-and-drop`. Runs against `npm run dev` with
  `VITE_USING_SERVER=false` forced in the webServer env.
- **Run the e2e suite with `VITE_IS_TESTING=true npm run test:e2e`** to
  exercise gated features (like API Spend) without real Clerk
  credentials — `testing-mode-bypass.spec.ts` only runs under this flag
  (`test.skip` otherwise), and `api-spend-tab.spec.ts`'s real-paywall
  assertion only runs *without* it (skips itself when the flag is set),
  so the two are mutually exclusive by design, not a bug.
- **Known flake**: `ClerkProvider` is mounted for every test by default
  (even ones that never touch auth), so every test pays a real network
  cost loading Clerk's JS. Under the default 5-way parallel workers this
  occasionally starves an unrelated timing-sensitive test (seen on the
  global-search Ctrl+K spec). Running with `VITE_IS_TESTING=true`
  eliminates the Clerk network dependency entirely and has consistently
  fixed this in practice - reach for it first if the suite is flaky
  outside of the specific auth-gating tests.
- lucide-react icon class names are `lucide-{kebab-case-name}` — note
  `Trash2` → `lucide-trash2` (no hyphen before the trailing digit), not
  `lucide-trash-2`. Easy to get wrong when writing new e2e selectors.
- HTML5-native drag-and-drop (react-dnd's `HTML5Backend`) *can* be driven
  reliably by Playwright's `locator.dragTo()` — `drag-and-drop.spec.ts`
  proves it — but is more position-sensitive than a plain click (compute
  drop position from the target's actual `boundingBox()`, don't guess a
  fixed pixel offset).

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
- **Looping single-key `.update()` calls to rewrite many rows races the
  OPFS persistence layer and silently loses writes.** Use the batch
  `update(keys[], (drafts) => {...})` form instead — see
  [Drag-and-drop](#drag-and-drop-react-dnd) above for how this was found.
- **`Collection.preload()`** must be awaited before trusting a synchronous
  `.get()`/`.toArray` read on a freshly-constructed collection — see
  [First-run seeding](#first-run-seeding--migration-libdbmigrationsts)
  above.

## Out of scope / follow-ups

- Touch/mobile drag support and keyboard-based reordering for
  drag-and-drop (`react-dnd`'s HTML5 backend is mouse-only).
- Live list-reshuffle animation while dragging (reorder is computed on
  drop only - see [Drag-and-drop](#drag-and-drop-react-dnd)).
- Cross-profile folder moves or folder nesting.
- Master-password/vault-unlock UX (explicitly not chosen — see
  [Encryption](#encryption)).
- Deeper sync rearchitecture (per-record diffing, conflict resolution).
- E2E-encrypted file sharing **via email** (S3/Lambda delivery) - the
  manual download-and-share-a-token flow in `lib/e2eShare.ts` is built;
  the email-delivery variant and its own paywall are not
  (`DOCS/deprecated/roadmap.md`, items 3-4 - historical, not an active
  tracked backlog).
- An Anthropic adapter for API Spend (no simple billing endpoint to
  build one against yet).
