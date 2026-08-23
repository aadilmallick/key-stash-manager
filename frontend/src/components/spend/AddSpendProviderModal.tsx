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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSpendProviderActions } from "@/hooks/useSpendProviders";
import { listProviderAdapters, getProviderAdapter } from "@/lib/spend/registry";
import { ProviderId } from "@/lib/spend/types";

interface AddSpendProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddSpendProviderModal = ({
  isOpen,
  onClose,
}: AddSpendProviderModalProps) => {
  const adapters = listProviderAdapters();
  const { addProvider } = useSpendProviderActions();
  const { toast } = useToast();

  const [providerId, setProviderId] = useState<ProviderId>(adapters[0].id);
  const [apiKey, setApiKey] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const adapter = getProviderAdapter(providerId);

  const resetAndClose = () => {
    setApiKey("");
    setBudgetUsd("");
    setProviderId(adapters[0].id);
    onClose();
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      await addProvider({
        provider: providerId,
        apiKey: apiKey.trim(),
        budgetUsd: budgetUsd.trim() ? Number(budgetUsd) : undefined,
      });
      toast({
        title: "Provider added",
        description: `${adapter.label} was saved. Checking current spend...`,
      });
      resetAndClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not save the provider. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Spend Provider</DialogTitle>
          <DialogDescription>
            Connect a billing/admin API key to monitor spend. The key is
            encrypted at rest, same as your other secrets, and is only ever
            sent to the proxy to fetch usage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={providerId}
              onValueChange={(value) => setProviderId(value as ProviderId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adapters.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1.5">
            {adapter.setupSteps.map((step, i) => (
              <p key={i} className="text-sm text-blue-900 flex items-start gap-1">
                <span>{step.text}</span>
                {step.href && (
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-blue-700 underline whitespace-nowrap"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="spend-provider-key">{adapter.keyLabel}</Label>
            <Input
              id="spend-provider-key"
              type="password"
              placeholder={adapter.keyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spend-provider-budget">
              Monthly budget (USD, optional)
            </Label>
            <Input
              id="spend-provider-budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 50"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Purely local - used to render a progress bar, never sent
              anywhere.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!apiKey.trim() || isSaving}>
              <Plus className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save & Test"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSpendProviderModal;
