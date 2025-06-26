import { create } from "zustand";
import { Secret, Folder, SecretsData } from "../types";

const STORAGE_KEY = "api-key-manager-secrets";

export function setLocalStorage(data: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getLocalStorage() {
  return localStorage.getItem(STORAGE_KEY);
}

const defaultData: SecretsData = {
  folders: [
    {
      id: "default",
      name: "Default",
      secrets: [],
    },
  ],
};

interface SecretsStore {
  data: SecretsData;
  selectedFolderId: string;
  searchTerm: string;
  selectedTags: string[];
  loadData: () => void;
  saveData: () => void;
  addFolder: (name: string) => void;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string) => void;
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

export const useSecretsStore = create<SecretsStore>((set, get) => ({
  data: defaultData,
  selectedFolderId: "default",
  searchTerm: "",
  selectedTags: [],

  loadData: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({ data });
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

  addFolder: (name: string) => {
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      secrets: [],
    };
    set((state) => ({
      data: {
        ...state.data,
        folders: [...state.data.folders, newFolder],
      },
    }));
    get().saveData();
  },

  deleteFolder: (folderId: string) => {
    set((state) => ({
      data: {
        ...state.data,
        folders: state.data.folders.filter((f) => f.id !== folderId),
      },
      selectedFolderId:
        state.selectedFolderId === folderId
          ? "default"
          : state.selectedFolderId,
    }));
    get().saveData();
  },

  renameFolder: (folderId: string, newName: string) => {
    set((state) => ({
      data: {
        ...state.data,
        folders: state.data.folders.map((f) =>
          f.id === folderId ? { ...f, name: newName } : f
        ),
      },
    }));
    get().saveData();
  },

  addSecret: (folderId: string, secretData) => {
    const now = new Date().toISOString();
    const newSecret: Secret = {
      ...secretData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      data: {
        ...state.data,
        folders: state.data.folders.map((f) =>
          f.id === folderId ? { ...f, secrets: [...f.secrets, newSecret] } : f
        ),
      },
    }));
    get().saveData();
  },

  updateSecret: (folderId: string, secretId: string, updates) => {
    set((state) => ({
      data: {
        ...state.data,
        folders: state.data.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                secrets: f.secrets.map((s) =>
                  s.id === secretId
                    ? { ...s, ...updates, updatedAt: new Date().toISOString() }
                    : s
                ),
              }
            : f
        ),
      },
    }));
    get().saveData();
  },

  deleteSecret: (folderId: string, secretId: string) => {
    set((state) => ({
      data: {
        ...state.data,
        folders: state.data.folders.map((f) =>
          f.id === folderId
            ? { ...f, secrets: f.secrets.filter((s) => s.id !== secretId) }
            : f
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
    const folder = data.folders.find((f) => f.id === selectedFolderId);
    if (!folder) return [];

    return folder.secrets.filter((secret) => {
      const matchesSearch =
        !searchTerm ||
        secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        secret.value.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => secret.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  },

  getAllTags: () => {
    const { data } = get();
    const allTags = new Set<string>();
    data.folders.forEach((folder) => {
      folder.secrets.forEach((secret) => {
        secret.tags.forEach((tag) => allTags.add(tag));
      });
    });
    return Array.from(allTags).sort();
  },
}));
