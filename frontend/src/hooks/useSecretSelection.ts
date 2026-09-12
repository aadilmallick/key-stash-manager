import { useCallback, useMemo, useState } from "react";

// Ephemeral, non-persisted checkbox-selection state for secrets (either the
// current folder's list or a global search result set). Mirrors
// useAppState's searchTerm precedent: selection resetting on reload/folder
// switch is desired, not a bug.
export interface SecretSelection {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
}

export function useSecretSelection(): SecretSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return useMemo(
    () => ({ selectedIds, isSelected, toggle, selectAll, clear }),
    [selectedIds, isSelected, toggle, selectAll, clear],
  );
}
