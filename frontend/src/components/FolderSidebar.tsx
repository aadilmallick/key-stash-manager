import React, { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  Folder,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ProfileSettingsModal from "./ProfileSettingsModal";
import {
  useCurrentProfile,
  useProfileFolderSecretCounts,
} from "@/hooks/useProfiles";
import {
  useFolderActions,
  useFolderSecretCounts,
  useFoldersForProfile,
  useSelectedFolderId,
} from "@/hooks/useFolders";
import { useSecretActions } from "@/hooks/useSecrets";
import { useConfirm } from "@/hooks/useConfirm";
import { computeReorderedIds } from "@/lib/reorder";
import {
  DraggedFolderItem,
  DraggedSecretItem,
  ItemTypes,
} from "@/lib/dnd/itemTypes";
import { FolderRow as FolderRowData } from "@/lib/db/schema";

interface FolderRowItemProps {
  folder: FolderRowData;
  isSelected: boolean;
  secretCount: number;
  canManage: boolean;
  isEditing: boolean;
  editFolderName: string;
  onSelect: () => void;
  onStartEditing: () => void;
  onEditNameChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditBlur: () => void;
  onDelete: () => void;
  onReorderFolder: (
    draggedFolderId: string,
    targetFolderId: string,
    dropBefore: boolean,
  ) => void;
  onSecretDrop: (item: DraggedSecretItem, targetFolderId: string) => void;
}

const FolderRowItem = ({
  folder,
  isSelected,
  secretCount,
  canManage,
  isEditing,
  editFolderName,
  onSelect,
  onStartEditing,
  onEditNameChange,
  onEditKeyDown,
  onEditBlur,
  onDelete,
  onReorderFolder,
  onSecretDrop,
}: FolderRowItemProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<
    DraggedFolderItem | DraggedSecretItem,
    void,
    { isOver: boolean }
  >({
    accept: [ItemTypes.FOLDER, ItemTypes.SECRET],
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    drop: (item, monitor) => {
      if (!rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      const dropBefore = clientOffset
        ? clientOffset.y < rect.top + rect.height / 2
        : true;

      if (monitor.getItemType() === ItemTypes.SECRET) {
        onSecretDrop(item as DraggedSecretItem, folder.id);
      } else {
        const { id: draggedFolderId } = item as DraggedFolderItem;
        if (draggedFolderId !== folder.id) {
          onReorderFolder(draggedFolderId, folder.id, dropBefore);
        }
      }
    },
  });

  const [{ isDragging }, drag] = useDrag<
    DraggedFolderItem,
    void,
    { isDragging: boolean }
  >({
    type: ItemTypes.FOLDER,
    item: { id: folder.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  drag(handleRef);
  drop(rowRef);

  return (
    <div
      ref={rowRef}
      role="listitem"
      className={`flex items-center justify-between flex-wrap gap-y-2 p-2 rounded-md cursor-pointer group transition-colors ${
        isDragging ? "opacity-40" : ""
      } ${
        isOver
          ? "bg-blue-50 ring-2 ring-blue-400"
          : isSelected
          ? "bg-blue-100 text-blue-900"
          : "hover:bg-gray-100"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 flex-1">
        <div
          ref={handleRef}
          role="button"
          tabIndex={0}
          className="text-gray-400 cursor-grab hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Drag to reorder ${folder.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Folder className="h-4 w-4" />
        {isEditing
          ? (
            <Input
              value={editFolderName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={onEditKeyDown}
              onBlur={onEditBlur}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-sm"
              autoFocus
            />
          )
          : <span className="text-sm">{folder.name}</span>}
        <span
          className={`text-xs ${
            isSelected ? "text-blue-700 font-medium" : "text-gray-500"
          }`}
        >
          ({secretCount})
        </span>
      </div>

      {canManage && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label={`Edit ${folder.name} folder`}
            onClick={(e) => {
              e.stopPropagation();
              onStartEditing();
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-600"
            aria-label={`Delete ${folder.name} folder`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

const FolderSidebar = () => {
  const currentProfile = useCurrentProfile();
  const folders = useFoldersForProfile(currentProfile?.id);
  const folderSecretCounts = useFolderSecretCounts(currentProfile?.id);
  const profileCounts = useProfileFolderSecretCounts();
  const { folderCount, secretCount } = profileCounts.get(
    currentProfile?.id ?? "",
  ) ?? { folderCount: 0, secretCount: 0 };
  const [selectedFolderId, setSelectedFolderId] = useSelectedFolderId();
  const { addFolder, deleteFolder, renameFolder, reorderFolders } =
    useFolderActions();
  const { findDuplicateInFolder, moveSecretToFolder } = useSecretActions();
  const confirm = useConfirm();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editFolderName, setEditFolderName] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setNewFolderName("");
      setIsAddingFolder(false);
    }
  };

  const handleRenameFolder = (folderId: string) => {
    if (editFolderName.trim()) {
      renameFolder(folderId, editFolderName.trim());
      setEditingFolderId(null);
      setEditFolderName("");
    }
  };

  const startEditing = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditFolderName(currentName);
  };

  const handleReorderFolder = (
    draggedFolderId: string,
    targetFolderId: string,
    dropBefore: boolean,
  ) => {
    const orderedIds = folders.map((f) => f.id);
    const newOrder = computeReorderedIds(
      orderedIds,
      draggedFolderId,
      targetFolderId,
      dropBefore,
    );
    reorderFolders(newOrder);
  };

  // Cross-folder secret move. Checks for a name collision *before*
  // mutating anything - if the user cancels the resulting confirm, nothing
  // has changed, which is the "rollback" the feature asks for.
  const handleSecretDrop = async (
    item: DraggedSecretItem,
    targetFolderId: string,
  ) => {
    if (item.folderId === targetFolderId) return;

    const duplicate = findDuplicateInFolder(item.secretId, targetFolderId);
    if (duplicate) {
      const confirmed = await confirm({
        title: "Secret already exists",
        description:
          `"${item.name}" already exists in this folder. Overwrite it?`,
        confirmLabel: "Overwrite",
        variant: "destructive",
      });
      if (!confirmed) return;
      moveSecretToFolder(item.secretId, targetFolderId, duplicate.id);
    } else {
      moveSecretToFolder(item.secretId, targetFolderId);
    }
  };

  if (!currentProfile) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex items-center justify-center">
        <p className="text-gray-500">No profile selected</p>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
      {/* Profile Header */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Profile</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="h-6 w-6 p-0"
            title="Profile Settings"
            aria-label="Profile Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 truncate text-base">
              {currentProfile.name}
            </h2>
            <p className="text-xs text-gray-500">
              {folderCount} folder(s) • {secretCount} secret(s)
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        </div>
      </div>

      {/* Folders Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Folders</h2>
        <Dialog open={isAddingFolder} onOpenChange={setIsAddingFolder}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Add folder">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddFolder}
                  disabled={!newFolderName.trim()}
                >
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAddingFolder(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div
        className="space-y-1 overflow-y-scroll max-h-[60vh] styled-scrollbar"
        role="list"
      >
        {folders.map((folder) => (
          <FolderRowItem
            key={folder.id}
            folder={folder}
            isSelected={selectedFolderId === folder.id}
            secretCount={folderSecretCounts.get(folder.id) ?? 0}
            canManage={folder.id !== "default"}
            isEditing={editingFolderId === folder.id}
            editFolderName={editFolderName}
            onSelect={() => setSelectedFolderId(folder.id)}
            onStartEditing={() => startEditing(folder.id, folder.name)}
            onEditNameChange={setEditFolderName}
            onEditKeyDown={(e) => {
              if (e.key === "Enter") handleRenameFolder(folder.id);
              if (e.key === "Escape") setEditingFolderId(null);
            }}
            onEditBlur={() => handleRenameFolder(folder.id)}
            onDelete={async () => {
              const confirmed = await confirm({
                title: "Delete folder",
                description:
                  "Delete this folder and all its secrets? This action cannot be undone.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (confirmed) {
                deleteFolder(folder.id);
              }
            }}
            onReorderFolder={handleReorderFolder}
            onSecretDrop={handleSecretDrop}
          />
        ))}
      </div>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default FolderSidebar;
