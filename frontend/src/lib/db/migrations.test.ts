import { describe, expect, it } from "vitest";
import { flattenNestedSecretsData, migrateLegacyV1 } from "./migrations";
import { SecretsData } from "@/types";

describe("flattenNestedSecretsData", () => {
  it("flattens nested profiles/folders/secrets into flat rows with FK linkage", () => {
    const data: SecretsData = {
      currentProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Personal",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          folders: [
            {
              id: "f1",
              name: "default",
              secrets: [
                {
                  id: "s1",
                  name: "API_KEY",
                  value: "plaintext-value",
                  description: "a key",
                  createdAt: "2024-01-01T00:00:00.000Z",
                  updatedAt: "2024-01-01T00:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
    };

    const { profiles, folders, secrets } = flattenNestedSecretsData(data);

    expect(profiles).toEqual([
      {
        id: "p1",
        name: "Personal",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    expect(folders).toEqual([
      { id: "f1", profileId: "p1", name: "default", order: 0 },
    ]);
    expect(secrets).toEqual([
      {
        id: "s1",
        folderId: "f1",
        name: "API_KEY",
        value: "plaintext-value",
        description: "a key",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        order: 0,
      },
    ]);
  });

  it("assigns order by array index across multiple folders/secrets", () => {
    const data: SecretsData = {
      currentProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Personal",
          folders: [
            {
              id: "f1",
              name: "a",
              secrets: [
                { id: "s1", name: "A", value: "1" },
                { id: "s2", name: "B", value: "2" },
              ],
            },
            { id: "f2", name: "b", secrets: [{ id: "s3", name: "C", value: "3" }] },
          ],
        },
      ],
    };

    const { folders, secrets } = flattenNestedSecretsData(data);
    expect(folders.map((f) => [f.id, f.order])).toEqual([
      ["f1", 0],
      ["f2", 1],
    ]);
    expect(secrets.map((s) => [s.id, s.order])).toEqual([
      ["s1", 0],
      ["s2", 1],
      ["s3", 0],
    ]);
  });

  it("handles empty folders/secrets without throwing", () => {
    const data: SecretsData = {
      currentProfileId: "p1",
      profiles: [{ id: "p1", name: "Empty", folders: [] }],
    };
    const { profiles, folders, secrets } = flattenNestedSecretsData(data);
    expect(profiles).toHaveLength(1);
    expect(folders).toHaveLength(0);
    expect(secrets).toHaveLength(0);
  });

  it("drops tags from the output regardless of what's on the input", () => {
    const data = {
      currentProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Personal",
          folders: [
            {
              id: "f1",
              name: "a",
              secrets: [
                { id: "s1", name: "A", value: "1", tags: ["work", "prod"] },
              ],
            },
          ],
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as SecretsData;

    const { secrets } = flattenNestedSecretsData(data);
    expect(secrets[0]).not.toHaveProperty("tags");
  });

  it("defaults missing timestamps instead of throwing", () => {
    const data: SecretsData = {
      currentProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Personal",
          folders: [
            {
              id: "f1",
              name: "a",
              secrets: [{ id: "s1", name: "A", value: "1" }],
            },
          ],
        },
      ],
    };
    const { profiles, secrets } = flattenNestedSecretsData(data);
    expect(typeof profiles[0].createdAt).toBe("string");
    expect(typeof secrets[0].createdAt).toBe("string");
  });
});

describe("migrateLegacyV1", () => {
  it("wraps a true legacy {folders: [...]} shape into a default profile", () => {
    const legacy = JSON.stringify({
      folders: [{ id: "f1", name: "default", secrets: [] }],
    });
    const result = migrateLegacyV1(legacy);
    expect(result.currentProfileId).toBe("default");
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].id).toBe("default");
    expect(result.profiles[0].folders).toEqual([
      { id: "f1", name: "default", secrets: [] },
    ]);
  });

  it("passes through an already-current {profiles, currentProfileId} shape", () => {
    const current: SecretsData = {
      currentProfileId: "p1",
      profiles: [{ id: "p1", name: "Personal", folders: [] }],
    };
    const result = migrateLegacyV1(JSON.stringify(current));
    expect(result).toEqual(current);
  });

  it("falls back to a default structure on malformed input instead of throwing", () => {
    const result = migrateLegacyV1("not json");
    expect(result.profiles).toHaveLength(1);
    expect(result.currentProfileId).toBe("default");
  });

  it("falls back to a default structure on empty object input", () => {
    const result = migrateLegacyV1("{}");
    expect(result.profiles).toHaveLength(1);
    expect(result.currentProfileId).toBe("default");
  });
});
