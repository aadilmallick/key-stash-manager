import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Static FAQ/troubleshooting content - no live state, so this stays a plain
// component rather than needing its own hook.
const HelpModal = ({ isOpen, onClose }: HelpModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto styled-scrollbar">
        <DialogHeader>
          <DialogTitle>Help & FAQ</DialogTitle>
          <DialogDescription>
            Common questions and how to recover from a stuck vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              Where is my data stored?
            </h3>
            <p className="text-muted-foreground">
              Locally, in your browser (encrypted at rest). Secrets never
              leave your device unless you explicitly export them, share an
              encrypted file, or enable server sync.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              How do I back up my data?
            </h3>
            <p className="text-muted-foreground">
              Use "Export All Profiles" (or "Export Folder"/"Export
              Selected") in the Secrets tab. Keep the exported file
              somewhere safe - anyone with it can read your secrets.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              I'm stuck on "No profile selected" or the app won't load
            </h3>
            <p className="text-muted-foreground mb-2">
              This usually means the browser's local storage for this site
              got into a bad state. Before clearing anything,{" "}
              <strong>export your secrets first if you can still see
              them</strong> - clearing site data is not reversible.
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Export your secrets if the app still lets you.</li>
              <li>
                In Chrome, paste this into the address bar (this won't work
                if typed directly into a webpage's link - copy/paste it
                yourself):
                <code className="block mt-1 p-2 bg-gray-100 rounded text-xs break-all">
                  chrome://settings/content/siteDetails?site=https%3A%2F%2Fvarstash.com
                </code>
                In another browser, look for "Site settings" / "Clear
                cookies and site data" for this site instead.
              </li>
              <li>Clear this site's data.</li>
              <li>Refresh the page to start fresh.</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
