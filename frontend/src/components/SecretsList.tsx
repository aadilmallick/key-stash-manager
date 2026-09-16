import React, { useEffect, useState } from "react";
import { Secret } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FileDown,
  Import,
  LucideDownload,
  LucideFolder,
  Plus,
  Search,
} from "lucide-react";
import SecretModal from "./SecretModal";
import ExportSecretsModal from "./secrets/ExportSecretsModal";
import ExportFormatModal from "./secrets/ExportFormatModal";
import SecretRow from "./secrets/SecretRow";
import { computeReorderedIds } from "@/lib/reorder";
import {
  buildDotenvContent,
  formatDotenvLine,
  isValidSecretName,
  partitionExportable,
} from "@/lib/secretExportFormat";
import { useToast } from "@/components/ui/use-toast";
import { useSync } from "@/hooks/useSync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useCurrentProfile } from "@/hooks/useProfiles";
import { useFoldersForProfile, useSelectedFolderId } from "@/hooks/useFolders";
import {
  useDecryptedSecretsForFolder,
  useSecretActions,
} from "@/hooks/useSecrets";
import { useAppState } from "@/hooks/useAppState";
import { useConfirm } from "@/hooks/useConfirm";
import { useSecretSelection } from "@/hooks/useSecretSelection";
import { useDbCollections } from "@/hooks/useDb";
import {
  buildEncryptedShare,
  exportAllProfilesFile,
  importAllFromJson,
  importEncryptedShare,
} from "@/lib/db/importExport";

const SecretsList = () => {
  const { collections, vaultKey } = useDbCollections();
  const currentProfile = useCurrentProfile();
  const [selectedFolderId] = useSelectedFolderId();
  const folders = useFoldersForProfile(currentProfile?.id);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const {
    secrets: decryptedSecrets,
    loading: secretsLoading,
    error: secretsError,
  } = useDecryptedSecretsForFolder(selectedFolderId);
  const { addSecret, updateSecret, deleteSecret, reorderSecretsInFolder } =
    useSecretActions();
  const { searchTerm, setSearchTerm } = useAppState();
  const confirm = useConfirm();
  const selection = useSecretSelection();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormatTarget, setExportFormatTarget] = useState<
    "all" | "folder" | null
  >(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportEnvOpen, setIsImportEnvOpen] = useState(false);
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
  const [importEnvFileContents, setImportEnvFileContents] = useState<string>(
    "",
  );
  const [encryptedShareFile, setEncryptedShareFile] = useState<File | null>(
    null,
  );
  const [encryptedShareToken, setEncryptedShareToken] = useState("");
  const [isImportingShare, setIsImportingShare] = useState(false);

  const filteredSecrets = decryptedSecrets.filter((secret) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      secret.name.toLowerCase().includes(term) ||
      secret.value.toLowerCase().includes(term) ||
      (secret.description && secret.description.toLowerCase().includes(term))
    );
  });

  // Selection is scoped to whatever's currently visible - stale ids from a
  // previous folder/search shouldn't silently carry over.
  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId]);

  const selectAllState = selection.selectAllState(
    filteredSecrets.map((s) => s.id),
  );

  const selectedSecretsForExport = decryptedSecrets
    .filter((s) => selection.isSelected(s.id))
    .map((s) => ({ name: s.name, value: s.value }));

  // Explicit field allow-list so DB-internal fields (folderId, order)
  // don't leak into an exported wire-format Secret, mirroring
  // buildNestedSecretsData's own convention in lib/db/importExport.ts.
  const toWireSecret = (s: typeof decryptedSecrets[number]): Secret => ({
    id: s.id,
    name: s.name,
    value: s.value,
    description: s.description,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  });

  const selectedFullSecrets = decryptedSecrets
    .filter((s) => selection.isSelected(s.id))
    .map(toWireSecret);

  // Reordering a filtered subset against the folder's true order would be
  // confusing, so drag-based reordering only works while unfiltered.
  const reorderingDisabled = searchTerm.trim().length > 0;

  const handleReorderDrop = (
    draggedSecretId: string,
    targetSecretId: string,
    dropBefore: boolean,
  ) => {
    const orderedIds = decryptedSecrets.map((s) => s.id);
    const newOrder = computeReorderedIds(
      orderedIds,
      draggedSecretId,
      targetSecretId,
      dropBefore,
    );
    reorderSecretsInFolder(selectedFolderId, newOrder);
  };

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
    if (!isValidSecretName(name)) {
      toast({
        title: "Copy failed",
        description:
          `"${name}" isn't a valid environment variable name, so it can't be copied as NAME=value.`,
        variant: "destructive",
      });
      return;
    }
    await copyToClipboard(formatDotenvLine(name, value), secretId);
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

  const handleDeleteSecret = async (secretId: string) => {
    const confirmed = await confirm({
      title: "Delete secret",
      description: "Are you sure you want to delete this secret?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
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
      const { exportable, skippedNames } = partitionExportable(
        decryptedSecrets.map((secret) => ({
          name: secret.name,
          value: secret.value,
        })),
      );
      const envContents = buildDotenvContent(exportable);
      await navigator.clipboard.writeText(envContents);
      if (skippedNames.length > 0) {
        toast({
          title: "Copied to clipboard",
          description:
            `Skipped ${skippedNames.length} secret(s) with names that aren't valid env vars: ${
              skippedNames.join(", ")
            }`,
        });
      } else {
        toast({
          title: "Copied to clipboard",
          description: "Copied folder as .env to clipboard",
        });
      }

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
    setIsImportEnvOpen(false);
    // check if there is content to import
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

  async function importEncryptedShareFile() {
    if (!encryptedShareFile || !encryptedShareToken.trim()) return;

    setIsImportOpen(false);

    const confirmed = await confirm({
      title: "Import encrypted share",
      description:
        "This will overwrite all current data if the file is a full export, or add a new profile alongside your existing ones if it's a single profile. This action cannot be undone.",
      confirmLabel: "Import",
      variant: "destructive",
    });
    if (!confirmed) return;

    setIsImportingShare(true);
    try {
      const ciphertextText = await encryptedShareFile.text();
      await importEncryptedShare(
        ciphertextText,
        encryptedShareToken.trim(),
        collections,
        vaultKey,
      );
      saveChangesToServer();
      toast({
        title: "Import successful",
        description: "The encrypted share has been decrypted and imported.",
      });
      setEncryptedShareFile(null);
      setEncryptedShareToken("");
    } catch (e) {
      toast({
        title: "Import failed",
        description:
          "Couldn't decrypt this share. Check that the file and token match.",
        variant: "destructive",
      });
    } finally {
      setIsImportingShare(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedFolder?.name || "Secrets"}
            </h1>
            {currentProfile && (
              <p className="text-sm text-gray-600">
                Profile: {currentProfile.name}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="bg-orange-300 border-2 border-orange-700 cursor-pointer text-orange-950 font-medium hover:bg-orange-400"
                onClick={() => setIsImportOpen(true)}
              >
                <Import className="h-4 w-4 mr-2" />
                Import Secrets
              </Button>
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="bg-emerald-300 border-2 border-emerald-700 cursor-pointer text-emerald-950 font-medium hover:bg-emerald-400"
                onClick={() => setIsImportEnvOpen(true)}
              >
                <Import className="h-4 w-4 mr-2" color="#064e3b" />
                Import Env file
              </Button>
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="border-2 border-gray-900 cursor-pointer hover:bg-gray-900 hover:text-white transition-colors bg-blue-200 text-black"
                onClick={() => setExportFormatTarget("all")}
              >
                <LucideDownload className="h-4 w-4 mr-2" />
                Export All Profiles
              </Button>
              <Button
                variant="ghost"
                disabled={isSyncing}
                className="border-2 border-gray-900 cursor-pointer hover:bg-gray-900 hover:text-white transition-colors"
                onClick={() => {
                  if (!selectedFolder) {
                    toast({
                      title: "Export failed",
                      description: "No folder selected",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExportFormatTarget("folder");
                }}
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
              {selection.selectedIds.size > 0 && (
                <Button
                  variant="default"
                  className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  onClick={() => setIsExportModalOpen(true)}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export Selected ({selection.selectedIds.size})
                </Button>
              )}
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

        {secretsError
          ? (
            <div className="flex items-center justify-center h-full w-full min-h-[300px] text-center px-4">
              <p className="text-red-600">
                Failed to decrypt secrets in this folder. Try switching folders
                and back, or reload the page.
              </p>
            </div>
          )
          : isSyncing || secretsLoading
          ? (
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
                >
                </circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                >
                </path>
              </svg>
            </div>
          )
          : (
            <div>
              {filteredSecrets.length === 0
                ? (
                  <div className="text-center py-12 text-gray-500">
                    {decryptedSecrets.length === 0
                      ? <p>No secrets in this folder. Add your first secret!</p>
                      : <p>No secrets match your search criteria.</p>}
                  </div>
                )
                : (
                  <>
                    <div className="flex items-center gap-2 px-1 mb-3">
                      <Checkbox
                        id="select-all-secrets"
                        checked={selectAllState}
                        onCheckedChange={(checked) =>
                          checked
                            ? selection.selectAll(
                              filteredSecrets.map((s) => s.id),
                            )
                            : selection.clear()}
                        aria-label="Select all secrets"
                      />
                      <label
                        htmlFor="select-all-secrets"
                        className="text-sm text-gray-600 cursor-pointer"
                      >
                        Select all
                      </label>
                    </div>
                    <div
                      className="space-y-4 max-h-[60vh] overflow-y-scroll pb-8 styled-scrollbar"
                      role="list"
                    >
                      {filteredSecrets.map((secret) => (
                        <SecretRow
                          key={secret.id}
                          secret={secret}
                          isSelected={selection.isSelected(secret.id)}
                          onToggleSelect={(shiftKey) =>
                            selection.handleCheckboxClick(
                              secret.id,
                              filteredSecrets.map((s) => s.id),
                              shiftKey,
                            )}
                          isVisible={visibleSecrets.has(secret.id)}
                          onToggleVisibility={() =>
                            toggleSecretVisibility(secret.id)}
                          isCopied={copiedSecrets.has(secret.id)}
                          onCopyValue={() =>
                            copyToClipboard(secret.value, secret.id)}
                          onCopyEnv={() =>
                            copyEnv(secret.name, secret.value, secret.id)}
                          onEdit={() => {
                            setEditingSecret(secret);
                            setIsModalOpen(true);
                          }}
                          onDelete={() => handleDeleteSecret(secret.id)}
                          reorderingDisabled={reorderingDisabled}
                          onReorderDrop={handleReorderDrop}
                        />
                      ))}
                    </div>
                  </>
                )}
            </div>
          )}

        {/* for importing all secrets*/}

        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent
            id="import-modal"
            className="max-h-[85vh] overflow-y-auto styled-scrollbar"
          >
            <DialogHeader>
              <DialogTitle>Import JSON configuration</DialogTitle>
              <DialogDescription>
                You can override all current secrets and folders by importing a
                JSON file (one that's exported from this website).
              </DialogDescription>
            </DialogHeader>
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
                  setIsImportOpen(false);
                  const shouldContinue = await confirm({
                    title: "Import and overwrite data",
                    description:
                      "Are you sure you want to import your data? This will overwrite all data for all profiles.",
                    confirmLabel: "Import",
                    variant: "destructive",
                  });
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

            <div className="pt-4 mt-4 border-t space-y-2">
              <h4 className="text-base font-bold">
                Or import an encrypted share
              </h4>
              <p className="text-sm text-muted-foreground">
                Received an encrypted file and a decryption token from someone
                else? Upload the file and paste the token here.
              </p>
              <p className="text-red-400 text-sm">
                Caution: this may overwrite all current data (if it's a full
                export) or add a new profile (if it's a single profile). This
                cannot be undone.
              </p>

              <div>
                <Label htmlFor="encrypted-share-file">Encrypted file</Label>
                <Input
                  id="encrypted-share-file"
                  type="file"
                  onChange={(e) =>
                    setEncryptedShareFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label htmlFor="encrypted-share-token">Decryption token</Label>
                <Input
                  id="encrypted-share-token"
                  value={encryptedShareToken}
                  onChange={(e) => setEncryptedShareToken(e.target.value)}
                  placeholder="Paste the decryption token here"
                  className="font-mono text-xs"
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={!encryptedShareFile ||
                  !encryptedShareToken.trim() ||
                  isImportingShare}
                onClick={importEncryptedShareFile}
              >
                {isImportingShare ? "Importing..." : "Import Encrypted Share"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/*  for importing .env files or text content */}

        <Dialog open={isImportEnvOpen} onOpenChange={setIsImportEnvOpen}>
          <DialogContent id="import-env-modal">
            <DialogHeader>
              <DialogTitle>Import .env file</DialogTitle>
              <DialogDescription>
                You can import a .env file or its contents and choose which
                folder to export to.
              </DialogDescription>
            </DialogHeader>
            <p className="text-red-400 text-sm mb-4 font-semibold">
              Caution: this will override any environment variables with the
              same name.
            </p>

            <div className="space-y-2 pt-4">
              <Label>.env file</Label>
              <Input
                id="json file"
                type="file"
                placeholder="jsonfile.txt"
                multiple={false}
                onChange={async (e) => {
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
          </DialogContent>
        </Dialog>

        <SecretModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSecret(undefined);
          }}
          secret={editingSecret}
          onSave={handleSaveSecret}
        />

        <ExportSecretsModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          secrets={selectedSecretsForExport}
          buildEncryptedShare={() =>
            buildEncryptedShare(collections, vaultKey, {
              type: "custom",
              profileName: `${currentProfile?.name ?? "Export"} (${selectedFullSecrets.length} secrets)`,
              folderName: selectedFolder?.name ?? "Selected Secrets",
              secrets: selectedFullSecrets,
            })}
        />

        <ExportFormatModal
          isOpen={exportFormatTarget !== null}
          onClose={() => setExportFormatTarget(null)}
          title={exportFormatTarget === "all"
            ? "Export All Profiles"
            : `Export Folder${
              selectedFolder ? `: ${selectedFolder.name}` : ""
            }`}
          description="Choose how to export this data - plaintext is immediately usable, encrypted requires the one-time token shown after encrypting."
          onExportPlaintext={exportFormatTarget === "all"
            ? onExport
            : onExportFolder}
          onExportEncrypted={() =>
            exportFormatTarget === "all"
              ? buildEncryptedShare(collections, vaultKey, { type: "all" })
              : buildEncryptedShare(collections, vaultKey, {
                type: "custom",
                profileName: `${currentProfile?.name ?? "Profile"} — ${
                  selectedFolder?.name ?? "Folder"
                }`,
                folderName: selectedFolder?.name ?? "Folder",
                secrets: decryptedSecrets.map(toWireSecret),
              })}
        />
      </div>
    </TooltipProvider>
  );
};

export default SecretsList;
