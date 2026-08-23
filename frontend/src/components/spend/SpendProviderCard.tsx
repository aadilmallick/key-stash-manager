import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { useSpendProviderActions } from "@/hooks/useSpendProviders";
import { getProviderAdapter } from "@/lib/spend/registry";
import { ProviderId, SpendSnapshot } from "@/lib/spend/types";
import { SpendProviderRow } from "@/lib/db/schema";

function parseSnapshot(row: SpendProviderRow): SpendSnapshot | null {
  if (!row.lastSnapshot) return null;
  try {
    return JSON.parse(row.lastSnapshot) as SpendSnapshot;
  } catch {
    return null;
  }
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

const SpendProviderCard = ({ row }: { row: SpendProviderRow }) => {
  const adapter = getProviderAdapter(row.provider as ProviderId);
  const { refreshProvider, deleteProvider } = useSpendProviderActions();
  const confirm = useConfirm();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const snapshot = parseSnapshot(row);
  const hasError = Boolean(row.lastError);
  const capUsd = snapshot?.limitUsd ?? row.budgetUsd ?? null;
  const percentUsed =
    snapshot && capUsd && capUsd > 0
      ? Math.min(100, (snapshot.spendUsd / capUsd) * 100)
      : null;

  const status = hasError ? "Error" : snapshot ? "Connected" : "Pending";
  const badgeVariant =
    status === "Error"
      ? "destructive"
      : status === "Connected"
      ? "default"
      : "secondary";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProvider(row.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Remove provider",
      description: `Remove ${row.label ?? adapter.label} from API Spend monitoring? Its stored key will be deleted.`,
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (confirmed) deleteProvider(row.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {row.label ?? adapter.label}
          </CardTitle>
          <Badge variant={badgeVariant}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {snapshot ? (
          <>
            <div>
              <p className="text-2xl font-semibold">
                {formatUsd(snapshot.spendUsd)}
              </p>
              <p className="text-xs text-muted-foreground">
                {snapshot.periodLabel}
                {capUsd != null && ` of ${formatUsd(capUsd)}`}
              </p>
            </div>
            {percentUsed != null && (
              <Progress
                value={percentUsed}
                className={
                  percentUsed >= 95
                    ? "[&>div]:bg-red-500"
                    : percentUsed >= 80
                    ? "[&>div]:bg-yellow-500"
                    : undefined
                }
              />
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}
        {hasError && (
          <div className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{row.lastError}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SpendProviderCard;
