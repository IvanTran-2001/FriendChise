import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/platform/prisma";
import {
  moveStorageFile,
  copyStorageFile,
  deleteStorageFile,
} from "@/lib/platform/supabase-storage";
import {
  sanitizeFilename,
  renameTaskImageIfNeeded,
  renameToolItemImageIfNeeded,
} from "@/lib/services/images";

// Mock Supabase storage
vi.mock("@/lib/platform/supabase-storage", () => ({
  moveStorageFile: vi.fn(),
  copyStorageFile: vi.fn(),
  deleteStorageFile: vi.fn(),
}));

// Mock Prisma client
vi.mock("@/lib/platform/prisma", () => ({
  prisma: {
    task: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    toolItem: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    orgImage: {
      updateMany: vi.fn(),
    },
  },
}));

describe("Image Renaming & Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeFilename", () => {
    it("should lowercase and replace spaces/specials with hyphens", () => {
      expect(sanitizeFilename("Clean kitchen room")).toBe("clean-kitchen-room");
      expect(sanitizeFilename("Fryer Checklist v2.0")).toBe("fryer-checklist-v2-0");
    });

    it("should strip accents/diacritics correctly", () => {
      expect(sanitizeFilename("Dónut Café Café")).toBe("donut-cafe-cafe");
      expect(sanitizeFilename("Crême Brûlée")).toBe("creme-brulee");
    });

    it("should strip non-alphanumeric characters, including emojis", () => {
      expect(sanitizeFilename("Clean kitchen 🧹 room! #1")).toBe("clean-kitchen-room-1");
    });

    it("should fallback to 'image' if sanitized result is empty", () => {
      expect(sanitizeFilename("🧹🍕")).toBe("image");
      expect(sanitizeFilename("   ")).toBe("image");
    });
  });

  describe("renameTaskImageIfNeeded", () => {
    it("should return early and do nothing if path already matches expected", async () => {
      const task = {
        id: "task-1",
        orgId: "org-1",
        name: "Deep clean",
        imageUrl: "orgs/org-1/tasks/task-1/deep-clean-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.jpg",
      };
      vi.mocked(prisma.task.findFirst).mockResolvedValue(task as any);

      const res = await renameTaskImageIfNeeded("org-1", "task-1");

      expect(res).toBe(task.imageUrl);
      expect(moveStorageFile).not.toHaveBeenCalled();
      expect(copyStorageFile).not.toHaveBeenCalled();
    });

    it("should MOVE storage file and update task/library paths if the image is UNIQUE (not shared)", async () => {
      const task = {
        id: "task-1",
        orgId: "org-1",
        name: "Deep clean 🧹",
        imageUrl: "orgs/org-1/images/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png",
      };
      vi.mocked(prisma.task.findFirst).mockResolvedValue(task as any);
      vi.mocked(prisma.task.count).mockResolvedValue(0); // 0 other tasks reference this
      vi.mocked(prisma.toolItem.count).mockResolvedValue(0); // 0 tool items reference this
      vi.mocked(moveStorageFile).mockResolvedValue({ ok: true });

      const expectedNewPath = "orgs/org-1/tasks/task-1/deep-clean-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png";

      const res = await renameTaskImageIfNeeded("org-1", "task-1");

      expect(res).toBe(expectedNewPath);
      // Unique file -> should delete dest file, move file, update library path, update task
      expect(deleteStorageFile).toHaveBeenCalledWith(expectedNewPath);
      expect(moveStorageFile).toHaveBeenCalledWith(task.imageUrl, expectedNewPath);
      expect(copyStorageFile).not.toHaveBeenCalled();
      expect(prisma.orgImage.updateMany).toHaveBeenCalledWith({
        where: { orgId: "org-1", storagePath: task.imageUrl },
        data: { storagePath: expectedNewPath, name: task.name },
      });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { imageUrl: expectedNewPath },
      });
    });

    it("should COPY storage file and update task path if the image is SHARED", async () => {
      const task = {
        id: "task-1",
        orgId: "org-1",
        name: "Deep clean",
        imageUrl: "orgs/org-1/images/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.jpg",
      };
      vi.mocked(prisma.task.findFirst).mockResolvedValue(task as any);
      vi.mocked(prisma.task.count).mockResolvedValue(1); // 1 other task references this
      vi.mocked(prisma.toolItem.count).mockResolvedValue(0);
      vi.mocked(copyStorageFile).mockResolvedValue({ ok: true });

      const expectedNewPath = "orgs/org-1/tasks/task-1/deep-clean-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.jpg";

      const res = await renameTaskImageIfNeeded("org-1", "task-1");

      expect(res).toBe(expectedNewPath);
      // Shared file -> should copy file, update task path, but NOT delete/move or update library path
      expect(copyStorageFile).toHaveBeenCalledWith(task.imageUrl, expectedNewPath);
      expect(deleteStorageFile).not.toHaveBeenCalled();
      expect(moveStorageFile).not.toHaveBeenCalled();
      expect(prisma.orgImage.updateMany).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { imageUrl: expectedNewPath },
      });
    });
  });

  describe("renameToolItemImageIfNeeded", () => {
    it("should MOVE storage file and update toolItem/library paths if the image is UNIQUE", async () => {
      const item = {
        id: "item-1",
        orgId: "org-1",
        name: "Sprinkles 🧁",
        imgUrl: "orgs/org-1/images/f3c5f2b8-1a4c-4e8f-9a1b-3c4b5d6e7f8a.jpg",
      };
      vi.mocked(prisma.toolItem.findFirst).mockResolvedValue(item as any);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.toolItem.count).mockResolvedValue(0); // 0 other items reference this
      vi.mocked(moveStorageFile).mockResolvedValue({ ok: true });

      const expectedNewPath = "orgs/org-1/items/item-1/sprinkles-f3c5f2b8-1a4c-4e8f-9a1b-3c4b5d6e7f8a.jpg";

      const res = await renameToolItemImageIfNeeded("org-1", "item-1");

      expect(res).toBe(expectedNewPath);
      expect(deleteStorageFile).toHaveBeenCalledWith(expectedNewPath);
      expect(moveStorageFile).toHaveBeenCalledWith(item.imgUrl, expectedNewPath);
      expect(copyStorageFile).not.toHaveBeenCalled();
      expect(prisma.orgImage.updateMany).toHaveBeenCalledWith({
        where: { orgId: "org-1", storagePath: item.imgUrl },
        data: { storagePath: expectedNewPath, name: item.name },
      });
      expect(prisma.toolItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { imgUrl: expectedNewPath },
      });
    });
  });
});
