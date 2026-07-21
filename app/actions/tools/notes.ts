"use server";

import { revalidatePath } from "next/cache";
import { requireOrgMemberAction } from "@/lib/authz";
import {
  getNotePages,
  getNotePage,
  createNotePage,
  updateNotePage,
  deleteNotePage,
  reorderNotePages,
} from "@/lib/services/tools/notes";

export async function getNotePagesAction(orgId: string) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  try {
    const pages = await getNotePages(orgId);
    return { ok: true as const, pages };
  } catch (err) {
    return { ok: false as const, error: "Failed to fetch pages." };
  }
}

export async function getNotePageAction(orgId: string, pageId: string) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  try {
    const page = await getNotePage(orgId, pageId);
    if (!page) return { ok: false as const, error: "Page not found." };
    return { ok: true as const, page };
  } catch (err) {
    return { ok: false as const, error: "Failed to fetch page." };
  }
}

export async function createNotePageAction(orgId: string, title: string) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false as const, error: "Title is required." };

  try {
    const page = await createNotePage(orgId, trimmedTitle);
    revalidatePath(`/orgs/${orgId}/tools/notes`);
    return { ok: true as const, page };
  } catch (err) {
    return { ok: false as const, error: "Failed to create page." };
  }
}

export async function updateNotePageAction(
  orgId: string,
  pageId: string,
  data: { title?: string; content?: string }
) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  if (data.title !== undefined) {
    data.title = data.title.trim();
    if (!data.title) return { ok: false as const, error: "Title cannot be empty." };
  }

  try {
    const result = await updateNotePage(orgId, pageId, data);
    if (result.count === 0) return { ok: false as const, error: "Page not found." };
    revalidatePath(`/orgs/${orgId}/tools/notes`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: "Failed to update page." };
  }
}

export async function deleteNotePageAction(orgId: string, pageId: string) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  try {
    const result = await deleteNotePage(orgId, pageId);
    if (result.count === 0) return { ok: false as const, error: "Page not found." };
    revalidatePath(`/orgs/${orgId}/tools/notes`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: "Failed to delete page." };
  }
}

export async function reorderNotePagesAction(orgId: string, pageIds: string[]) {
  const auth = await requireOrgMemberAction(orgId);
  if (!auth.ok) return { ok: false as const, error: "Unauthorized" };

  try {
    await reorderNotePages(orgId, pageIds);
    revalidatePath(`/orgs/${orgId}/tools/notes`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: "Failed to reorder pages." };
  }
}
