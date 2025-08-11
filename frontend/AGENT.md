**Overview**
- Purpose: Frontend for a simple secrets manager (“Key Stash Manager”) that organizes secrets into folders within profiles, with localStorage persistence, optional server sync, and import/export utilities.
- Stack: React 18 + TypeScript, Vite, React Router, Zustand for state, zod for schema validation, shadcn/ui + Radix for components, TailwindCSS, optional PWA (via `vite-plugin-pwa`).

**Top-Level Structure**
- `index.html`: App shell, metadata, mounts `#root`, loads `src/main.tsx`.
- `src/main.tsx`: Bootstraps React. After initial render, attempts `GET /api/sync` and writes response into localStorage under `api-key-manager-secrets`.
- `src/App.tsx`: App providers and router. Sets up React Query, Tooltip, Toasters, and routes (`/` → `Index`, `*` → `NotFound`).
- `vite.config.ts`: Vite config, alias `@` → `src`. PWA enabled unless `USING_SERVER=true`.
- `tailwind.config.ts`, `index.css`, `App.css`: Styling via Tailwind and shadcn tokens.

**Data Model**
- Types in `src/types/index.ts`:
  - `Secret`: `{ id, name, value, tags[], description?, createdAt, updatedAt }`
  - `Folder`: `{ id, name, secrets: Secret[] }`
  - `Profile`: `{ id, name, folders[], createdAt, updatedAt }`
  - `SecretsData`: `{ profiles: Profile[], currentProfileId: string }`
- Storage key: `api-key-manager-secrets` (see `src/store/secretsStore.ts`).

**State Management (`src/store/secretsStore.ts`)**
- Library: Zustand store exposes app state and mutators; persists to localStorage.
- Validation/Migrations: zod schemas (`secretZodSchema`, `folderZodSchema`, `profileZodSchema`, `secretsDataSchema`). `migrateOldData` upgrades legacy shape `{folders: [...]}` into the new `{profiles, currentProfileId}` format.
- Default state: A single `default` profile with one `default` folder.
- Key API:
  - Load/Save: `loadData()`, `saveData()`, `setData(data)`.
  - Profiles: `addProfile(name)`, `deleteProfile(id)`, `renameProfile(id, name)`, `setCurrentProfile(id)`, `getCurrentProfile()`.
  - Folders (profile-aware): `addFolder(name)`, `deleteFolder(id)`, `renameFolder(id, newName)`.
  - Secrets (profile-aware): `addSecret(folderId, data)`, `updateSecret(folderId, secretId, updates)`, `deleteSecret(folderId, secretId)`.
  - Filters: `setSelectedFolder(id)`, `setSearchTerm(term)`, `setSelectedTags(tags)`, `getFilteredSecrets()`, `getAllTags()`.
- Import/Export helpers:
  - `handleImportAll(data: string)`: Attempts to parse full `SecretsData` (new format) or legacy v1 (folders-only), then writes to localStorage.
  - `handleImportProfile(data: string)`: Adds a single profile using an `ObjectSet` to avoid duplicates.
  - `exportProfile(profile)`: Triggers a download of a profile JSON file.

**Sync Logic (`src/hooks/useSync.tsx`)**
- `pushChangesToServer()`: `POST /api/sync` with localStorage payload.
- `pullChangesFromServer()`: `GET /api/sync`, validates with zod, and `setData(parsed)` on success; falls back to `loadData()` on failure.
- Local busy state: `isSyncing` with `startSyncLoading()`/`stopSyncLoading()` for UI feedback.
- Note: The backend endpoint is expected to exist; values are plaintext (no client-side encryption here).

**Core Pages & Components**
- `src/pages/Index.tsx`:
  - On mount, calls `pullChangesFromServer()`; shows a simple "Syncing..." while busy.
  - Layout: `FolderSidebar` on the left, `SecretsList` on the right.

- `src/components/FolderSidebar.tsx`:
  - Displays current profile summary and list of folders.
  - Actions: add folder (dialog), rename (inline), delete (with confirm), select folder, open profile settings.
  - Uses `useSecretsStore` for all folder/profile state.

- `src/components/SecretsList.tsx`:
  - Top bar: search, tag filters, import/export controls, add secret, and busy indicator.
  - Listing: secrets for the selected folder with tags, description, created/updated dates.
  - Actions per secret: show/hide value, copy value, copy as `NAME=value`, edit (opens `SecretModal`), delete.
  - Import:
    - JSON import: full dataset import via `<dialog id="import-modal">` + `handleImportAll`.
    - .env import: Parses lines of `NAME=value` (ignores comments/blank), updates or inserts secrets in the current folder.
  - Export:
    - Profile export: downloads the current profile as JSON.
    - Folder export: copies and downloads `.env` lines for the selected folder.
  - Sync: After mutations, calls `pushChangesToServer()` via `saveChangesToServer()`.
  - Note: File contains HTML `<dialog>` usage and custom helpers to open/close dialogs.

- `src/components/SecretModal.tsx`:
  - Add/Edit secret form with fields: name, value (textarea), description, tags (comma-separated to array). Validates minimal presence of name/value, returns sanitized payload to caller.

- `src/components/ProfileSettingsModal.tsx`:
  - Manage profiles: create, rename, delete (with guard against deleting the last one), and switch current profile. Uses toasts for feedback.

- UI kit components under `src/components/ui/*`:
  - shadcn/ui + Radix wrappers (e.g., `button.tsx`, `input.tsx`, `dialog.tsx`, `toaster.tsx`, `toast.tsx`, etc.). Expose design-system primitives used across the app.

- `src/components/custom/PopoverButtons.tsx`:
  - `ToggleDialogButton` and `HideDialogButton` render buttons with custom attributes (`commandfor`, `command`) to control native `<dialog>` elements by element id. These are used in `SecretsList` to open/close the import dialogs.

**Utilities**
- `src/lib/ObjectSet.ts`: Simple wrapper around a `Set<string>` to deduplicate objects via `JSON.stringify` and rehydrate via `getAllData()`; used to avoid duplicate profiles on import.
- `src/lib/utils.ts`: `cn` helper for class joining.

**Routing**
- `react-router-dom` with two routes:
  - `/`: Main app (`Index`).
  - `*`: `NotFound` page that logs attempted path and provides a link back home.

**Persistence & Lifecycle**
- Initial load:
  - `src/main.tsx` fetches `/api/sync` and writes payload to localStorage if available.
  - `Index.tsx` calls `pullChangesFromServer()` on mount to hydrate Zustand state from server/local.
- Ongoing usage:
  - All mutations persist via `saveData()` to localStorage and optionally push to server (`saveChangesToServer()` calls `pushChangesToServer()`).
  - Search and tag filter are local-only filters on the selected folder’s secrets.

**Build, Run, Dev**
- Scripts in `package.json`:
  - `dev`: Run Vite dev server.
  - `build` / `build:dev`: Production build (PWA on/off controlled by env).
  - `preview`: Preview build output.
  - `lint`: ESLint.
- PWA: `vite-plugin-pwa` registers a service worker and manifest when not using server (`USING_SERVER` env variable controls).

**Key Behaviors and Edge Cases**
- Migration: If old localStorage shape (`{ folders: [...] }`) is found, it is wrapped into a default profile.
- Deleting profiles: Cannot delete the last profile. Deleting the active profile automatically switches to the first remaining profile and its first folder.
- Deleting folders: If the active folder is deleted, selection moves to the first remaining folder.
- Import JSON: `handleImportAll` first tries the new `SecretsData` shape, then legacy v1, throws if neither parse succeeds.
- .env Import: Comments and blank lines are ignored; duplicates update existing secrets by name in the current folder (tags preserved).

**Security Considerations**
- Secrets are stored in localStorage and sent to `/api/sync` in plaintext. There is no encryption at rest or in transit enforced by the frontend. If sensitive, add client-side encryption or enforce HTTPS + encrypted storage on the backend.

**Where to Extend**
- Add secret fields: Update `src/types/index.ts`, extend zod schemas in `src/store/secretsStore.ts`, and adjust UI forms (`SecretModal`, list rendering, import/export logic).
- Add bulk actions or tagging UX: Extend `SecretsList` and relevant store selectors/mutators.
- Add authentication or encryption: Introduce auth flow, encrypt before `saveData()`/sync, and decrypt in `loadData()`/pull.
- Add autosync: The code contains a commented interval example in `Index.tsx`; wire it to `pushChangesToServer()` if desired.

**Notable Files Map**
- `src/pages/Index.tsx`: Entry screen composition; triggers initial sync.
- `src/components/FolderSidebar.tsx`: Folder list and profile header/actions.
- `src/components/SecretsList.tsx`: Main list, filters, import/export, CRUD actions.
- `src/components/SecretModal.tsx`: Create/Edit secret dialog.
- `src/components/ProfileSettingsModal.tsx`: Profile management dialog.
- `src/store/secretsStore.ts`: Centralized state + persistence + import/export.
- `src/hooks/useSync.tsx`: Server sync helper.
- `src/lib/ObjectSet.ts`: Object de-duplication utility.
- `src/components/ui/*`: shadcn/Radix components used across the UI.

**Known Gaps / TODOs**
- SecretsList contains native `<dialog>` usage driven by custom button attributes; consider consolidating on Radix Dialog for consistency and accessibility.
- React Query is set up but not actively used for data fetching; sync is manual. Consider moving sync to React Query mutations/queries for caching/retries.
- No unit tests present; adding tests around store logic and import/export parsing would improve reliability.
- The `/api/sync` backend contract is assumed; add error handling, retries, and user-visible states for network failures.
