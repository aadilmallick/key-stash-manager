import { useLiveQuery } from "@tanstack/react-db";
import { count, eq } from "@tanstack/db";
import { useDbCollections } from "./useDb";
import { useConfigValue } from "./useConfig";
import { CONFIG_KEYS, FolderRow, ProfileRow, SecretRow } from "@/lib/db/schema";

export function useCurrentProfileId() {
  return useConfigValue(CONFIG_KEYS.CURRENT_PROFILE_ID, "default");
}

export function useProfiles(): ProfileRow[] {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q.from({ profiles: collections.profiles })
  );
  return (data ?? []) as unknown as ProfileRow[];
}

export function useCurrentProfile() {
  const profiles = useProfiles();
  const [currentProfileId] = useCurrentProfileId();
  return profiles.find((p) => p.id === currentProfileId);
}

export function useProfileActions() {
  const { collections } = useDbCollections();
  const [currentProfileId, setCurrentProfileId] = useCurrentProfileId();
  const [, setSelectedFolderId] = useConfigValue(
    CONFIG_KEYS.SELECTED_FOLDER_ID,
    "default",
  );

  const addProfile = (name: string) => {
    const now = new Date().toISOString();
    const profileId = crypto.randomUUID();
    const folderId = crypto.randomUUID();
    collections.profiles.insert({
      id: profileId,
      name,
      createdAt: now,
      updatedAt: now,
    });
    collections.folders.insert({
      id: folderId,
      profileId,
      name: "Default",
      order: 0,
    });
    return { profileId, folderId };
  };

  // Deleting a profile must manually cascade to its folders/secrets -
  // collections don't cascade foreign keys.
  const deleteProfile = (profileId: string) => {
    const allProfiles = collections.profiles.toArray as unknown as ProfileRow[];
    if (allProfiles.length <= 1) return;

    const folderIds = (collections.folders.toArray as unknown as FolderRow[])
      .filter((f) => f.profileId === profileId)
      .map((f) => f.id);
    const secretIds = (collections.secrets.toArray as unknown as SecretRow[])
      .filter((s) => folderIds.includes(s.folderId))
      .map((s) => s.id);

    if (secretIds.length > 0) collections.secrets.delete(secretIds);
    if (folderIds.length > 0) collections.folders.delete(folderIds);
    collections.profiles.delete([profileId]);

    if (currentProfileId === profileId) {
      const remaining = allProfiles.filter((p) => p.id !== profileId);
      const nextProfile = remaining[0];
      if (nextProfile) {
        setCurrentProfileId(nextProfile.id);
        const nextFolder =
          (collections.folders.toArray as unknown as FolderRow[]).find(
            (f) => f.profileId === nextProfile.id,
          );
        setSelectedFolderId(nextFolder?.id ?? "default");
      }
    }
  };

  const renameProfile = (profileId: string, newName: string) => {
    collections.profiles.update(profileId, (draft) => {
      draft.name = newName;
      draft.updatedAt = new Date().toISOString();
    });
  };

  const setCurrentProfile = (profileId: string) => {
    setCurrentProfileId(profileId);
    const firstFolder = (collections.folders.toArray as unknown as FolderRow[])
      .find(
        (f) => f.profileId === profileId,
      );
    setSelectedFolderId(firstFolder?.id ?? "default");
  };

  return { addProfile, deleteProfile, renameProfile, setCurrentProfile };
}

// One pair of groupBy+count queries for every profile's folder/secret
// counts, instead of an O(profiles) pair of full-collection subscriptions
// (the useProfileStats(profileId) pattern this replaces) - same shape as
// useFolderSecretCounts in useFolders.ts, just grouped by profileId.
export function useProfileFolderSecretCounts(): Map<
  string,
  { folderCount: number; secretCount: number }
> {
  const { collections } = useDbCollections();
  const { data: folderCounts } = useLiveQuery((q) =>
    q
      .from({ folders: collections.folders })
      .groupBy(({ folders }) => folders.profileId)
      .select(({ folders }) => ({
        profileId: folders.profileId as string,
        count: count(folders.id) as unknown as number,
      })),
  );
  const { data: secretCounts } = useLiveQuery((q) =>
    q
      .from({ folders: collections.folders })
      .join(
        { secrets: collections.secrets },
        ({ folders, secrets }) => eq(folders.id, secrets.folderId),
        "left",
      )
      .groupBy(({ folders }) => folders.profileId)
      .select(({ folders, secrets }) => ({
        profileId: folders.profileId as string,
        count: count(secrets.id) as unknown as number,
      })),
  );

  const map = new Map<string, { folderCount: number; secretCount: number }>();
  (folderCounts ?? []).forEach((row) => {
    map.set(row.profileId, { folderCount: row.count, secretCount: 0 });
  });
  (secretCounts ?? []).forEach((row) => {
    const existing = map.get(row.profileId) ?? {
      folderCount: 0,
      secretCount: 0,
    };
    map.set(row.profileId, { ...existing, secretCount: row.count });
  });
  return map;
}
