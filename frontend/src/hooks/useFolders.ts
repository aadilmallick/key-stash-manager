import { useLiveQuery } from "@tanstack/react-db";
import { count, eq } from "@tanstack/db";
import { useDbCollections } from "./useDb";
import { useConfigValue } from "./useConfig";
import { useCurrentProfileId } from "./useProfiles";
import { CONFIG_KEYS, FolderRow } from "@/lib/db/schema";

export function useSelectedFolderId() {
  return useConfigValue(CONFIG_KEYS.SELECTED_FOLDER_ID, "default");
}

// Every folder across every profile, unscoped - used by the global search
// modal's folder-scoping picker, which (unlike the sidebar) isn't limited to
// the current profile.
export function useAllFolders(): FolderRow[] {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) => q.from({ folders: collections.folders }));
  return (data ?? []) as unknown as FolderRow[];
}

export function useFoldersForProfile(profileId: string | undefined) {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q
      .from({ folders: collections.folders })
      .where(({ folders }) => eq(folders.profileId, profileId ?? "")),
  );
  const rows = (data ?? []) as unknown as FolderRow[];
  return rows.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// One join+groupBy query for every folder's secret count, instead of an
// O(n) subscription per folder in the sidebar's render.
export function useFolderSecretCounts(profileId: string | undefined) {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q
      .from({ folders: collections.folders })
      .join(
        { secrets: collections.secrets },
        ({ folders, secrets }) => eq(folders.id, secrets.folderId),
        "left",
      )
      .where(({ folders }) => eq(folders.profileId, profileId ?? ""))
      .groupBy(({ folders }) => folders.id)
      .select(({ folders, secrets }) => ({
        folderId: folders.id as string,
        count: count(secrets.id) as unknown as number,
      })),
  );

  const map = new Map<string, number>();
  (data ?? []).forEach((row) => map.set(row.folderId, row.count));
  return map;
}

export function useFolderActions() {
  const { collections } = useDbCollections();
  const [currentProfileId] = useCurrentProfileId();
  const [selectedFolderId, setSelectedFolderId] = useSelectedFolderId();

  const addFolder = (name: string) => {
    if (!currentProfileId) return;
    const siblings = (collections.folders.toArray as unknown as FolderRow[]).filter(
      (f) => f.profileId === currentProfileId,
    );
    const nextOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((f) => f.order ?? 0)) + 1
        : 0;
    collections.folders.insert({
      id: crypto.randomUUID(),
      profileId: currentProfileId,
      name,
      order: nextOrder,
    });
  };

  // Deleting a folder must manually cascade to its secrets - collections
  // don't cascade foreign keys.
  const deleteFolder = (folderId: string) => {
    const secretIds = collections.secrets.toArray
      .filter((s) => s.folderId === folderId)
      .map((s) => s.id);
    if (secretIds.length > 0) collections.secrets.delete(secretIds);
    collections.folders.delete([folderId]);

    if (selectedFolderId === folderId && currentProfileId) {
      const remaining = (collections.folders.toArray as unknown as FolderRow[]).filter(
        (f) => f.profileId === currentProfileId && f.id !== folderId,
      );
      if (remaining.length > 0) {
        setSelectedFolderId(remaining[0].id);
      } else {
        // Deleting the last folder in a profile can't fall back to a
        // literal "default" - folder ids are UUIDs, so that id would match
        // no folder and orphan any secret added afterward. Guarantee a
        // real folder always exists instead, mirroring how a new profile
        // always starts with one.
        const replacementId = crypto.randomUUID();
        collections.folders.insert({
          id: replacementId,
          profileId: currentProfileId,
          name: "Default",
          order: 0,
        });
        setSelectedFolderId(replacementId);
      }
    }
  };

  const renameFolder = (folderId: string, newName: string) => {
    collections.folders.update(folderId, (draft) => {
      draft.name = newName;
    });
  };

  return { addFolder, deleteFolder, renameFolder };
}
