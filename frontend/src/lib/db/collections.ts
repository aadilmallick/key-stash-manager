import { BasicIndex, Collection, createCollection } from "@tanstack/db";
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  persistedCollectionOptions,
} from "@tanstack/browser-db-sqlite-persistence";
import { StandardSchemaV1 } from "@standard-schema/spec";
import {
  ConfigRow,
  configRowSchema,
  FolderRow,
  folderRowSchema,
  ProfileRow,
  profileRowSchema,
  SecretRow,
  secretRowSchema,
  SpendProviderRow,
  spendProviderRowSchema,
} from "./schema";

export interface Collections {
  profiles: Collection<ProfileRow, string>;
  folders: Collection<FolderRow, string>;
  secrets: Collection<SecretRow, string>;
  config: Collection<ConfigRow, string>;
  spendProviders: Collection<SpendProviderRow, string>;
}

// persistedCollectionOptions needs explicit T/TKey/TSchema generics - its
// `getKey` callback parameter can't be inferred backward from usage, and
// omitting TSchema defaults it to `never`, conflicting with the `schema`
// field.
//
// createCollection's own overload resolution, when fed that result, ends up
// comparing the schema type itself (not the schema's *output* type) against
// the row type in one internal `sync.sync` callback signature - a generic
// mismatch in this pre-1.0 library's overload set, not a runtime issue (the
// actual JS behavior - validation, persistence, reactivity - is unaffected,
// since TS types are erased at runtime). `createCollection` is called as
// `any` here to bypass that overload resolution, then the result is cast
// back to a precise `Collection<T, string>` - this keeps every other file
// (hooks, components) working against clean, fully-typed collections, with
// the type friction isolated to this one file.
const createCollectionUntyped = createCollection as (
  options: unknown,
) => unknown;

function createPersistedCollection<
  T extends object,
  TSchema extends StandardSchemaV1,
>(
  persistence: ReturnType<typeof createBrowserWASQLitePersistence>,
  options: { id: string; getKey: (row: T) => string; schema: TSchema },
): Collection<T, string> {
  return createCollectionUntyped(
    persistedCollectionOptions<T, string, TSchema>({
      id: options.id,
      getKey: options.getKey,
      persistence,
      schemaVersion: 1,
      schema: options.schema,
    }),
  ) as Collection<T, string>;
}

let collectionsPromise: Promise<Collections> | null = null;

export function getCollections(): Promise<Collections> {
  if (!collectionsPromise) {
    collectionsPromise = createCollections();
  }
  return collectionsPromise;
}

async function createCollections(): Promise<Collections> {
  const database = await openBrowserWASQLiteOPFSDatabase({
    databaseName: "key-stash-manager.sqlite",
  });
  const coordinator = new BrowserCollectionCoordinator({
    dbName: "key-stash-manager",
  });
  const persistence = createBrowserWASQLitePersistence({
    database,
    coordinator,
  });

  const collections: Collections = {
    profiles: createPersistedCollection(persistence, {
      id: "profiles",
      getKey: (p: ProfileRow) => p.id,
      schema: profileRowSchema,
    }),
    folders: createPersistedCollection(persistence, {
      id: "folders",
      getKey: (f: FolderRow) => f.id,
      schema: folderRowSchema,
    }),
    secrets: createPersistedCollection(persistence, {
      id: "secrets",
      getKey: (s: SecretRow) => s.id,
      schema: secretRowSchema,
    }),
    config: createPersistedCollection(persistence, {
      id: "config",
      getKey: (c: ConfigRow) => c.key,
      schema: configRowSchema,
    }),
    spendProviders: createPersistedCollection(persistence, {
      id: "spendProviders",
      getKey: (p: SpendProviderRow) => p.id,
      schema: spendProviderRowSchema,
    }),
  };

  // Matches the where/join clauses in useFolders.ts/useSecrets.ts - avoids
  // TanStack DB falling back to a full scan on every folder/secret query.
  collections.folders.createIndex((row) => row.profileId, {
    indexType: BasicIndex,
  });
  collections.secrets.createIndex((row) => row.folderId, {
    indexType: BasicIndex,
  });

  return collections;
}

export function upsertConfig(
  collections: Collections,
  key: string,
  value: string,
): void {
  const existing = collections.config.get(key);
  if (existing) {
    collections.config.update(key, (draft) => {
      draft.value = value;
    });
  } else {
    collections.config.insert({ key, value });
  }
}
