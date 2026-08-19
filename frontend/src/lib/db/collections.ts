import { BasicIndex, Collection, createCollection } from "@tanstack/db";
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  persistedCollectionOptions,
} from "@tanstack/browser-db-sqlite-persistence";
import {
  ConfigRow,
  FolderRow,
  ProfileRow,
  SecretRow,
  configRowSchema,
  folderRowSchema,
  profileRowSchema,
  secretRowSchema,
} from "./schema";

export interface Collections {
  profiles: Collection<ProfileRow, string>;
  folders: Collection<FolderRow, string>;
  secrets: Collection<SecretRow, string>;
  config: Collection<ConfigRow, string>;
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
const createCollectionUntyped = createCollection as (options: unknown) => unknown;

function createProfilesCollection(persistence: ReturnType<typeof createBrowserWASQLitePersistence>): Collection<ProfileRow, string> {
  return createCollectionUntyped(
    persistedCollectionOptions<ProfileRow, string, typeof profileRowSchema>({
      id: "profiles",
      getKey: (p) => p.id,
      persistence,
      schemaVersion: 1,
      schema: profileRowSchema,
    }),
  ) as Collection<ProfileRow, string>;
}

function createFoldersCollection(persistence: ReturnType<typeof createBrowserWASQLitePersistence>): Collection<FolderRow, string> {
  return createCollectionUntyped(
    persistedCollectionOptions<FolderRow, string, typeof folderRowSchema>({
      id: "folders",
      getKey: (f) => f.id,
      persistence,
      schemaVersion: 1,
      schema: folderRowSchema,
    }),
  ) as Collection<FolderRow, string>;
}

function createSecretsCollection(persistence: ReturnType<typeof createBrowserWASQLitePersistence>): Collection<SecretRow, string> {
  return createCollectionUntyped(
    persistedCollectionOptions<SecretRow, string, typeof secretRowSchema>({
      id: "secrets",
      getKey: (s) => s.id,
      persistence,
      schemaVersion: 1,
      schema: secretRowSchema,
    }),
  ) as Collection<SecretRow, string>;
}

function createConfigCollection(persistence: ReturnType<typeof createBrowserWASQLitePersistence>): Collection<ConfigRow, string> {
  return createCollectionUntyped(
    persistedCollectionOptions<ConfigRow, string, typeof configRowSchema>({
      id: "config",
      getKey: (c) => c.key,
      persistence,
      schemaVersion: 1,
      schema: configRowSchema,
    }),
  ) as Collection<ConfigRow, string>;
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
    profiles: createProfilesCollection(persistence),
    folders: createFoldersCollection(persistence),
    secrets: createSecretsCollection(persistence),
    config: createConfigCollection(persistence),
  };

  // Matches the where/join clauses in useFolders.ts/useSecrets.ts - avoids
  // TanStack DB falling back to a full scan on every folder/secret query.
  collections.folders.createIndex((row) => row.profileId, { indexType: BasicIndex });
  collections.secrets.createIndex((row) => row.folderId, { indexType: BasicIndex });

  return collections;
}

export async function upsertConfig(
  collections: Collections,
  key: string,
  value: string,
): Promise<void> {
  const existing = collections.config.get(key);
  if (existing) {
    collections.config.update(key, (draft) => {
      draft.value = value;
    });
  } else {
    collections.config.insert({ key, value });
  }
}
