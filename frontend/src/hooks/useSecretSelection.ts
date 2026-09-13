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
  // Tri-state for a "select all" checkbox scoped to whatever ids are
  // currently visible (a filtered/searched subset), not all of selectedIds.
  selectAllState: (visibleIds: string[]) => boolean | "indeterminate";
  // Shift+click selects the contiguous range (within `orderedIds`) between
  // the last-clicked id and `id`, matching common checkbox-list UX (e.g.
  // Gmail). Plain click and Ctrl/Cmd+click both fall through to a normal
  // single toggle - every checkbox click is already additive/non-exclusive,
  // so Ctrl/Cmd+click doesn't need any special-case behavior of its own.
  handleCheckboxClick: (
    id: string,
    orderedIds: string[],
    shiftKey: boolean,
  ) => void;
}

export function useSecretSelection(): SecretSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

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
    setLastClickedId(null);
  }, []);

  const handleCheckboxClick = useCallback(
    (id: string, orderedIds: string[], shiftKey: boolean) => {
      if (shiftKey && lastClickedId && lastClickedId !== id) {
        const fromIndex = orderedIds.indexOf(lastClickedId);
        const toIndex = orderedIds.indexOf(id);
        if (fromIndex !== -1 && toIndex !== -1) {
          const [start, end] = fromIndex < toIndex
            ? [fromIndex, toIndex]
            : [toIndex, fromIndex];
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) next.add(orderedIds[i]);
            return next;
          });
          setLastClickedId(id);
          return;
        }
      }
      toggle(id);
      setLastClickedId(id);
    },
    [lastClickedId, toggle],
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const selectAllState = useCallback(
    (visibleIds: string[]): boolean | "indeterminate" => {
      const selectedVisibleCount = visibleIds.filter((id) =>
        selectedIds.has(id)
      ).length;
      if (visibleIds.length === 0 || selectedVisibleCount === 0) return false;
      return selectedVisibleCount === visibleIds.length ? true : "indeterminate";
    },
    [selectedIds],
  );

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      toggle,
      selectAll,
      clear,
      selectAllState,
      handleCheckboxClick,
    }),
    [
      selectedIds,
      isSelected,
      toggle,
      selectAll,
      clear,
      selectAllState,
      handleCheckboxClick,
    ],
  );
}
