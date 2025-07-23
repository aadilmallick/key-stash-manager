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
