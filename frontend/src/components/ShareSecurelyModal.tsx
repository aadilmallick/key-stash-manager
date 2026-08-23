import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useDbCollections } from "@/hooks/useDb";
import { useCurrentProfile, useProfiles } from "@/hooks/useProfiles";
import {
  buildEncryptedShare,
  downloadText,
  ShareScope,
} from "@/lib/db/importExport";

interface ShareSecurelyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Manual E2E sharing (DOCS/feat/04-e2e-encryption.md, "Path A: Manual
// Download" - no server involved). Rendered as a shadcn Dialog (not a
// native <dialog>) since it's opened from inside ProfileSettingsModal,
// itself a Dialog - a native <dialog>'s top-layer stacking would sit above
// this portal-rendered content and block clicks (hit and fixed elsewhere
// in this app for the same reason).
const ShareSecurelyModal = ({ isOpen, onClose }: ShareSecurelyModalProps) => {
  const { collections, vaultKey } = useDbCollections();
  const profiles = useProfiles();
  const currentProfile = useCurrentProfile();
  const { toast } = useToast();

  const [scopeType, setScopeType] = useState<"all" | "profile">("profile");
  const [token, setToken] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);

  const handleClose = () => {
    setToken(null);
    onClose();
  };

  const handleEncryptAndDownload = async () => {
    const scope: ShareScope = scopeType === "all"
      ? { type: "all" }
      : { type: "profile", profileId: currentProfile?.id ?? "" };

    if (scope.type === "profile" && !scope.profileId) {
      toast({
        title: "No profile selected",
        description: "Select a profile before encrypting.",
        variant: "destructive",
      });
      return;
    }

    setIsEncrypting(true);
    try {
      const share = await buildEncryptedShare(collections, vaultKey, scope);
      downloadText(share.filename, share.ciphertext);
      setToken(share.token);
    } catch (error) {
      toast({
        title: "Encryption failed",
        description: "Could not encrypt your data for sharing.",
        variant: "destructive",
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    toast({ title: "Token copied", description: "Paste it somewhere safe." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Share Securely
          </DialogTitle>
          <DialogDescription>
            Encrypts a copy of your data locally, in your browser, with a
            one-time key. Nothing is sent to any server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">What to share</Label>
            <RadioGroup
              value={scopeType}
              onValueChange={(value) => setScopeType(value as "all" | "profile")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="profile" id="scope-profile" />
                <Label htmlFor="scope-profile" className="font-normal">
                  Current profile only
                  {currentProfile ? ` (${currentProfile.name})` : ""}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="font-normal">
                  All profiles ({profiles.length})
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            onClick={handleEncryptAndDownload}
            disabled={isEncrypting}
            className="w-full"
          >
            {isEncrypting ? "Encrypting..." : "Encrypt & Download"}
          </Button>

          {token && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Label htmlFor="share-token" className="text-sm font-semibold">
                Decryption token
              </Label>
              <div className="flex gap-2">
                <Input
                  id="share-token"
                  readOnly
                  value={token}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyToken}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                Send the downloaded file and this token to your recipient
                through <strong>two separate channels</strong> (e.g. email
                the file, text the token). Anyone who has both can decrypt
                your data - anyone who has only one can't.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSecurelyModal;
