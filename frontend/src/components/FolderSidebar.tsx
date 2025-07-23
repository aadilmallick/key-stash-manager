import React, { useState } from "react";
import { useSecretsStore } from "../store/secretsStore";
import { Folder, Plus, Pencil, Trash2, Settings, User } from "lucide-react";
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

const FolderSidebar = () => {
  const {
    data,
    selectedFolderId,
    setSelectedFolder,
    addFolder,
    deleteFolder,
    renameFolder,
    getCurrentProfile,
  } = useSecretsStore();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editFolderName, setEditFolderName] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentProfile = getCurrentProfile();

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
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 truncate">
              {currentProfile.name}
            </h3>
            <p className="text-xs text-gray-500">
              {currentProfile.folders.length} folder(s) •
              {currentProfile.folders.reduce(
                (acc, folder) => acc + folder.secrets.length,
                0
              )}{" "}
              secret(s)
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
            <Button variant="outline" size="sm">
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

      <div className="space-y-1 overflow-y-auto max-h-[60vh]" role="list">
        {currentProfile.folders.map((folder) => (
          <div
            key={folder.id}
            className={`flex items-center justify-between p-2 rounded-md cursor-pointer group ${
              selectedFolderId === folder.id
                ? "bg-blue-100 text-blue-900"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setSelectedFolder(folder.id)}
          >
            <div className="flex items-center gap-2 flex-1">
              <Folder className="h-4 w-4" />
              {editingFolderId === folder.id ? (
                <Input
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(folder.id);
                    if (e.key === "Escape") setEditingFolderId(null);
                  }}
                  onBlur={() => handleRenameFolder(folder.id)}
                  className="h-6 text-sm"
                  autoFocus
                />
              ) : (
                <span className="text-sm">{folder.name}</span>
              )}
              <span className="text-xs text-gray-500">
                ({folder.secrets.length})
              </span>
            </div>

            {folder.id !== "default" && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(folder.id, folder.name);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this folder and all its secrets?")) {
                      deleteFolder(folder.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
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
