import { secretsDataSchema } from "@/types";

// /api/sync always exchanges plaintext values in the nested wire format -
// the server never sees ciphertext. Encryption-at-rest applies only to the
// local wa-sqlite persistence layer (see src/lib/db/importExport.ts).
export const isUsingServer = import.meta.env.VITE_USING_SERVER === "true";
console.log("isUsingServer", isUsingServer);

export async function fetchFromServer() {
  if (!isUsingServer) {
    console.log("client side app only. Will not attempt to sync with server");
    return null;
  }
  const response = await fetch("/api/sync", {
    method: "GET",
  });
  if (response.ok) {
    console.log("Pulled changes from server");
    const storage = await response.json();
    const parsed = secretsDataSchema.parse(storage);
    return parsed;
  } else {
    throw new Error("Failed to pull changes from server");
  }
}
