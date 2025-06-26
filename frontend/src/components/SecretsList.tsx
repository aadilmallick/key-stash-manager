import React, { useState } from "react";
import { setLocalStorage, useSecretsStore } from "../store/secretsStore";
import { Secret } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  Search,
  Copy,
  Check,
  Loader2,
  Import,
  LucideXCircle,
} from "lucide-react";
import SecretModal from "./SecretModal";
import { useToast } from "@/components/ui/use-toast";
import useSync from "@/hooks/useSync";
import { HideDialogButton, ToggleDialogButton } from "./custom/PopoverButtons";
import { Dialog, DialogContent, DialogTitle } from "@radix-ui/react-dialog";
import { DialogHeader } from "./ui/dialog";
import { Label } from "recharts";
import { parseToAppJSON } from "@/lib/utils";

const SecretsList = () => {
  const {
    data,
    selectedFolderId,
    searchTerm,
    selectedTags,
    setSearchTerm,
    setSelectedTags,
    addSecret,
    updateSecret,
    deleteSecret,
    getFilteredSecrets,
    getAllTags,
    loadData,
  } = useSecretsStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | undefined>();
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecrets, setCopiedSecrets] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { pushChangesToServer, isSyncing, startSyncLoading, stopSyncLoading } =
    useSync();

  async function saveChangesToServer() {
    try {
      startSyncLoading();
      await pushChangesToServer();
      stopSyncLoading();
    } catch (e) {
      stopSyncLoading();
    }
  }

  const selectedFolder = data.folders.find((f) => f.id === selectedFolderId);
  const filteredSecrets = getFilteredSecrets();
  const allTags = getAllTags();

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

  const handleSaveSecret = (
    secretData: Omit<Secret, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editingSecret) {
      updateSecret(selectedFolderId, editingSecret.id, secretData);
    } else {
      addSecret(selectedFolderId, secretData);
    }
    setEditingSecret(undefined);
    saveChangesToServer();
  };

  const handleDeleteSecret = (secretId: string) => {
    if (confirm("Are you sure you want to delete this secret?")) {
      deleteSecret(selectedFolderId, secretId);
      saveChangesToServer();
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  };

  const maskValue = (value: string) => {
    return "*".repeat(Math.min(value.length, 20));
  };

  const List = () => {
    return (
      <div className="space-y-4">
        {filteredSecrets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedFolder?.secrets.length === 0 ? (
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
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-gray-900">{secret.name}</h3>
                    {secret.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono flex-1">
                      {visibleSecrets.has(secret.id)
                        ? secret.value
                        : maskValue(secret.value)}
                    </code>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(secret.value, secret.id)}
                    >
                      {copiedSecrets.has(secret.id) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500">
                    Created: {new Date(secret.createdAt).toLocaleDateString()} •
                    Updated: {new Date(secret.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSecret(secret);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSecret(secret.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedFolder?.name || "Secrets"}
          </h1>
          <div className="flex gap-x-2">
            <ToggleDialogButton
              dialogid="import-modal"
              variant="ghost"
              className="border-2 border-gray-900 cursor-pointer"
            >
              <Import className="h-4 w-4 mr-2" />
              Import Secrets
            </ToggleDialogButton>
            <Button onClick={() => setIsModalOpen(true)}>
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

        {allTags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Filter by tags:</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {isSyncing ? (
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
        <List />
      )}

      <dialog
        id="import-modal"
        className="px-4 py-12 rounded-lg border-2 border-gray-300 bg-white relative space-y-2"
      >
        <HideDialogButton
          dialogid="import-modal"
          className="absolute top-1 right-1 cursor-pointer"
          variant="ghost"
        >
          <LucideXCircle color="red" className="w-8 h-8" />
        </HideDialogButton>
        <p className="text-sm text-muted-foreground">
          You can override all current secrets, folders, and tags by importing a
          JSON file (one that's exported from this website)
        </p>
        <p className="text-red-400 text-sm mb-4">
          Caution: this will override all current data, which is irrecoverable.
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
                "are you sure you want to import your data? This will overwrite all data."
              );
              if (!shouldContinue) return;
              const target = e.target as HTMLInputElement;
              if (target.files && target.files.length > 0) {
                const file = target.files[0]!;
                const content = await file.text();
                const parsedData = parseToAppJSON(content);
                if (!parsedData) {
                  // toast({})
                  toast({
                    title: "Import failed",
                    description:
                      "Failed to import JSON data. Structure is malformed.",
                    variant: "destructive",
                  });
                } else {
                  startSyncLoading();
                  setLocalStorage(parsedData);
                  loadData();
                  stopSyncLoading();
                }
                target.value = ""; // Clear the input value
              }
            }}
          />
        </div>

        {/* <div className="flex gap-2 justify-end">
            <Button variant="default">
              Import
            </Button>
          </div> */}
      </dialog>
    </div>
  );
};

export default SecretsList;
