import { z } from "zod";

export interface Secret {
  id: string;
  name: string;
  value: string;
  tags: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface SecretsData {
  profiles: Profile[];
  currentProfileId: string;
}

export const secretZodSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  tags: z.array(z.string()),
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
