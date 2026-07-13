import { describe, it, expect } from "vitest";
import { parseMultipleIds } from "@/lib/utils";

describe("parseMultipleIds", () => {
  it("handles undefined, null, or empty string", () => {
    expect(parseMultipleIds(undefined)).toEqual([]);
    expect(parseMultipleIds("")).toEqual([]);
  });

  it("handles a single clean ID string", () => {
    expect(parseMultipleIds("role-1")).toEqual(["role-1"]);
  });

  it("handles a comma-separated ID string", () => {
    expect(parseMultipleIds("role-1,role-2")).toEqual(["role-1", "role-2"]);
  });

  it("handles an array of clean IDs", () => {
    expect(parseMultipleIds(["role-1", "role-2"])).toEqual(["role-1", "role-2"]);
  });

  it("handles an array of comma-separated IDs", () => {
    expect(parseMultipleIds(["role-1,role-2", "role-3"])).toEqual([
      "role-1",
      "role-2",
      "role-3",
    ]);
  });

  it("trims whitespace from IDs", () => {
    expect(parseMultipleIds("  role-1  ,  role-2  ")).toEqual(["role-1", "role-2"]);
    expect(parseMultipleIds([" role-1 ", "  role-2  "])).toEqual(["role-1", "role-2"]);
  });

  it("filters out empty IDs", () => {
    expect(parseMultipleIds("role-1,,role-2")).toEqual(["role-1", "role-2"]);
    expect(parseMultipleIds(["role-1", "", "role-2"])).toEqual(["role-1", "role-2"]);
  });

  it("deduplicates IDs", () => {
    expect(parseMultipleIds("role-1,role-1,role-2")).toEqual(["role-1", "role-2"]);
    expect(parseMultipleIds(["role-1", "role-1", "role-2"])).toEqual(["role-1", "role-2"]);
    expect(parseMultipleIds(["role-1,role-2", "role-2"])).toEqual(["role-1", "role-2"]);
  });
});
