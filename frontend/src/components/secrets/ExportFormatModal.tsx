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
import { Copy, Lock, LucideDownload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { downloadText } from "@/lib/db/importExport";

interface ExportFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onExportPlaintext: () => Promise<void> | void;
  onExportEncrypted: () => Promise<
    { ciphertext: string; token: string; filename: string }
  >;
}

// Lets any export button offer a plaintext-vs-encrypted choice before
// downloading. Encrypted downloads reuse the same one-time-key scheme as
// ShareSecurelyModal.tsx (lib/e2eShare.ts via buildEncryptedShare) - the
// token-reveal panel below intentionally duplicates that modal's JSX
// rather than sharing a component, so ShareSecurelyModal stays untouched.
const ExportFormatModal = ({
  isOpen,
  onClose,
  title,
  description,
  onExportPlaintext,
  onExportEncrypted,
}: ExportFormatModalProps) => {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const handleClose = () => {
    setToken(null);
    onClose();
  };

  const handlePlaintext = async () => {
    setIsWorking(true);
    try {
      await onExportPlaintext();
      handleClose();
    } finally {
      setIsWorking(false);
    }
  };

  const handleEncrypted = async () => {
    setIsWorking(true);
    try {
      const share = await onExportEncrypted();
      downloadText(share.filename, share.ciphertext);
      setToken(share.token);
    } catch (error) {
      toast({
        title: "Encryption failed",
        description: "Could not encrypt your data for export.",
        variant: "destructive",
      });
    } finally {
      setIsWorking(false);
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!token
          ? (
            <div className="space-y-3">
              <Button
                className="w-full"
                disabled={isWorking}
                onClick={handlePlaintext}
              >
                <LucideDownload className="h-4 w-4 mr-2" />
                Download Plaintext
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={isWorking}
                onClick={handleEncrypted}
              >
                <Lock className="h-4 w-4 mr-2" />
                Download Encrypted
              </Button>
              <p className="text-xs text-muted-foreground">
                Encrypted downloads are protected by a one-time key shown
                after encrypting - keep the downloaded file and that key in
                two separate places.
              </p>
            </div>
          )
          : (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Label
                htmlFor="export-format-token"
                className="text-sm font-semibold"
              >
                Decryption token
              </Label>
              <div className="flex gap-2">
                <Input
                  id="export-format-token"
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
                Send the downloaded file and this token through{" "}
                <strong>two separate channels</strong>{" "}
                (e.g. email the file, text the token). Anyone who has both
                can decrypt your data - anyone who has only one can't.
              </p>
              <Button className="w-full" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportFormatModal;
