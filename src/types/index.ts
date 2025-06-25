
export interface Secret {
  id: string;
  name: string;
  value: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  secrets: Secret[];
}

export interface SecretsData {
  folders: Folder[];
}
