import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Copy, Download, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { downloadText } from "@/lib/db/importExport";
import {
  buildDotenvContent,
  buildExportContent,
  partitionExportable,
} from "@/lib/secretExportFormat";
import { Label } from "@/components/ui/label";

export interface ExportableSecret {
  name: string;
  value: string;
}

interface ExportSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  secrets: ExportableSecret[];
  buildEncryptedShare: () => Promise<
    { ciphertext: string; token: string; filename: string }
  >;
}

function maskContent(content: string): string {
  // Mask only the value half of each `NAME=VALUE`/`export NAME=VALUE` line,
  // keeping key names (and the `export ` keyword) legible.
  return content
    .split("\n")
    .map((line) => line.replace(/=(.*)$/, (_match, value: string) => {
      const masked = "*".repeat(Math.min(value.length, 20));
      return `=${masked}`;
    }))
    .join("\n");
}

const ExportSecretsModal = ({
  isOpen,
  onClose,
  secrets,
  buildEncryptedShare,
}: ExportSecretsModalProps) => {
  const { toast } = useToast();
  const [isUnmasked, setIsUnmasked] = useState(false);
  const [encryptedToken, setEncryptedToken] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Secret names are free-form (no identifier restriction when adding a
  // secret), so a name like "Stripe API Key" can't become a valid env line -
  // skip those rather than letting one bad name crash the whole export.
  const { exportable, skippedNames } = useMemo(
    () => partitionExportable(secrets),
    [secrets],
  );
  const dotenvContent = useMemo(
    () => buildDotenvContent(exportable),
    [exportable],
  );
  const exportContent = useMemo(
    () => buildExportContent(exportable),
    [exportable],
  );

  const displayed = (content: string) =>
    isUnmasked ? content : maskContent(content);

  const copyAll = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: "Copied to clipboard" });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    downloadText(".env", dotenvContent);
    toast({
      title: "Downloaded .env",
      description: "Make sure to keep your secrets safe!",
    });
  };

  const handleClose = () => {
    setEncryptedToken(null);
    onClose();
  };

  const handleEncryptAndDownload = async () => {
    setIsEncrypting(true);
    try {
      const share = await buildEncryptedShare();
      downloadText(share.filename, share.ciphertext);
      setEncryptedToken(share.token);
    } catch (error) {
      toast({
        title: "Encryption failed",
        description: "Could not encrypt your data for export.",
        variant: "destructive",
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!encryptedToken) return;
    await navigator.clipboard.writeText(encryptedToken);
    toast({ title: "Token copied", description: "Paste it somewhere safe." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export {secrets.length} secret(s)</DialogTitle>
          <DialogDescription>
            Choose a format to export the selected secrets.
          </DialogDescription>
        </DialogHeader>

        {skippedNames.length > 0 && (
          <p className="text-sm text-destructive">
            Skipped {skippedNames.length} secret(s) whose name isn't a valid
            environment variable identifier: {skippedNames.join(", ")}
          </p>
        )}

        <Tabs defaultValue="download" className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <TabsList>
              <TabsTrigger value="download">Download .env</TabsTrigger>
              <TabsTrigger value="dotenv">View .env</TabsTrigger>
              <TabsTrigger value="export">Export statements</TabsTrigger>
              <TabsTrigger value="encrypted">Encrypted</TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUnmasked((v) => !v)}
            >
              {isUnmasked ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {isUnmasked ? "Mask" : "Unmask"}
            </Button>
          </div>

          <TabsContent value="download" className="space-y-3">
            <Textarea
              readOnly
              value={displayed(dotenvContent)}
              className="h-56 font-mono text-xs resize-none"
            />
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download .env
            </Button>
          </TabsContent>

          <TabsContent value="dotenv" className="space-y-3">
            <Textarea
              readOnly
              value={displayed(dotenvContent)}
              className="h-56 font-mono text-xs resize-none"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => copyAll(dotenvContent)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy all
            </Button>
          </TabsContent>

          <TabsContent value="export" className="space-y-3">
            <Textarea
              readOnly
              value={displayed(exportContent)}
              className="h-56 font-mono text-xs resize-none"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => copyAll(exportContent)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy all
            </Button>
          </TabsContent>

          <TabsContent value="encrypted" className="space-y-3">
            {!encryptedToken
              ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Encrypts these secrets locally with a one-time key.
                    Nothing is sent to any server.
                  </p>
                  <Button
                    onClick={handleEncryptAndDownload}
                    disabled={isEncrypting}
                    className="w-full"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {isEncrypting ? "Encrypting..." : "Encrypt & Download"}
                  </Button>
                </>
              )
              : (
                <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <Label
                    htmlFor="export-selected-token"
                    className="text-sm font-semibold"
                  >
                    Decryption token
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="export-selected-token"
                      readOnly
                      value={encryptedToken}
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
                    <strong>two separate channels</strong>. Anyone who has
                    both can decrypt your data - anyone who has only one
                    can't.
                  </p>
                </div>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExportSecretsModal;
