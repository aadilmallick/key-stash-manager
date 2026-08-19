import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";
import { useDbCollections } from "./useDb";
import { upsertConfig } from "@/lib/db/collections";

// Reactive get/set over the `config` collection - a single KV row per key.
export function useConfigValue(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q
      .from({ config: collections.config })
      .where(({ config }) => eq(config.key, key))
      .select(({ config }) => ({ value: config.value })),
  );

  const value: string = data?.[0]?.value ?? defaultValue;

  const setValue = (next: string) => {
    upsertConfig(collections, key, next);
  };

  return [value, setValue];
}
