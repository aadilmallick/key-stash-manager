import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  Plus,
  Check,
  X,
  User,
  Settings,
  Download,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSync } from "@/hooks/useSync";
import { useDbCollections } from "@/hooks/useDb";
import {
  useCurrentProfile,
  useProfileActions,
  useProfileStats,
  useProfiles,
} from "@/hooks/useProfiles";
import {
  exportAllProfilesFile,
  exportProfileFile,
  importSingleProfile,
} from "@/lib/db/importExport";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileRow = ({
  profile,
  isCurrent,
  editingProfileId,
  editingProfileName,
  setEditingProfileName,
  startEditing,
  cancelEditing,
  handleRenameProfile,
  handleSwitchProfile,
  handleDeleteProfile,
  canDelete,
  isSyncing,
}: {
  profile: { id: string; name: string; createdAt: string };
  isCurrent: boolean;
  editingProfileId: string | null;
  editingProfileName: string;
  setEditingProfileName: (name: string) => void;
  startEditing: (id: string, name: string) => void;
  cancelEditing: () => void;
  handleRenameProfile: (id: string) => void;
  handleSwitchProfile: (id: string) => void;
  handleDeleteProfile: (id: string, name: string) => void;
  canDelete: boolean;
  isSyncing: boolean;
}) => {
  const { folderCount, secretCount } = useProfileStats(profile.id);

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCurrent ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {editingProfileId === profile.id ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingProfileName}
                onChange={(e) => setEditingProfileName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleRenameProfile(profile.id);
                  if (e.key === "Escape") cancelEditing();
                }}
                className="max-w-xs"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => handleRenameProfile(profile.id)}
                disabled={!editingProfileName.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{profile.name}</h3>
                {isCurrent && (
                  <Badge variant="default" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {folderCount} folder(s) • {secretCount} secret(s)
              </p>
              <p className="text-xs text-gray-500">
                Created: {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCurrent && (
            <Button
              size="sm"
              onClick={() => handleSwitchProfile(profile.id)}
              variant="outline"
            >
              Switch
            </Button>
          )}

          {editingProfileId !== profile.id && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEditing(profile.id, profile.name)}
              >
                <Edit className="h-4 w-4" />
              </Button>

              {canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteProfile(profile.id, profile.name)}
                  disabled={isSyncing}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileSettingsModal = ({
  isOpen,
  onClose,
}: ProfileSettingsModalProps) => {
  const { collections, vaultKey } = useDbCollections();
  const profiles = useProfiles();
  const currentProfile = useCurrentProfile();
  const { folderCount, secretCount } = useProfileStats(currentProfile?.id);
  const { addProfile, deleteProfile, renameProfile, setCurrentProfile } =
    useProfileActions();
  const {
    isSyncing,
    saveChangesToServer,
  } = useSync();

  const [newProfileName, setNewProfileName] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const { toast } = useToast();

  const handleAddProfile = () => {
    if (!newProfileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const exists = profiles.some(
      (p) => p.name.toLowerCase() === newProfileName.trim().toLowerCase(),
    );
    if (exists) {
      toast({
        title: "Error",
        description: "A profile with this name already exists",
        variant: "destructive",
      });
      return;
    }

    addProfile(newProfileName.trim());
    setNewProfileName("");
    toast({
      title: "Success",
      description: `Profile "${newProfileName}" created successfully`,
    });
    saveChangesToServer();
  };

  const handleDeleteProfile = (profileId: string, profileName: string) => {
    if (profiles.length <= 1) {
      toast({
        title: "Error",
        description: "Cannot delete the last profile",
        variant: "destructive",
      });
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete the profile "${profileName}"? This action cannot be undone.`,
      )
    ) {
      deleteProfile(profileId);
      toast({
        title: "Success",
        description: `Profile "${profileName}" deleted successfully`,
      });
      saveChangesToServer();
    }
  };

  const handleRenameProfile = (profileId: string) => {
    if (!editingProfileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const exists = profiles.some(
      (p) =>
        p.id !== profileId &&
        p.name.toLowerCase() === editingProfileName.trim().toLowerCase(),
    );
    if (exists) {
      toast({
        title: "Error",
        description: "A profile with this name already exists",
        variant: "destructive",
      });
      return;
    }

    renameProfile(profileId, editingProfileName.trim());
    setEditingProfileId(null);
    setEditingProfileName("");
    toast({
      title: "Success",
      description: "Profile renamed successfully",
    });
    saveChangesToServer();
  };

  const handleSwitchProfile = (profileId: string) => {
    setCurrentProfile(profileId);
    const profile = profiles.find((p) => p.id === profileId);
    toast({
      title: "Profile Switched",
      description: `Switched to "${profile?.name}"`,
    });
    saveChangesToServer();
    onClose();
  };

  const startEditing = (profileId: string, currentName: string) => {
    setEditingProfileId(profileId);
    setEditingProfileName(currentName);
  };

  const cancelEditing = () => {
    setEditingProfileId(null);
    setEditingProfileName("");
  };

  const handleImportProfile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        await importSingleProfile(content, collections, vaultKey);

        toast({
          title: "Success",
          description: "Profile imported successfully",
        });
        saveChangesToServer();
      } catch (error) {
        toast({
          title: "Error",
          description:
            "Failed to import profile. Please check the file format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    event.target.value = "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Profile Settings
            {isSyncing && (
              <span className="text-sm text-gray-500">Syncing...</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Profile Info */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Current Profile</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">
                  {currentProfile?.name}
                </h3>
                <p className="text-sm text-blue-700">
                  {folderCount} folder(s) • {secretCount} secret(s)
                </p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </div>

          {/* Import/Export Profiles */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Import/Export Profiles
            </Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  document.getElementById("import-profile")?.click()
                }
                disabled={isSyncing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Profile
              </Button>
              <input
                id="import-profile"
                type="file"
                accept=".json"
                onChange={handleImportProfile}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() =>
                  currentProfile &&
                  exportProfileFile(collections, vaultKey, currentProfile.id)
                }
                disabled={!currentProfile || isSyncing}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Current Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => exportAllProfilesFile(collections, vaultKey)}
                disabled={isSyncing}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All Profiles
              </Button>
            </div>
          </div>

          {/* Add New Profile */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Add New Profile</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddProfile()}
                className="flex-1"
              />
              <Button
                onClick={handleAddProfile}
                disabled={!newProfileName.trim() || isSyncing}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Profile
              </Button>
            </div>
          </div>

          {/* Profiles List */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              All Profiles ({profiles.length})
            </Label>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  isCurrent={profile.id === currentProfile?.id}
                  editingProfileId={editingProfileId}
                  editingProfileName={editingProfileName}
                  setEditingProfileName={setEditingProfileName}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  handleRenameProfile={handleRenameProfile}
                  handleSwitchProfile={handleSwitchProfile}
                  handleDeleteProfile={handleDeleteProfile}
                  canDelete={profiles.length > 1}
                  isSyncing={isSyncing}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsModal;
