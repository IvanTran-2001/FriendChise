import { describe, it, expect } from "vitest";
import { PermissionAction } from "@prisma/client";
import { roleFormSchema } from "@/lib/validators/role";

describe("roleFormSchema", () => {
  const validInput = {
    name: "Manager",
    color: "#6366f1",
    permissions: [PermissionAction.MANAGE_TASKS],
    taskIds: ["task-abc"],
  };

  it("accepts a fully valid input", () => {
    const result = roleFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts input without optional color", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: undefined });
    expect(result.success).toBe(true);
  });

  it("accepts empty permissions array", () => {
    const result = roleFormSchema.safeParse({ ...validInput, permissions: [] });
    expect(result.success).toBe(true);
  });

  it("accepts empty taskIds array", () => {
    const result = roleFormSchema.safeParse({ ...validInput, taskIds: [] });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = roleFormSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = roleFormSchema.safeParse({ ...validInput, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 50 characters", () => {
    const result = roleFormSchema.safeParse({ ...validInput, name: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 50 characters", () => {
    const result = roleFormSchema.safeParse({ ...validInput, name: "A".repeat(50) });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = roleFormSchema.safeParse({ ...validInput, name: "  Manager  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Manager");
  });

  it("accepts a valid 6-digit hex color", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: "#a1b2c3" });
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex color", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: "#A1B2C3" });
    expect(result.success).toBe(true);
  });

  it("rejects color missing the # prefix", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: "6366f1" });
    expect(result.success).toBe(false);
  });

  it("rejects color with wrong length", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: "#63f" });
    expect(result.success).toBe(false);
  });

  it("rejects color with invalid characters", () => {
    const result = roleFormSchema.safeParse({ ...validInput, color: "#GGGGGG" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown permission values", () => {
    const result = roleFormSchema.safeParse({
      ...validInput,
      permissions: ["NOT_A_PERMISSION"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid PermissionAction values", () => {
    const result = roleFormSchema.safeParse({
      ...validInput,
      permissions: Object.values(PermissionAction),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = roleFormSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
