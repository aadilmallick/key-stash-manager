import React, { createContext, useContext, useMemo, useState } from "react";

// Ephemeral, non-persisted UI state. Deliberately NOT stored in the `config`
// collection like currentProfileId/selectedFolderId - a stale search filter
// silently hiding secrets after a reload would be confusing/unsafe UX.
interface AppState {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const value = useMemo(() => ({ searchTerm, setSearchTerm }), [searchTerm]);
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
