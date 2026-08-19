import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { Collections, getCollections } from "@/lib/db/collections";
import { seedCollectionsIfNeeded } from "@/lib/db/migrations";
import { getOrCreateVaultKey } from "@/lib/crypto";

type DbState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; collections: Collections; vaultKey: CryptoKey };

type DbContextValue =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | {
      status: "ready";
      collections: Collections;
      vaultKey: CryptoKey;
      isSyncing: boolean;
      setIsSyncing: (syncing: boolean) => void;
    };

const DbContext = createContext<DbContextValue>({ status: "loading" });

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DbState>({ status: "loading" });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [collections, vaultKey] = await Promise.all([
          getCollections(),
          getOrCreateVaultKey(),
        ]);
        await seedCollectionsIfNeeded(collections, vaultKey);
        if (!cancelled) {
          setState({ status: "ready", collections, vaultKey });
        }
      } catch (error) {
        console.error("Failed to initialize vault:", error);
        if (!cancelled) setState({ status: "error", error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: DbContextValue =
    state.status === "ready"
      ? { ...state, isSyncing, setIsSyncing }
      : state;

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDbContext(): DbContextValue {
  return useContext(DbContext);
}

// Convenience hook for components that only render once the vault is ready
// (i.e. mounted below a status==="ready" gate, such as Index.tsx). Throws if
// called before that gate, which is intentional - it surfaces wiring bugs
// immediately instead of silently rendering with undefined collections.
export function useDbCollections(): {
  collections: Collections;
  vaultKey: CryptoKey;
} {
  const state = useDbContext();
  if (state.status !== "ready") {
    throw new Error("useDbCollections called before the vault is ready");
  }
  return { collections: state.collections, vaultKey: state.vaultKey };
}
