import { describe, expect, it } from "vitest";
import { computeReorderedIds } from "./reorder";

describe("computeReorderedIds", () => {
  it("moves an earlier item to after a later target", () => {
    expect(computeReorderedIds(["a", "b", "c", "d"], "a", "c", false)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("moves an earlier item to before a later target", () => {
    expect(computeReorderedIds(["a", "b", "c", "d"], "a", "c", true)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("moves a later item to before an earlier target", () => {
    expect(computeReorderedIds(["a", "b", "c", "d"], "d", "b", true)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("moves a later item to after an earlier target", () => {
    expect(computeReorderedIds(["a", "b", "c", "d"], "d", "b", false)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
  });

  it("is a no-op when dragging an item onto itself", () => {
    expect(computeReorderedIds(["a", "b", "c"], "b", "b", true)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("is a no-op when the target id no longer exists", () => {
    expect(computeReorderedIds(["a", "b", "c"], "a", "missing", true)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("moves the first item to the last position", () => {
    expect(computeReorderedIds(["a", "b", "c"], "a", "c", false)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("moves the last item to the first position", () => {
    expect(computeReorderedIds(["a", "b", "c"], "c", "a", true)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("handles a single-item list", () => {
    expect(computeReorderedIds(["a"], "a", "a", true)).toEqual(["a"]);
  });
});
