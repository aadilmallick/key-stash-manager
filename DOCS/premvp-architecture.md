## Architecture

### Data Model & Flow

The application uses a hierarchical structure:

```
SecretsData
├── profiles[]
│   ├── id, name, createdAt, updatedAt
│   └── folders[]
│       ├── id, name
│       └── secrets[]
│           └── id, name, value, tags[], description, createdAt, updatedAt
└── currentProfileId
```

**Persistence & Sync:**

1. State managed by Zustand store (`src/store/secretsStore.ts`)
2. Persisted to localStorage under key `api-key-manager-secrets`
3. Synced to server via `/api/sync` endpoints:
   - `GET /api/sync`: Pull data from server (persisted in `data/keys.json`)
   - `POST /api/sync`: Push data to server (validated with Zod)

**Data Migration:**

- Both frontend store and backend server handle migration from legacy format
  (`{folders: [...]}`) to new profile-based format
- Migration wraps old data into a default profile automatically

### Frontend Architecture

**State Management (`frontend/src/store/secretsStore.ts`):**

- Single Zustand store with localStorage persistence
- Zod schemas validate all data operations
- Exports methods for CRUD operations on profiles, folders, and secrets
- Provides filtering utilities: `getFilteredSecrets()`, `getAllTags()`

**Sync Logic (`frontend/src/hooks/useSync.tsx`):**

- `pullChangesFromServer()`: Fetches from server, validates, updates store
- `pushChangesToServer()`: Sends localStorage state to server
- Initial sync happens in `main.tsx` and `Index.tsx`

**Key Components:**

- `pages/Index.tsx`: Main app, triggers initial sync, renders sidebar + list
- `components/FolderSidebar.tsx`: Profile header, folder list, management
  dialogs
- `components/SecretsList.tsx`: Secrets CRUD, search/filter, import/export
- `components/SecretModal.tsx`: Add/edit secret form
- `components/ProfileSettingsModal.tsx`: Profile management
- `components/ui/*`: shadcn/Radix component primitives

**Import/Export:**

- JSON import: Full `SecretsData` or legacy format via `handleImportAll()`
- Profile import: Single profile via `handleImportProfile()` (uses `ObjectSet`
  for deduplication)
- .env import: Parses `NAME=value` lines, updates/inserts in current folder
- Profile export: Downloads single profile as JSON
- Folder export: Downloads .env format for selected folder

### Backend Architecture

**Server (`server.js`):**

- Express.js with JSON middleware
- Serves frontend from `frontend/dist`
- Stores data in `data/keys.json`
- Validates all POST data with Zod schemas matching frontend

**API Endpoints:**

- `GET /`: Serves frontend SPA
- `GET /api/sync`: Returns current secrets data (creates default if missing,
  migrates legacy)
- `POST /api/sync`: Accepts and validates secrets data, saves to disk

**File Structure:**

```
data/keys.json           # Persistent server-side storage
frontend/dist/           # Built frontend assets
server.js                # Express server
```

## Notable Implementation Details

1. **Security**: Secrets are stored in plaintext in localStorage and
   `data/keys.json`. Client-side encryption is a crucial roadmap.

2. **Validation**: Zod schemas are duplicated between frontend
   (`secretsStore.ts`) and backend (`server.js`). Keep schemas synchronized when
   modifying data structure.

3. **Dialog Management**: `SecretsList.tsx` uses native `<dialog>` HTML elements
   with custom button attributes (`commandfor`, `command`) via
   `PopoverButtons.tsx`. Consider consolidating on Radix Dialog for consistency.

4. **Profile Constraints**:
   - Cannot delete the last profile
   - Deleting active profile auto-switches to first remaining profile
   - Deleting active folder auto-selects first remaining folder

5. **React Query**: Configured in `App.tsx` but not actively used. Sync is
   manual via `useSync` hook.

6. **PWA**: `vite-plugin-pwa` registers service worker when
   `VITE_USING_SERVER !== "true"`

## Extending the Application

**Adding Secret Fields:**

1. Update `Secret` type in `frontend/src/types/index.ts`
2. Update `secretZodSchema` in `frontend/src/store/secretsStore.ts`
3. Update `secretSchema` in `server.js`
4. Update `SecretModal.tsx` form and `SecretsList.tsx` display
5. Update import/export logic in `secretsStore.ts`

**Adding Authentication:**

1. Add auth flow before sync operations
2. Modify `/api/sync` endpoints to require auth tokens
3. Consider adding encryption layer before `saveData()`/sync

**Adding Client-Side Encryption:**

1. Encrypt in `saveData()` before localStorage write
2. Decrypt in `loadData()` after read
3. Apply same encryption to sync payloads in `useSync.tsx`
