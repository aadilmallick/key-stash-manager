import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Copy, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { downloadText } from "@/lib/db/importExport";
import { buildDotenvContent, buildExportContent } from "@/lib/secretExportFormat";

export interface ExportableSecret {
  name: string;
  value: string;
}

interface ExportSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  secrets: ExportableSecret[];
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
}: ExportSecretsModalProps) => {
  const { toast } = useToast();
  const [isUnmasked, setIsUnmasked] = useState(false);

  const dotenvContent = useMemo(() => buildDotenvContent(secrets), [secrets]);
  const exportContent = useMemo(() => buildExportContent(secrets), [secrets]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export {secrets.length} secret(s)</DialogTitle>
          <DialogDescription>
            Choose a format to export the selected secrets.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="download" className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <TabsList>
              <TabsTrigger value="download">Download .env</TabsTrigger>
              <TabsTrigger value="dotenv">View .env</TabsTrigger>
              <TabsTrigger value="export">Export statements</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExportSecretsModal;
