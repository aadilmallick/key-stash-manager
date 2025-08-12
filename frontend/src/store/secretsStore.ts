import { create } from "zustand";
import {
  Secret,
  Folder,
  Profile,
  SecretsData,
  secretsDataSchema,
  folderZodSchema,
  importSchemaV1,
  profileZodSchema,
  secretZodSchema,
} from "../types";
import { z } from "zod";
import { ObjectSet } from "@/lib/ObjectSet";

export const STORAGE_KEY = "api-key-manager-secrets";

export function getLocalStorage() {
  return localStorage.getItem(STORAGE_KEY);
}

function handleImportAllSecrets(data: string) {
  try {
    const parsedData = secretsDataSchema.parse(JSON.parse(data));
    // Ensure there is at least one profile and a valid currentProfileId
    if (!parsedData.profiles || parsedData.profiles.length === 0) {
      throw new Error("No profiles provided");
    }
    const hasCurrent = parsedData.profiles.some(
      (p) => p.id === parsedData.currentProfileId
    );
    const normalized = hasCurrent
      ? parsedData
      : ({
          ...parsedData,
          currentProfileId: parsedData.profiles[0].id,
        } as SecretsData);

    // Normalize: ensure each profile has createdAt/updatedAt
    normalized.profiles = normalized.profiles.map((p) => ({
      ...p,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;

    // if (existingProfileIndex !== -1) {
    //   const shouldOverwrite = confirm(
    //     `A profile with ID "${parsedProfile.id}" and name "${parsedProfile.name}" already exists. Do you want to overwrite it?`
    //   );
    //   console.log("shouldOverwrite", shouldOverwrite);
    //   if (shouldOverwrite) {
    //     localStorageData.profiles[existingProfileIndex] = parsedProfile;
    //   } else {
    //     return false;
    //   }
    // } else {
    //   localStorageData.profiles.push(parsedProfile);
    //   localStorage.setItem(STORAGE_KEY, JSON.stringify(localStorageData));
    //   return true;
    // }
  } catch (error) {
    console.error(
      "Failed to handle importing all secrets and profiles:",
      error
    );
    return false;
  }
}

function handleImportV1(data: string) {
  try {
    const parsedProfile = importSchemaV1.parse(JSON.parse(data));
    // Migrate V1 (single folders array) into a Profile and append
    const stored = getLocalStorage();
    const base = stored
      ? secretsDataSchema.parse(JSON.parse(stored))
      : ({ profiles: [], currentProfileId: "" } as SecretsData);

    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name: "Imported",
      folders: parsedProfile.folders as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const merged: SecretsData = {
      profiles: [...base.profiles, newProfile] as Profile[],
      currentProfileId: base.currentProfileId || newProfile.id,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch (error) {
    console.error("Failed to handle import:", error);
    return false;
  }
}

export function handleImportAll(data: string) {
  // Try full dataset import first; if that fails, try legacy V1
  const success = handleImportAllSecrets(data) || handleImportV1(data);
  if (!success) throw new Error("Failed to handle import");
}

export function exportProfile(profile: Profile) {
  const data = JSON.stringify(profile);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-profile-${profile.name}-${profile.id.slice(0, 8)}.json`;
  a.click();
  a.remove();
}

export function exportAllProfiles(profilesData: SecretsData) {
  const data = JSON.stringify(profilesData);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-all-profiles-${
    new Date().toISOString().split("T")[0]
  }.json`;
  a.click();
  a.remove();
}

export function handleImportProfile(data: string) {
  try {
    const parsedProfile = profileZodSchema.parse(JSON.parse(data));
    const localStorageData = secretsDataSchema.parse(
      JSON.parse(getLocalStorage() || "{}")
    );

    // Check for duplicate profile ID
    const existingProfileById = localStorageData.profiles.find(
      (p) => p.id === parsedProfile.id
    );

    // Check for duplicate profile name
    const existingProfileByName = localStorageData.profiles.find(
      (p) => p.name === parsedProfile.name
    );

    if (existingProfileById || existingProfileByName) {
      // Generate new unique ID and name to avoid conflicts
      const newProfile = {
        ...parsedProfile,
        id: crypto.randomUUID(),
        name: existingProfileByName
          ? `${
              parsedProfile.name
            } (Imported ${new Date().toLocaleDateString()})`
          : parsedProfile.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Profile;

      localStorageData.profiles.push(newProfile);
    } else {
      // No conflicts, add as-is
      localStorageData.profiles.push(parsedProfile);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(localStorageData));
    return true;
  } catch (error) {
    console.error("Failed to import profile:", error);
    throw new Error("Invalid profile data format");
  }
}

const createDefaultProfile = (): Profile => ({
  id: "default",
  name: "Default",
  folders: [
    {
      id: "default",
      name: "Default",
      secrets: [],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const defaultData: SecretsData = {
  profiles: [createDefaultProfile()],
  currentProfileId: "default",
};

interface SecretsStore {
  data: SecretsData;
  selectedFolderId: string;
  searchTerm: string;
  selectedTags: string[];
  loadData: () => void;
  saveData: () => void;
  setData: (data: SecretsData) => void;
  refreshData: () => void;

  // Profile operations
  addProfile: (name: string) => void;
  deleteProfile: (profileId: string) => void;
  renameProfile: (profileId: string, newName: string) => void;
  setCurrentProfile: (profileId: string) => void;
  getCurrentProfile: () => Profile | undefined;
  exportAllProfiles: () => void;
  exportCurrentProfile: () => void;

  // Folder operations (profile-aware)
  addFolder: (name: string) => void;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string) => void;

  // Secret operations (profile-aware)
  addSecret: (
    folderId: string,
    secret: Omit<Secret, "id" | "createdAt" | "updatedAt">
  ) => void;
  updateSecret: (
    folderId: string,
    secretId: string,
    updates: Partial<Secret>
  ) => void;
  deleteSecret: (folderId: string, secretId: string) => void;

  setSelectedFolder: (folderId: string) => void;
  setSearchTerm: (term: string) => void;
  setSelectedTags: (tags: string[]) => void;
  getFilteredSecrets: () => Secret[];
  getAllTags: () => string[];
}

// Migration function to handle old data structure
const migrateOldData = (stored: string): SecretsData => {
  const parsed = JSON.parse(stored);

  // Check if it's the old structure (has folders directly)
  if (parsed.folders && !parsed.profiles) {
    const migratedProfile: Profile = {
      id: "default",
      name: "Default",
      folders: parsed.folders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      profiles: [migratedProfile],
      currentProfileId: "default",
    };
  }

  // Already new structure or empty
  return parsed.profiles ? parsed : defaultData;
};

export const useSecretsStore = create<SecretsStore>((set, get) => ({
  data: defaultData,
  selectedFolderId: "default",
  searchTerm: "",
  selectedTags: [],

  setData: (data: SecretsData) => {
    set({ data });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  loadData: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = migrateOldData(stored);
        // Ensure currentProfileId points to an existing profile
        const currentExists = data.profiles.some(
          (p) => p.id === data.currentProfileId
        );
        const normalized: SecretsData = currentExists
          ? data
          : { ...data, currentProfileId: data.profiles[0]?.id || "default" };
        set({ data: normalized });

        // Ensure selected folder exists in current profile
        const currentProfile = data.profiles.find(
          (p) => p.id === data.currentProfileId
        );
        if (currentProfile) {
          const folderExists = currentProfile.folders.some(
            (f) => f.id === get().selectedFolderId
          );
          if (!folderExists && currentProfile.folders.length > 0) {
            set({ selectedFolderId: currentProfile.folders[0].id });
          }
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      set({ data: defaultData });
    }
  },

  saveData: () => {
    try {
      const { data } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  },

  refreshData: () => {
    get().loadData();
  },

  // Profile operations
  addProfile: (name: string) => {
    const now = new Date().toISOString();
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name,
      folders: [
        {
          id: crypto.randomUUID(),
          name: "default",
          secrets: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      data: {
        ...state.data,
        profiles: [...state.data.profiles, newProfile],
      },
    }));
    get().saveData();
  },

  deleteProfile: (profileId: string) => {
    const { data } = get();

    // Don't allow deleting if it's the only profile
    if (data.profiles.length <= 1) return;

    // Don't allow deleting current profile, switch first
    if (data.currentProfileId === profileId) {
      const remainingProfiles = data.profiles.filter((p) => p.id !== profileId);
      if (remainingProfiles.length > 0) {
        set((state) => ({
          data: {
            ...state.data,
            profiles: remainingProfiles,
            currentProfileId: remainingProfiles[0].id,
          },
          selectedFolderId: remainingProfiles[0].folders[0]?.id || "default",
        }));
      }
    } else {
      set((state) => ({
        data: {
          ...state.data,
          profiles: state.data.profiles.filter((p) => p.id !== profileId),
        },
      }));
    }
    get().saveData();
  },

  renameProfile: (profileId: string, newName: string) => {
    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === profileId
            ? { ...p, name: newName, updatedAt: new Date().toISOString() }
            : p
        ),
      },
    }));
    get().saveData();
  },

  setCurrentProfile: (profileId: string) => {
    const { data } = get();
    const profile = data.profiles.find((p) => p.id === profileId);
    if (profile) {
      set({
        data: {
          ...data,
          currentProfileId: profileId,
        },
        selectedFolderId: profile.folders[0]?.id || "default",
      });
      get().saveData();
    }
  },

  getCurrentProfile: () => {
    const { data } = get();
    return data.profiles.find((p) => p.id === data.currentProfileId);
  },

  exportAllProfiles: () => {
    const { data } = get();
    exportAllProfiles(data);
  },

  exportCurrentProfile: () => {
    const { data } = get();
    const currentProfile = data.profiles.find(
      (p) => p.id === data.currentProfileId
    );
    if (currentProfile) {
      exportProfile(currentProfile);
    }
  },

  // Folder operations (profile-aware)
  addFolder: (name: string) => {
    const { data } = get();
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      secrets: [],
    };

    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === state.data.currentProfileId
            ? {
                ...p,
                folders: [...p.folders, newFolder],
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      },
    }));
    get().saveData();
  },

  deleteFolder: (folderId: string) => {
    const { data, selectedFolderId } = get();

    set((state) => {
      const updatedProfiles = state.data.profiles.map((p) =>
        p.id === state.data.currentProfileId
          ? {
              ...p,
              folders: p.folders.filter((f) => f.id !== folderId),
              updatedAt: new Date().toISOString(),
            }
          : p
      );

      // Update selected folder if the deleted folder was selected
      const currentProfile = updatedProfiles.find(
        (p) => p.id === state.data.currentProfileId
      );
      const newSelectedFolderId =
        selectedFolderId === folderId
          ? currentProfile?.folders[0]?.id || "default"
          : selectedFolderId;

      return {
        data: {
          ...state.data,
          profiles: updatedProfiles,
        },
        selectedFolderId: newSelectedFolderId,
      };
    });
    get().saveData();
  },

  renameFolder: (folderId: string, newName: string) => {
    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === state.data.currentProfileId
            ? {
                ...p,
                folders: p.folders.map((f) =>
                  f.id === folderId ? { ...f, name: newName } : f
                ),
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      },
    }));
    get().saveData();
  },

  // Secret operations (profile-aware)
  addSecret: (folderId: string, secretData) => {
    const now = new Date().toISOString();
    const newSecret: Secret = {
      ...secretData,
      description: secretData.description || "",
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === state.data.currentProfileId
            ? {
                ...p,
                folders: p.folders.map((f) =>
                  f.id === folderId
                    ? { ...f, secrets: [...f.secrets, newSecret] }
                    : f
                ),
                updatedAt: now,
              }
            : p
        ),
      },
    }));
    get().saveData();
  },

  updateSecret: (folderId: string, secretId: string, updates) => {
    const now = new Date().toISOString();

    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === state.data.currentProfileId
            ? {
                ...p,
                folders: p.folders.map((f) =>
                  f.id === folderId
                    ? {
                        ...f,
                        secrets: f.secrets.map((s) =>
                          s.id === secretId
                            ? { ...s, ...updates, updatedAt: now }
                            : s
                        ),
                      }
                    : f
                ),
                updatedAt: now,
              }
            : p
        ),
      },
    }));
    get().saveData();
  },

  deleteSecret: (folderId: string, secretId: string) => {
    const now = new Date().toISOString();

    set((state) => ({
      data: {
        ...state.data,
        profiles: state.data.profiles.map((p) =>
          p.id === state.data.currentProfileId
            ? {
                ...p,
                folders: p.folders.map((f) =>
                  f.id === folderId
                    ? {
                        ...f,
                        secrets: f.secrets.filter((s) => s.id !== secretId),
                      }
                    : f
                ),
                updatedAt: now,
              }
            : p
        ),
      },
    }));
    get().saveData();
  },

  setSelectedFolder: (folderId: string) => {
    set({ selectedFolderId: folderId });
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  setSelectedTags: (tags: string[]) => {
    set({ selectedTags: tags });
  },

  getFilteredSecrets: () => {
    const { data, selectedFolderId, searchTerm, selectedTags } = get();
    const currentProfile = data.profiles.find(
      (p) => p.id === data.currentProfileId
    );
    if (!currentProfile) return [];

    const folder = currentProfile.folders.find(
      (f) => f.id === selectedFolderId
    );
    if (!folder) return [];

    return folder.secrets.filter((secret) => {
      const matchesSearch =
        !searchTerm ||
        secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        secret.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (secret.description &&
          secret.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => secret.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  },

  getAllTags: () => {
    const { data } = get();
    const currentProfile = data.profiles.find(
      (p) => p.id === data.currentProfileId
    );
    if (!currentProfile) return [];

    const allTags = new Set<string>();
    currentProfile.folders.forEach((folder) => {
      folder.secrets.forEach((secret) => {
        secret.tags.forEach((tag) => allTags.add(tag));
      });
    });
    return Array.from(allTags).sort();
  },
}));
