// Pure, framework-free filtering logic for the global secret search
// (Cmd/Ctrl+K). Built with the builder pattern per the feature spec: a
// secret is uniquely identified by (name, profileId, folderId), and
// criteria compose with AND semantics.

export interface SecretCandidate {
  name: string;
  profileId: string;
  folderId: string;
}

// Case-insensitive matching that ignores common name delimiters, so
// "OPENAI_API_KEY", "openai-api-key", and "openai api key" all match a
// query of "openaiapikey" or "OPENAI API KEY".
function normalizeName(value: string): string {
  return value.replace(/[-_\s]/g, "").toLowerCase();
}

export class SecretFilter {
  constructor(
    private readonly normalizedQuery: string,
    private readonly profileIds: ReadonlySet<string> | null,
    private readonly folderIds: ReadonlySet<string> | null,
  ) {}

  matches(candidate: SecretCandidate): boolean {
    if (this.profileIds && !this.profileIds.has(candidate.profileId)) {
      return false;
    }
    if (this.folderIds && !this.folderIds.has(candidate.folderId)) {
      return false;
    }
    if (this.normalizedQuery === "") return true;
    return normalizeName(candidate.name).includes(this.normalizedQuery);
  }

  static builder(): SecretFilterBuilder {
    return new SecretFilterBuilder();
  }
}

export class SecretFilterBuilder {
  private query = "";
  private profileIds: string[] | null = null;
  private folderIds: string[] | null = null;

  // Empty/whitespace-only query matches every name.
  withNameQuery(query: string): this {
    this.query = query;
    return this;
  }

  // Empty or omitted = all profiles.
  withProfiles(profileIds: string[]): this {
    this.profileIds = profileIds.length > 0 ? profileIds : null;
    return this;
  }

  // Empty or omitted = all folders.
  withFolders(folderIds: string[]): this {
    this.folderIds = folderIds.length > 0 ? folderIds : null;
    return this;
  }

  build(): SecretFilter {
    return new SecretFilter(
      normalizeName(this.query),
      this.profileIds ? new Set(this.profileIds) : null,
      this.folderIds ? new Set(this.folderIds) : null,
    );
  }
}
