import { describe, expect, it } from "vitest";
import { SecretFilter } from "./secretFilter";

const openaiKey = { name: "OPENAI_API_KEY", profileId: "p1", folderId: "f1" };
const openaiFree = {
  name: "openai-api-key-free",
  profileId: "p1",
  folderId: "f2",
};
const githubToken = { name: "GITHUB TOKEN", profileId: "p2", folderId: "f3" };

describe("SecretFilter", () => {
  it("an empty filter matches everything", () => {
    const filter = SecretFilter.builder().build();
    expect(filter.matches(openaiKey)).toBe(true);
    expect(filter.matches(openaiFree)).toBe(true);
    expect(filter.matches(githubToken)).toBe(true);
  });

  it("name query ignores delimiters and case", () => {
    const filter = SecretFilter.builder().withNameQuery("openai api key").build();
    expect(filter.matches(openaiKey)).toBe(true);
    expect(filter.matches(openaiFree)).toBe(true);
    expect(filter.matches(githubToken)).toBe(false);
  });

  it("name query is a substring match, not exact", () => {
    const filter = SecretFilter.builder().withNameQuery("KEY").build();
    expect(filter.matches(openaiKey)).toBe(true);
    expect(filter.matches(openaiFree)).toBe(true);
    expect(filter.matches(githubToken)).toBe(false);
  });

  it("scopes by profile", () => {
    const filter = SecretFilter.builder().withProfiles(["p2"]).build();
    expect(filter.matches(openaiKey)).toBe(false);
    expect(filter.matches(githubToken)).toBe(true);
  });

  it("scopes by folder", () => {
    const filter = SecretFilter.builder().withFolders(["f2"]).build();
    expect(filter.matches(openaiKey)).toBe(false);
    expect(filter.matches(openaiFree)).toBe(true);
  });

  it("combines name + profile + folder with AND semantics", () => {
    const filter = SecretFilter.builder()
      .withNameQuery("openai")
      .withProfiles(["p1"])
      .withFolders(["f1"])
      .build();
    expect(filter.matches(openaiKey)).toBe(true);
    // Right name/profile, wrong folder.
    expect(filter.matches(openaiFree)).toBe(false);
  });

  it("an empty profile/folder list is treated as 'all', not 'none'", () => {
    const filter = SecretFilter.builder().withProfiles([]).withFolders([]).build();
    expect(filter.matches(openaiKey)).toBe(true);
  });

  it("matches nothing when no candidate satisfies the criteria", () => {
    const filter = SecretFilter.builder().withNameQuery("nonexistent").build();
    expect(filter.matches(openaiKey)).toBe(false);
    expect(filter.matches(openaiFree)).toBe(false);
    expect(filter.matches(githubToken)).toBe(false);
  });
});
