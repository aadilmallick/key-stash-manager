import React, { useState } from "react";
import { Secret } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  Search,
  Copy,
  Check,
  Import,
  LucideXCircle,
  LucideDownload,
  LucideFolder,
} from "lucide-react";
import SecretModal from "./SecretModal";
import { useToast } from "@/components/ui/use-toast";
import { useSync } from "@/hooks/useSync";
import { HideDialogButton, ToggleDialogButton } from "./custom/PopoverButtons";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useCurrentProfile } from "@/hooks/useProfiles";
import { useFoldersForProfile, useSelectedFolderId } from "@/hooks/useFolders";
import { useDecryptedSecretsForFolder, useSecretActions } from "@/hooks/useSecrets";
import { useAppState } from "@/hooks/useAppState";
import { useDbCollections } from "@/hooks/useDb";
import { exportAllProfilesFile, importAllFromJson } from "@/lib/db/importExport";

const SecretsList = () => {
  const { collections, vaultKey } = useDbCollections();
  const currentProfile = useCurrentProfile();
  const [selectedFolderId] = useSelectedFolderId();
  const folders = useFoldersForProfile(currentProfile?.id);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const { secrets: decryptedSecrets, loading: secretsLoading } =
    useDecryptedSecretsForFolder(selectedFolderId);
  const { addSecret, updateSecret, deleteSecret } = useSecretActions();
  const { searchTerm, setSearchTerm } = useAppState();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | undefined>();
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecrets, setCopiedSecrets] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const {
    isSyncing,
    startSyncLoading,
    stopSyncLoading,
    saveChangesToServer,
  } = useSync();
  const [importEnvFileContents, setImportEnvFileContents] =
    useState<string>("");

  const filteredSecrets = decryptedSecrets.filter((secret) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      secret.name.toLowerCase().includes(term) ||
      secret.value.toLowerCase().includes(term) ||
      (secret.description && secret.description.toLowerCase().includes(term))
    );
  });

  const toggleSecretVisibility = (secretId: string) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  async function copyEnv(name: string, value: string, secretId: string) {
    await copyToClipboard(`${name}=${value}`, secretId);
  }

  const copyToClipboard = async (value: string, secretId: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecrets((prev) => new Set(prev).add(secretId));
      toast({
        title: "Copied to clipboard",
        description: "Secret value has been copied to your clipboard.",
      });
      setTimeout(() => {
        setCopiedSecrets((prev) => {
          const newSet = new Set(prev);
          newSet.delete(secretId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  async function onExport() {
    try {
      await exportAllProfilesFile(collections, vaultKey);
      toast({
        title: "Export succeeded",
        description: "All profiles exported successfully!",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export profiles",
        variant: "destructive",
      });
    }
  }

  const handleSaveSecret = async (
    secretData: Omit<Secret, "id" | "createdAt" | "updatedAt">,
  ) => {
    if (editingSecret) {
      await updateSecret(editingSecret.id, secretData);
    } else {
      await addSecret(selectedFolderId, secretData);
    }
    setEditingSecret(undefined);
    saveChangesToServer();
  };

  const handleDeleteSecret = (secretId: string) => {
    if (confirm("Are you sure you want to delete this secret?")) {
      deleteSecret(secretId);
      saveChangesToServer();
    }
  };

  async function onExportFolder() {
    if (!selectedFolder) {
      toast({
        title: "Export failed",
        description: "No folder selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const strings = decryptedSecrets.map(
        (secret) => `${secret.name}=${secret.value}`,
      );
      const envContents = strings.join("\n");
      await navigator.clipboard.writeText(envContents);
      toast({
        title: "Copied to clipboard",
        description: "Copied folder as .env to clipbaord",
      });

      const blob = new Blob([envContents], {
        type: "text/plain",
      });
      const file = new File([blob], ".env", {
        type: "text/plain",
      });
      const link = document.createElement("a");
      const blobUrl = URL.createObjectURL(file);
      link.download = ".env";
      link.href = blobUrl;
      link.click();
      link.remove();
      toast({
        title: "export succeeded",
        description: "Make sure to keep your secrets safe!",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  }

  async function importEnvFile() {
    const modal = document.getElementById(
      "import-env-modal",
    ) as HTMLDialogElement;
    // 1. close the modal
    if (modal) {
      modal.close();
    }
    // 2. check if there is content to import
    if (!importEnvFileContents.trim()) {
      toast({
        title: "Import failed",
        description: "No content to import",
        variant: "destructive",
      });
      return;
    }

    // 3. parse the content
    const lines = importEnvFileContents.split("\n");
    const parsedSecrets: Array<{ name: string; value: string }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, name, value] = match;
        parsedSecrets.push({
          name: name.trim(),
          value: value.trim(),
        });
      }
    }

    if (parsedSecrets.length === 0) {
      toast({
        title: "Import failed",
        description: "No valid environment variables found",
        variant: "destructive",
      });
      return;
    }

    startSyncLoading();
    for (const secret of parsedSecrets) {
      const existing = decryptedSecrets.find((s) => s.name === secret.name);
      if (existing) {
        await updateSecret(existing.id, { value: secret.value });
      } else {
        await addSecret(selectedFolderId, { ...secret, description: "" });
      }
    }
    stopSyncLoading();

    saveChangesToServer();

    toast({
      title: "Import successful",
      description: `Imported ${parsedSecrets.length} environment variables`,
      variant: "default",
    });

    setImportEnvFileContents("");
  }

  async function importJSONFile(file: File) {
    const content = await file.text();
    if (!content) return;

    startSyncLoading();
    try {
      await importAllFromJson(content, collections, vaultKey);
      saveChangesToServer();
      toast({
        title: "Import successful",
        description: "Your secrets have been imported.",
        variant: "default",
      });
    } catch (e) {
      toast({
        title: "Import failed",
        description: "Failed to import JSON data. Structure is malformed.",
        variant: "destructive",
      });
    } finally {
      stopSyncLoading();
    }
  }

  const maskValue = (value: string) => {
    return "*".repeat(Math.min(value.length, 20));
  };

  return (
    <TooltipProvider>
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedFolder?.name || "Secrets"}
              </h1>
              {currentProfile && (
                <p className="text-sm text-gray-600">
                  Profile: {currentProfile.name}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <ToggleDialogButton
                dialogid="import-modal"
                variant="ghost"
                disabled={isSyncing}
                className="bg-orange-400 border-2 border-orange-700 cursor-pointer"
              >
                <Import className="h-4 w-4 mr-2" />
                Import Secrets
              </ToggleDialogButton>
              <ToggleDialogButton
                dialogid="import-env-modal"
                variant="ghost"
                disabled={isSyncing}
                className="bg-green-400 border-2 border-green-700 cursor-pointer"
              >
                <Import className="h-4 w-4 mr-2" color="#197a2c" />
                Import Env file
              </ToggleDialogButton>
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="border-2 border-gray-900 cursor-pointer hover:bg-gray-900 hover:text-white transition-colors bg-blue-200 text-black"
                onClick={onExport}
              >
                <LucideDownload className="h-4 w-4 mr-2" />
                Export All Profiles
              </Button>
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="border-2 border-gray-900 cursor-pointer hover:bg-gray-900 hover:text-white transition-colors"
                onClick={onExportFolder}
              >
                <LucideFolder className="h-4 w-4 mr-2" />
                Export Folder
              </Button>
              <Button
                className="cursor-pointer"
                disabled={isSyncing}
                onClick={() => setIsModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Secret
              </Button>
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search secrets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {isSyncing || secretsLoading ? (
          <div className="flex items-center justify-center h-full w-full min-h-[300px]">
            <svg
              className="animate-spin h-12 w-12 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              ></path>
            </svg>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-scroll pb-8">
            {filteredSecrets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {decryptedSecrets.length === 0 ? (
                  <p>No secrets in this folder. Add your first secret!</p>
                ) : (
                  <p>No secrets match your search criteria.</p>
                )}
              </div>
            ) : (
              filteredSecrets.map((secret) => (
                <div
                  key={secret.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900">{secret.name}</h3>
                      </div>
                      {secret.description && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-700 line-clamp-1 max-w-[60ch] text-ellipsis">
                            {secret.description}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center flex-wrap gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono flex-1 min-w-[12rem] text-ellipsis">
                          {visibleSecrets.has(secret.id)
                            ? secret.value
                            : maskValue(secret.value)}
                        </code>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleSecretVisibility(secret.id)}
                              >
                                {visibleSecrets.has(secret.id) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {visibleSecrets.has(secret.id)
                                  ? "Hide secret value"
                                  : "Show secret value"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(secret.value, secret.id)
                                }
                              >
                                {copiedSecrets.has(secret.id) ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {copiedSecrets.has(secret.id)
                                  ? "Copied!"
                                  : "Copy value only"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyEnv(secret.name, secret.value, secret.id)
                                }
                              >
                                {copiedSecrets.has(secret.id) ? (
                                  <Check className="h-4 w-4" color="#36b328" />
                                ) : (
                                  <Copy className="h-4 w-4" color="#36b328" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {copiedSecrets.has(secret.id)
                                  ? "Copied!"
                                  : "Copy as env variable (NAME=value)"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label="Edit secret"
                                onClick={() => {
                                  setEditingSecret(secret);
                                  setIsModalOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit secret</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSecret(secret.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete secret</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mt-2">
                        Created: {new Date(secret.createdAt).toLocaleDateString()} •
                        Updated: {new Date(secret.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* for importing all secrets*/}

        <dialog
          id="import-modal"
          className="px-4 py-12 rounded-lg border-2 border-gray-300 bg-white relative space-y-2"
        >
          <h3 className="text-lg font-bold">Import JSON configuration</h3>

          <HideDialogButton
            dialogid="import-modal"
            className="absolute top-1 right-1 cursor-pointer"
            variant="ghost"
          >
            <LucideXCircle color="red" className="w-8 h-8" />
          </HideDialogButton>
          <p className="text-sm text-muted-foreground">
            You can override all current secrets and folders by importing a
            JSON file (one that's exported from this website). Drag a file
            into the file selector to get started.
          </p>
          <p className="text-red-400 text-sm mb-4">
            Caution: this will override all current data, which is
            irrecoverable.
          </p>

          <div>
            <Label>Name</Label>
            <Input
              id="json file"
              type="file"
              placeholder="jsonfile.txt"
              multiple={false}
              onChange={async (e) => {
                const shouldContinue = confirm(
                  "are you sure you want to import your data? This will overwrite all data for all profiles.",
                );
                if (!shouldContinue) return;
                const target = e.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                  const file = target.files[0]!;
                  await importJSONFile(file);
                  target.value = ""; // Clear the input value
                }
              }}
            />
          </div>
        </dialog>

        {/*  for importing .env files or text content */}

        <dialog
          id="import-env-modal"
          className="px-4 py-8 rounded-lg border-2 border-gray-300 bg-white relative space-y-2"
        >
          <h3 className="text-lg font-bold">Import .env file</h3>
          <HideDialogButton
            dialogid="import-env-modal"
            className="absolute top-1 right-1 cursor-pointer"
            variant="ghost"
          >
            <LucideXCircle color="red" className="w-8 h-8" />
          </HideDialogButton>
          <p className="text-sm text-muted-foreground">
            You can import a .env file or its contents and choose which folder
            to export to.
          </p>
          <p className="text-red-400 text-sm mb-4 font-semibold">
            Caution: this will override any environment variables with the same
            name.
          </p>

          <div className="space-y-2 pt-4">
            <Label>.env file</Label>
            <Input
              id="json file"
              type="file"
              placeholder="jsonfile.txt"
              multiple={false}
              onChange={async (e) => {
                const shouldContinue = confirm(
                  "are you sure you want to import your data? This will overwrite all data.",
                );
                if (!shouldContinue) return;
                const target = e.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                  const file = target.files[0]!;
                  const content = await file.text();
                  setImportEnvFileContents(content);
                  target.value = ""; // Clear the input value
                }
              }}
            />
            <Textarea
              value={importEnvFileContents}
              onChange={(e) => setImportEnvFileContents(e.target.value)}
              className="h-40 w-full resize-none"
              placeholder="Or paste your .env file contents here"
            />
            <Button
              variant="default"
              className="w-full"
              onClick={importEnvFile}
            >
              Import
            </Button>
          </div>
        </dialog>

        <SecretModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSecret(undefined);
          }}
          secret={editingSecret}
          onSave={handleSaveSecret}
        />
      </div>
    </TooltipProvider>
  );
};

export default SecretsList;
