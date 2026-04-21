import { describe, it, expect } from "vitest";
import { CreateAssigneeSchema, DeleteAssigneeSchema } from "@/lib/validators/assignee";

describe("CreateAssigneeSchema", () => {
  it("accepts a valid membershipId string", () => {
    const result = CreateAssigneeSchema.safeParse({ membershipId: "mem-abc" });
    expect(result.success).toBe(true);
  });

  it("rejects missing membershipId", () => {
    const result = CreateAssigneeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null membershipId", () => {
    const result = CreateAssigneeSchema.safeParse({ membershipId: null });
    expect(result.success).toBe(false);
  });

  it("accepts any non-empty string as membershipId (no cuid constraint)", () => {
    const result = CreateAssigneeSchema.safeParse({ membershipId: "any-string-123" });
    expect(result.success).toBe(true);
  });
});

describe("DeleteAssigneeSchema", () => {
  it("accepts a valid membershipId string", () => {
    const result = DeleteAssigneeSchema.safeParse({ membershipId: "mem-abc" });
    expect(result.success).toBe(true);
  });

  it("rejects missing membershipId", () => {
    const result = DeleteAssigneeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null membershipId", () => {
    const result = DeleteAssigneeSchema.safeParse({ membershipId: null });
    expect(result.success).toBe(false);
  });
});
