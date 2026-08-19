TanStack DB natively supports its own high-performance local storage adapter
called @tanstack/browser-db-sqlite-persistence.The Setup: This utilizes SQLite
compiled to WebAssembly (via wa-sqlite) running directly inside the user's
browser.The Benefit: Instead of mapping collections to an asynchronous IndexedDB
wrapper, TanStack DB pipes data into an actual relational SQL database locally
on the user's device. This handles massive deep nesting and recursive queries
(like resolving a file/folder directory tree) natively with optimal speed

To optimize your deeply nested data structure (Profiles → Folders → Secrets) for
TanStack DB, you should flatten your relational schemas into separate
collections rather than saving them as one nested tree. [1, 2] TanStack DB
relies on index-backed querying and atomic updates. Storing everything as a
deeply nested object inside a single collection defeats its in-memory
performance and clean reactivity model. By separating them into relational
collections (profiles, folders, and secrets) linked via explicit foreign keys
(e.g., profileId, folderId), you ensure lightning-fast tree updates and optimal
disk footprint using TanStack's SQLite persistence engine. [3, 4]

## The Normalized Relational Schema

Modify your [Zod schemas](https://tanstack.com/db/latest/docs/guides/schemas) to
turn nested children arrays into discrete, relational records. [5, 6]

import { z } from "zod"; // 1. Secrets Collection Schemaexport const
secretSchema = z.object({ id: z.string(), folderId: z.string(), // Foreign key
linking to parent Folder name: z.string(), value: z.string(), tags:
z.array(z.string()), description: z.string().optional(), createdAt:
z.string().datetime().optional(), updatedAt: z.string().datetime().optional(),
}); // 2. Folders Collection Schemaexport const folderSchema = z.object({ id:
z.string(), profileId: z.string(), // Foreign key linking to parent Profile
name: z.string(), }); // 3. Profiles Collection Schemaexport const profileSchema
= z.object({ id: z.string(), name: z.string(), createdAt:
z.string().datetime().optional(), updatedAt: z.string().datetime().optional(),
}); // 4. Application Configuration Collection (replaces SecretsData
state)export const appConfigSchema = z.object({ key: z.string(), // e.g.,
"currentProfileId" value: z.string(), });

---

## Initializing TanStack DB Collections

Use the flattened schemas to build independent, typed
[TanStack DB Collections](https://tanstack.com/db/latest/docs/overview).
Configure them to leverage high-performance index persistence. [1, 3, 5]

import { createDB } from "@tanstack/db"; export const db = createDB({ tables: {
profiles: { schema: profileSchema, primaryKey: "id", }, folders: { schema:
folderSchema, primaryKey: "id", indexes: ["profileId"], // Makes looking up a
profile's folders instantaneous }, secrets: { schema: secretSchema, primaryKey:
"id", indexes: ["folderId"], // Fast key lookups per folder node }, config: {
schema: appConfigSchema, primaryKey: "key", } } });

---

## Performance Wins for Your Nested Tree View

By adopting this flat, relational strategy instead of your old nested
localStorage design, your React tree view experiences three structural
advantages:

- Surgical UI Triggers: If you update a single API key value inside a secret,
  TanStack DB only alerts React components subscribing to that explicit secret
  record. The parent folder and profile components do not trigger unnecessary
  canvas re-renders. [7]
- Low Memory Footprint: When a folder tree node is closed, you can choose to
  query and load only the bare folder titles. You can delay fetching the nested
  array of secrets until the user expands that concrete tree node.
- Safer Data Operations: Adding or deleting a single folder executes a simple
  insert/delete mutation handler on a small, row-level basis. It completely
  bypasses the data-corruption risks of stringifying massive JSON trees. [8]

---

If you want to move forward with constructing the frontend, I can show you how
to:

- Set up useLiveQuery reactive hooks to reconstruct the tree view dynamically
  from the relational data.
- Write a migration function to import your legacy v1 nested data directly into
  these new flat collections. [7]

[1] [https://tanstack.com](https://tanstack.com/db/latest/docs/overview) [2]
[https://electric.ax](https://electric.ax/blog/2026/03/25/tanstack-db-0.6-app-ready-with-persistence-and-includes)
[3] [https://github.com](https://github.com/TanStack/db/issues/865) [4]
[https://tanstack.com](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes)
[5] [https://tanstack.com](https://tanstack.com/db/latest/docs/overview) [6]
[https://tanstack.com](https://tanstack.com/db/latest/docs/guides/schemas) [7]
[https://tanstack.com](https://tanstack.com/db/latest) [8]
[https://tanstack.com](https://tanstack.com/db/latest/docs/collections/query-collection)

## Code example

```ts
import { createDB } from "@tanstack/db";
import { sqliteBrowserPersistence } from "@tanstack/browser-db-sqlite-persistence";
import { folderSchema, profileSchema, secretSchema } from "./schemas";

export const db = createDB({
    tables: {
        profiles: { schema: profileSchema, primaryKey: "id" },
        folders: {
            schema: folderSchema,
            primaryKey: "id",
            indexes: ["profileId"],
        },
        secrets: {
            schema: secretSchema,
            primaryKey: "id",
            indexes: ["folderId"],
        },
    },
    // Natively back memory state to an optimized SQLite WASM file
    persistence: sqliteBrowserPersistence({
        dbName: "user-vault-sqlite.db",
        schemaVersion: 1, // Sync drops and auto-cleans memory if schema version updates
    }),
});
```

The native SQLite WASM adapter (@tanstack/browser-db-sqlite-persistence) is the
superior choice for your data structure and UI requirements for two critical
structural reasons:1. Native Relational Projection (includes)Since your UI is a
complex tree view (Profiles → Folders → Secrets), reconstructing the tree
manually in JavaScript using flat IndexedDB loops is slow and prone to
boilerplate bugs.TanStack DB natively features an includes primitive engineered
explicitly for its SQLite runtime.It acts like a client-side GraphQL query
builder. It allows you to query all profiles, auto-join their relational
folders, and grab nested secrets across a singular reactive data layer:

```ts
// Querying your entire nested tree directly from your database layout
const profileTreeQuery = db.profiles.select({
    id: true,
    name: true,
    folders: db.folders.where("profileId", "id").select({
        id: true,
        name: true,
        secrets: db.secrets.where("folderId", "id").select(),
    }),
});
```

With the native SQLite runtime, child nested data fields are automatically
materialized as independent subsets.If a user changes a single API key value
inside an deeply nested Secret folder element, the parent folder row and root
profile container do not trigger canvas re-renders.Only the individual
SecretComponent hooked to that collection slice updates. Unofficial adapters
mapping to general IndexedDB key blocks lack this deeply tuned pipeline and
frequently trigger sweeping top-down React tree updates
