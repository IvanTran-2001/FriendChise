/**
 * GET /api/orgs/[orgId]/tasks/paginated
 *
 * Cursor-based paginated task list for infinite scroll.
 *
 * Query params:
 *   mode    — "list" | "available" | "shared"  (default: "shared")
 *   cursor  — opaque cursor string from the previous page's nextCursor
 *   limit   — number of items per page (default: 30, max: 100)
 *   sort    — SortOption (default: "name-asc")
 *   roleId  — filter by role id (optional)
 *   tagId   — filter by tag id (optional)
 *   search  — filter by name (optional, case-insensitive)
 *
 * Response: { tasks: Task[], nextCursor: string | null }
 */
import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getTasksPaginated } from "@/lib/services/tasks";
import { createSignedReadUrls } from "@/lib/supabase-storage";
import type { TaskSortOption } from "@/lib/services/tasks";

const VALID_MODES = ["list", "available", "shared"] as const;
const VALID_SORTS: TaskSortOption[] = [
  "name-asc", "name-desc",
  "duration-asc", "duration-desc",
  "people-asc", "people-desc",
];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const mode = VALID_MODES.includes(searchParams.get("mode") as typeof VALID_MODES[number])
    ? (searchParams.get("mode") as typeof VALID_MODES[number])
    : "shared";
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 100);
  const sort = VALID_SORTS.includes(searchParams.get("sort") as TaskSortOption)
    ? (searchParams.get("sort") as TaskSortOption)
    : "name-asc";
  const roleId = searchParams.get("roleId") ?? undefined;
  const tagId = searchParams.get("tagId") ?? undefined;
  const search = searchParams.get("search")?.toLowerCase() ?? undefined;

  const page = await getTasksPaginated(orgId, mode, { cursor, limit, sort });

  // Apply search, role and tag filters in-memory (after pagination fetch).
  let tasks = page.tasks;
  if (search) {
    tasks = tasks.filter((t) => t.name.toLowerCase().includes(search));
  }
  if (roleId) {
    tasks = tasks.filter((t) => t.eligibility.some((e) => e.role.id === roleId));
  }
  if (tagId) {
    tasks = tasks.filter((t) => t.tags.some((tt) => tt.tag.id === tagId));
  }

  // Batch-resolve signed image URLs for tasks that have an image.
  const paths = tasks.flatMap((t) => (t.imageUrl ? [t.imageUrl] : []));
  const signedUrls = await createSignedReadUrls(paths);
  const tasksWithImages = tasks.map((t) => ({
    ...t,
    imageSignedUrl: t.imageUrl ? (signedUrls.get(t.imageUrl) ?? null) : null,
  }));

  return NextResponse.json({ tasks: tasksWithImages, nextCursor: page.nextCursor });
}
