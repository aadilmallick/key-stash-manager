import { Profile, SecretsData } from "@/types";
import { encryptValue } from "@/lib/crypto";
import { Collections, upsertConfig } from "./collections";
import { CONFIG_KEYS, FolderRow, ProfileRow, SecretRow } from "./schema";

// Legacy STORAGE_KEY - intentionally hardcoded rather than imported from the
// (now-deleted) Zustand store, so real users' pre-migration data is never
// silently discarded in favor of the dev mock fixture.
const LEGACY_STORAGE_KEY = "api-key-manager-secrets";

const createDefaultProfile = (): Profile => ({
  id: "default",
  name: "Default",
  folders: [{ id: "default", name: "Default", secrets: [] }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const defaultData = (): SecretsData => ({
  profiles: [createDefaultProfile()],
  currentProfileId: "default",
});

// Ported from the previous Zustand store's `migrateOldData`: wraps the true
// legacy `{ folders: [...] }` shape (no profiles wrapper) into a single
// "default" profile. Already-current `{profiles, currentProfileId}` shapes
// pass through unchanged.
export function migrateLegacyV1(stored: string): SecretsData {
  try {
    const parsed = JSON.parse(stored);

    if (parsed.folders && !parsed.profiles) {
      const migratedProfile: Profile = {
        id: "default",
        name: "Default",
        folders: parsed.folders,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { profiles: [migratedProfile], currentProfileId: "default" };
    }

    if (parsed.profiles) return parsed as SecretsData;
    return defaultData();
  } catch (error) {
    console.error("Failed to parse legacy data, using defaults:", error);
    return defaultData();
  }
}

// Pure transform: nested Profile -> Folder -> Secret tree into flat,
// relational rows. Strips `tags` (the type no longer has the field, so
// there's nothing to actively remove) and assigns `order` by array index.
// Secret `value` fields are still plaintext here - encryption happens in the
// async orchestration wrapper below, right before insertion.
export function flattenNestedSecretsData(data: SecretsData): {
  profiles: ProfileRow[];
  folders: FolderRow[];
  secrets: SecretRow[];
} {
  const profiles: ProfileRow[] = [];
  const folders: FolderRow[] = [];
  const secrets: SecretRow[] = [];

  data.profiles.forEach((profile) => {
    profiles.push({
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: profile.updatedAt || new Date().toISOString(),
    });

    profile.folders.forEach((folder, folderIndex) => {
      folders.push({
        id: folder.id,
        profileId: profile.id,
        name: folder.name,
        order: folderIndex,
      });

      folder.secrets.forEach((secret, secretIndex) => {
        secrets.push({
          id: secret.id,
          folderId: folder.id,
          name: secret.name,
          value: secret.value,
          description: secret.description,
          createdAt: secret.createdAt || new Date().toISOString(),
          updatedAt: secret.updatedAt || new Date().toISOString(),
          order: secretIndex,
        });
      });
    });
  });

  return { profiles, folders, secrets };
}

export async function encryptSecretRows(
  rows: SecretRow[],
  vaultKey: CryptoKey,
): Promise<SecretRow[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      value: await encryptValue(row.value, vaultKey),
    })),
  );
}

async function loadSeedData(): Promise<SecretsData> {
  // Priority 1: real, previously-persisted user data. This must win over
  // the dev fixture, or shipping this migration would silently discard a
  // real user's secrets.
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    return migrateLegacyV1(legacy);
  }

  // Priority 2: dev-only mock fixture, so there's something to look at
  // while manually verifying the app. Dynamically imported and gated behind
  // import.meta.env.DEV so it tree-shakes out of production builds.
  if (import.meta.env.DEV) {
    try {
      const initData = await import("../../../mockdata/initdata.json");
      return initData.default as unknown as SecretsData;
    } catch (error) {
      console.warn("Dev mock data unavailable, using empty default:", error);
    }
  }

  // Priority 3: cold start in production, nothing to seed from.
  return defaultData();
}

// Idempotent across page loads via a marker in the `config` collection, but
// that check-then-act pattern isn't safe against two *concurrent* calls in
// the same page load (e.g. React 18 StrictMode's dev-mode double-effect-
// invoke) - both could read "not seeded yet" before either finishes writing,
// and then both try to insert the same deterministic mockdata IDs, causing a
// duplicate-key collision. This in-flight promise ensures only one seed
// attempt ever actually runs per page load; concurrent callers await the
// same promise.
let seedPromise: Promise<void> | null = null;

export function seedCollectionsIfNeeded(
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedCollectionsOnce(collections, vaultKey).catch((error) => {
      seedPromise = null; // allow a retry on genuine failure
      throw error;
    });
  }
  return seedPromise;
}

// Encrypts every secret value before insertion. Deliberately does NOT
// delete the legacy localStorage blob afterward - it's kept as an inert
// backup in case this migration needs to be re-run or debugged.
async function seedCollectionsOnce(
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  // `.get()` reads whatever is currently hydrated in memory - on a fresh
  // Collections instance (e.g. after a backgrounded tab gets discarded and
  // reloaded by the browser, not just a true first-ever launch) the OPFS-
  // persisted config row may not have loaded yet, making an
  // already-seeded database look unseeded. `preload()` waits for the
  // collection's initial sync to finish before the check runs, closing
  // that race - without it, this reseeds from the dev mockdata fixture
  // (import.meta.env.DEV) or an empty default profile over real data.
  await collections.config.preload();
  const alreadySeeded = collections.config.get(CONFIG_KEYS.SEED_COMPLETE);
  if (alreadySeeded) return;

  const data = await loadSeedData();
  const { profiles, folders, secrets } = flattenNestedSecretsData(data);
  const encryptedSecrets = await encryptSecretRows(secrets, vaultKey);

  if (profiles.length > 0) collections.profiles.insert(profiles);
  if (folders.length > 0) collections.folders.insert(folders);
  if (encryptedSecrets.length > 0) collections.secrets.insert(encryptedSecrets);

  const firstProfile = profiles[0];
  const { currentProfileId: requestedProfileId } = data;
  const currentProfileId =
    requestedProfileId && profiles.some((p) => p.id === requestedProfileId)
      ? requestedProfileId
      : firstProfile?.id;

  if (currentProfileId) {
    await upsertConfig(collections, CONFIG_KEYS.CURRENT_PROFILE_ID, currentProfileId);
    const firstFolder = folders.find((f) => f.profileId === currentProfileId);
    if (firstFolder) {
      await upsertConfig(collections, CONFIG_KEYS.SELECTED_FOLDER_ID, firstFolder.id);
    }
  }

  await upsertConfig(collections, CONFIG_KEYS.SEED_COMPLETE, "1");
}
