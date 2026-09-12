export const ItemTypes = {
  FOLDER: "folder",
  SECRET: "secret",
} as const;

export interface DraggedFolderItem {
  id: string;
}

export interface DraggedSecretItem {
  secretId: string;
  name: string;
  folderId: string;
}
