import { useMemo } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { useDbCollections } from "./useDb";
import { SecretFilter } from "@/lib/secretFilter";
import { FolderRow, ProfileRow, SecretRow } from "@/lib/db/schema";

export interface GlobalSearchResult {
  secretId: string;
  name: string;
  folderId: string;
  folderName: string;
  profileId: string;
  profileName: string;
}

// Joins the three flat collections in JS (no existing cross-collection query
// utility, and this table is small - a vault with thousands of secrets is
// not the expected scale). Only name/folder/profile are touched here -
// secret *values* are decrypted lazily by the caller, only for a row the
// user actually unmasks, so a keystroke here never decrypts the whole vault.
export function useGlobalSecretSearch(filter: SecretFilter): {
  results: GlobalSearchResult[];
} {
  const { collections } = useDbCollections();
  const { data: secretsData } = useLiveQuery((q) =>
    q.from({ secrets: collections.secrets })
  );
  const { data: foldersData } = useLiveQuery((q) =>
    q.from({ folders: collections.folders })
  );
  const { data: profilesData } = useLiveQuery((q) =>
    q.from({ profiles: collections.profiles })
  );

  const secrets = (secretsData ?? []) as unknown as SecretRow[];
  const folders = (foldersData ?? []) as unknown as FolderRow[];
  const profiles = (profilesData ?? []) as unknown as ProfileRow[];

  const results = useMemo(() => {
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const joined: GlobalSearchResult[] = [];
    for (const secret of secrets) {
      const folder = folderById.get(secret.folderId);
      const profile = folder ? profileById.get(folder.profileId) : undefined;
      if (!folder || !profile) continue;
      joined.push({
        secretId: secret.id,
        name: secret.name,
        folderId: folder.id,
        folderName: folder.name,
        profileId: profile.id,
        profileName: profile.name,
      });
    }

    return joined.filter((r) =>
      filter.matches({
        name: r.name,
        profileId: r.profileId,
        folderId: r.folderId,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secrets, folders, profiles, filter]);

  return { results };
}
