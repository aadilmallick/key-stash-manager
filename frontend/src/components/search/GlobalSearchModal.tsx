import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Eye, EyeOff, FileDown, ChevronDown, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SecretFilter } from "@/lib/secretFilter";
import { useGlobalSecretSearch } from "@/hooks/useGlobalSecretSearch";
import { useSecretSelection } from "@/hooks/useSecretSelection";
import { useSecretValueDecryptor } from "@/hooks/useSecrets";
import { useProfiles } from "@/hooks/useProfiles";
import { useAllFolders } from "@/hooks/useFolders";
import { useDbCollections } from "@/hooks/useDb";
import { buildEncryptedShare } from "@/lib/db/importExport";
import { Secret } from "@/types";
import ExportSecretsModal, {
  ExportableSecret,
} from "@/components/secrets/ExportSecretsModal";

const MASK_PLACEHOLDER = "•".repeat(10);
const DEBOUNCE_MS = 50;

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearchModal = ({ isOpen, onClose }: GlobalSearchModalProps) => {
  const profiles = useProfiles();
  const folders = useAllFolders();
  const selection = useSecretSelection();
  const { decryptSecretValue } = useSecretValueDecryptor();
  const { collections, vaultKey } = useDbCollections();
  const { toast } = useToast();

  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [unmaskedIds, setUnmaskedIds] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Map<string, string>>(
    new Map(),
  );
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportableSecret[]>([]);
  const [exportSecretsForEncryption, setExportSecretsForEncryption] =
    useState<Secret[]>([]);
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const filter = useMemo(
    () =>
      SecretFilter.builder()
        .withNameQuery(debouncedQuery)
        .withProfiles(selectedProfileIds)
        .withFolders(selectedFolderIds)
        .build(),
    [debouncedQuery, selectedProfileIds, selectedFolderIds],
  );

  const { results } = useGlobalSecretSearch(filter);

  const selectAllState = selection.selectAllState(
    results.map((r) => r.secretId),
  );

  const resetAndClose = () => {
    setRawQuery("");
    setDebouncedQuery("");
    setSelectedProfileIds([]);
    setSelectedFolderIds([]);
    setUnmaskedIds(new Set());
    setDecryptedValues(new Map());
    selection.clear();
    onClose();
  };

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleFolder = (id: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleUnmask = async (secretId: string) => {
    if (unmaskedIds.has(secretId)) {
      setUnmaskedIds((prev) => {
        const next = new Set(prev);
        next.delete(secretId);
        return next;
      });
      return;
    }
    if (!decryptedValues.has(secretId)) {
      const value = await decryptSecretValue(secretId);
      if (value !== null) {
        setDecryptedValues((prev) => new Map(prev).set(secretId, value));
      }
    }
    setUnmaskedIds((prev) => new Set(prev).add(secretId));
  };

  const handleExportSelected = async () => {
    setIsPreparingExport(true);
    try {
      const selected = results.filter((r) => selection.isSelected(r.secretId));
      const failedNames: string[] = [];
      const decrypted = await Promise.all(
        selected.map(async (r) => {
          try {
            const cached = decryptedValues.get(r.secretId);
            const value = cached ?? (await decryptSecretValue(r.secretId));
            if (value === null) throw new Error("secret no longer exists");
            return { id: r.secretId, name: r.name, value };
          } catch {
            failedNames.push(r.name);
            return null;
          }
        }),
      );
      const succeeded = decrypted.filter(
        (p): p is { id: string; name: string; value: string } => p !== null,
      );
      if (failedNames.length > 0) {
        toast({
          title: "Some secrets couldn't be exported",
          description:
            `Failed to decrypt: ${failedNames.join(", ")}. They were left out of the export.`,
          variant: "destructive",
        });
      }
      setExportPayload(
        succeeded.map(({ name, value }): ExportableSecret => ({
          name,
          value,
        })),
      );
      setExportSecretsForEncryption(succeeded);
      setIsExportModalOpen(true);
    } finally {
      setIsPreparingExport(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Search secrets</DialogTitle>
            <DialogDescription>
              Search by name across all profiles and folders.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search secrets by name..."
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Profile
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  {profiles.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedProfileIds.includes(p.id)}
                        onCheckedChange={() => toggleProfile(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Folder
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1 max-h-64 overflow-y-auto styled-scrollbar">
                  {folders.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedFolderIds.includes(f.id)}
                        onCheckedChange={() => toggleFolder(f.id)}
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {selectedProfileIds.map((id) => {
              const p = profiles.find((pr) => pr.id === id);
              if (!p) return null;
              return (
                <Badge key={id} variant="secondary" className="gap-1">
                  {p.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => toggleProfile(id)}
                  />
                </Badge>
              );
            })}
            {selectedFolderIds.map((id) => {
              const f = folders.find((fo) => fo.id === id);
              if (!f) return null;
              return (
                <Badge key={id} variant="outline" className="gap-1">
                  {f.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => toggleFolder(id)}
                  />
                </Badge>
              );
            })}
          </div>

          {results.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={selectAllState}
                  onCheckedChange={(checked) =>
                    checked
                      ? selection.selectAll(results.map((r) => r.secretId))
                      : selection.clear()
                  }
                />
                Select all ({results.length})
              </label>
              {selection.selectedIds.size > 0 && (
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isPreparingExport}
                  onClick={handleExportSelected}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {isPreparingExport
                    ? "Preparing..."
                    : `Export Selected (${selection.selectedIds.size})`}
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto styled-scrollbar space-y-2 min-h-[120px]">
            {results.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No secrets match your search.
              </p>
            ) : (
              results.map((result) => {
                const isUnmasked = unmaskedIds.has(result.secretId);
                const displayValue = isUnmasked
                  ? decryptedValues.get(result.secretId) ?? "..."
                  : MASK_PLACEHOLDER;
                return (
                  <div
                    key={result.secretId}
                    className="flex items-center gap-3 border rounded-lg p-3"
                  >
                    <Checkbox
                      id={`select-search-result-${result.secretId}`}
                      checked={selection.isSelected(result.secretId)}
                      onClick={(e) =>
                        selection.handleCheckboxClick(
                          result.secretId,
                          results.map((r) => r.secretId),
                          e.shiftKey,
                        )}
                      aria-label={`Select ${result.name}`}
                    />
                    <label
                      htmlFor={`select-search-result-${result.secretId}`}
                      className="font-medium text-sm flex-1 min-w-0 truncate cursor-pointer"
                    >
                      {result.name}
                    </label>
                    <Input
                      readOnly
                      aria-label={`${result.name} value`}
                      value={displayValue}
                      className="max-w-[10ch] truncate font-mono text-xs h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => handleUnmask(result.secretId)}
                    >
                      {isUnmasked ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Badge variant="outline" className="shrink-0">
                      {result.folderName}
                    </Badge>
                    <Badge variant="secondary" className="shrink-0">
                      {result.profileName}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ExportSecretsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        secrets={exportPayload}
        buildEncryptedShare={() =>
          buildEncryptedShare(collections, vaultKey, {
            type: "custom",
            profileName: `Search export (${exportSecretsForEncryption.length} secrets)`,
            folderName: "Search results",
            secrets: exportSecretsForEncryption,
          })}
      />
    </>
  );
};

export default GlobalSearchModal;
