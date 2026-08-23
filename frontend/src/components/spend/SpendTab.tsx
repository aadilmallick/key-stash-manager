import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Plus } from "lucide-react";
import { useSpendProviders, useSpendProviderActions } from "@/hooks/useSpendProviders";
import SpendProviderCard from "./SpendProviderCard";
import AddSpendProviderModal from "./AddSpendProviderModal";

// Fetch on mount + manual refresh button per card is enough for MVP; this
// interval just keeps numbers roughly fresh while the tab stays mounted.
// No web worker - a couple of small fetches every 25 min doesn't need one,
// and the app's OPFS persistence already has its own dedicated worker.
const REFRESH_INTERVAL_MS = 25 * 60 * 1000;

const SpendTab = () => {
  const providers = useSpendProviders();
  const { refreshProvider } = useSpendProviderActions();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const providerIdsRef = useRef<string[]>([]);
  providerIdsRef.current = providers.map((p) => p.id);

  useEffect(() => {
    providerIdsRef.current.forEach((id) => {
      refreshProvider(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      providerIdsRef.current.forEach((id) => {
        refreshProvider(id);
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">API Spend</h2>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
          <Wallet className="h-8 w-8 mx-auto mb-3 text-gray-400" />
          <p className="font-medium">No providers connected yet</p>
          <p className="text-sm mt-1">
            Add an OpenAI or OpenRouter billing key to monitor spend here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((row) => (
            <SpendProviderCard key={row.id} row={row} />
          ))}
        </div>
      )}

      <AddSpendProviderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

export default SpendTab;
