// Pure list-reordering logic shared by folder and secret drag-and-drop.
// The caller resolves `dropBefore` from the drop's cursor Y position vs.
// the hovered row's vertical midpoint; this function only deals with ids.
export function computeReorderedIds(
  currentOrderedIds: string[],
  draggedId: string,
  targetId: string,
  dropBefore: boolean,
): string[] {
  if (draggedId === targetId) return currentOrderedIds;

  const withoutDragged = currentOrderedIds.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);
  if (targetIndex === -1) return currentOrderedIds;

  const insertAt = dropBefore ? targetIndex : targetIndex + 1;
  withoutDragged.splice(insertAt, 0, draggedId);
  return withoutDragged;
}
