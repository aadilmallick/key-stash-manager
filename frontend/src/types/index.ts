import { z } from "zod";

// Nested "wire format" - used for JSON import/export and /api/sync payloads.
// Runtime storage is the flat, relational schema in `src/lib/db/schema.ts`.
export interface Secret {
  id: string;
  name: string;
  value: string;
  description?: string;
  // Optional to match secretZodSchema - imported files may omit timestamps;
  // flattenNestedSecretsData (lib/db/migrations.ts) fills in defaults.
  createdAt?: string;
  updatedAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  secrets: Secret[];
}

export interface Profile {
  id: string;
  name: string;
  folders: Folder[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SecretsData {
  profiles: Profile[];
  currentProfileId: string;
}

export const secretZodSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const folderZodSchema = z.object({
  id: z.string(),
  name: z.string(),
  secrets: z.array(secretZodSchema),
});

export const profileZodSchema = z.object({
  id: z.string(),
  name: z.string(),
  folders: z.array(folderZodSchema),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// the old import schema
export const importSchemaV1 = z.object({
  folders: z.array(folderZodSchema),
});

// the new import schema (export as profile)
export const secretsDataSchema = z.object({
  profiles: z.array(profileZodSchema),
  currentProfileId: z.string(),
});
