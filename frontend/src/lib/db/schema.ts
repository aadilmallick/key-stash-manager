import { z } from "zod";

// Flat, relational row schemas for TanStack DB collections. These replace the
// nested Profile -> Folder -> Secret tree in `src/types/index.ts`, which
// remains the "wire format" used for JSON import/export and /api/sync.

export const profileRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const folderRowSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  name: z.string(),
  order: z.number().optional(),
});

// `value` always holds ciphertext (base64(iv || ciphertext) via
// src/lib/crypto.ts), never plaintext. Decrypt on read, encrypt on write.
export const secretRowSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  order: z.number().optional(),
});

export const configRowSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export type ProfileRow = z.infer<typeof profileRowSchema>;
export type FolderRow = z.infer<typeof folderRowSchema>;
export type SecretRow = z.infer<typeof secretRowSchema>;
export type ConfigRow = z.infer<typeof configRowSchema>;

export const CONFIG_KEYS = {
  CURRENT_PROFILE_ID: "currentProfileId",
  SELECTED_FOLDER_ID: "selectedFolderId",
  SEED_COMPLETE: "seedComplete",
} as const;
