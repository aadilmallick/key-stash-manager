import {
  importSchemaV1,
  Profile,
  profileZodSchema,
  SecretsData,
  secretsDataSchema,
} from "@/types";
import { decryptValue } from "@/lib/crypto";
import { Collections, upsertConfig } from "./collections";
import { CONFIG_KEYS } from "./schema";
import { encryptSecretRows, flattenNestedSecretsData } from "./migrations";

// Reconstructs the nested Profile -> Folder -> Secret wire format from the
// flat collections, decrypting every secret value along the way. Used for
// JSON export and for building the /api/sync push payload.
export async function buildNestedSecretsData(
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<SecretsData> {
  const profiles = collections.profiles.toArray;
  const folders = collections.folders.toArray;
  const secrets = collections.secrets.toArray;
  const currentProfileId =
    collections.config.get(CONFIG_KEYS.CURRENT_PROFILE_ID)?.value ??
      profiles[0]?.id ??
      "default";

  const decryptedSecrets = await Promise.all(
    secrets.map(async (s) => ({
      ...s,
      value: await decryptValue(s.value, vaultKey),
    })),
  );

  const nestedProfiles: Profile[] = profiles.map((profile) => {
    const profileFolders = folders
      .filter((f) => f.profileId === profile.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      folders: profileFolders.map((folder) => {
        const folderSecrets = decryptedSecrets
          .filter((s) => s.folderId === folder.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        return {
          id: folder.id,
          name: folder.name,
          secrets: folderSecrets.map((s) => ({
            id: s.id,
            name: s.name,
            value: s.value,
            description: s.description,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
        };
      }),
    };
  });

  return { profiles: nestedProfiles, currentProfileId };
}

// Wholesale replace: deletes everything currently in the collections and
// re-inserts the flattened, encrypted version of `data`. Mirrors the old
// store's full-JSON-import behavior (overwrite, not merge).
async function replaceAllData(
  data: SecretsData,
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  // Encrypt the replacement rows before touching any existing data - if
  // encryptValue throws partway through, the vault is left untouched
  // instead of already-deleted with nothing to replace it.
  const { profiles, folders, secrets } = flattenNestedSecretsData(data);
  const encryptedSecrets = await encryptSecretRows(secrets, vaultKey);

  const existingProfileIds = collections.profiles.toArray.map((p) => p.id);
  const existingFolderIds = collections.folders.toArray.map((f) => f.id);
  const existingSecretIds = collections.secrets.toArray.map((s) => s.id);

  if (existingSecretIds.length) collections.secrets.delete(existingSecretIds);
  if (existingFolderIds.length) collections.folders.delete(existingFolderIds);
  if (existingProfileIds.length) {
    collections.profiles.delete(existingProfileIds);
  }

  if (profiles.length) collections.profiles.insert(profiles);
  if (folders.length) collections.folders.insert(folders);
  if (encryptedSecrets.length) collections.secrets.insert(encryptedSecrets);

  const currentProfileId = data.profiles.some(
      (p) => p.id === data.currentProfileId,
    )
    ? data.currentProfileId
    : profiles[0]?.id;

  if (currentProfileId) {
    await upsertConfig(
      collections,
      CONFIG_KEYS.CURRENT_PROFILE_ID,
      currentProfileId,
    );
    const firstFolder = folders.find((f) => f.profileId === currentProfileId);
    await upsertConfig(
      collections,
      CONFIG_KEYS.SELECTED_FOLDER_ID,
      firstFolder?.id ?? "default",
    );
  }
}

// Parses a full export (`{profiles, currentProfileId}`) and overwrites
// everything, or falls back to the legacy V1 `{folders: [...]}` shape,
// which is appended as a new "Imported" profile alongside existing data
// (matching the previous store's `handleImportAll` fallback behavior).
export async function importAllFromJson(
  content: string,
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  const parsed = JSON.parse(content);

  const fullFormat = secretsDataSchema.safeParse(parsed);
  if (fullFormat.success) {
    await replaceAllData(fullFormat.data, collections, vaultKey);
    return;
  }

  const legacyFormat = importSchemaV1.safeParse(parsed);
  if (legacyFormat.success) {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name: "Imported",
      folders: legacyFormat.data.folders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const existing = await buildNestedSecretsData(collections, vaultKey);
    const merged: SecretsData = {
      profiles: [...existing.profiles, newProfile],
      currentProfileId: existing.currentProfileId || newProfile.id,
    };
    await replaceAllData(merged, collections, vaultKey);
    return;
  }

  throw new Error("Failed to handle import");
}

// Imports a single exported profile, appending it alongside existing
// profiles. Dedupes by id/name the same way the previous store did:
// any conflict regenerates the id, and a name conflict specifically also
// appends an "(Imported <date>)" suffix.
export async function importSingleProfile(
  content: string,
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  const parsedProfile = profileZodSchema.parse(JSON.parse(content));
  const existingProfiles = collections.profiles.toArray;
  const existingById = existingProfiles.some((p) => p.id === parsedProfile.id);
  const existingByName = existingProfiles.some(
    (p) => p.name === parsedProfile.name,
  );

  const profileToInsert: Profile = existingById || existingByName
    ? {
      ...parsedProfile,
      id: crypto.randomUUID(),
      name: existingByName
        ? `${parsedProfile.name} (Imported ${new Date().toLocaleDateString()})`
        : parsedProfile.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folders: parsedProfile.folders.map((folder) => ({
        ...folder,
        id: crypto.randomUUID(),
        secrets: folder.secrets.map((secret) => ({
          ...secret,
          id: crypto.randomUUID(),
        })),
      })),
    }
    : parsedProfile;

  const { profiles, folders, secrets } = flattenNestedSecretsData({
    profiles: [profileToInsert],
    currentProfileId: profileToInsert.id,
  });
  const encryptedSecrets = await encryptSecretRows(secrets, vaultKey);

  collections.profiles.insert(profiles);
  if (folders.length) collections.folders.insert(folders);
  if (encryptedSecrets.length) collections.secrets.insert(encryptedSecrets);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAllProfilesFile(
  collections: Collections,
  vaultKey: CryptoKey,
): Promise<void> {
  const data = await buildNestedSecretsData(collections, vaultKey);
  downloadJson(
    `export-all-profiles-${new Date().toISOString().split("T")[0]}.json`,
    data,
  );
}

export async function exportProfileFile(
  collections: Collections,
  vaultKey: CryptoKey,
  profileId: string,
): Promise<void> {
  const data = await buildNestedSecretsData(collections, vaultKey);
  const profile = data.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error("Profile not found");
  const safeName = profile.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64);
  downloadJson(
    `export-profile-${safeName}-${profile.id.slice(0, 8)}.json`,
    profile,
  );
}
