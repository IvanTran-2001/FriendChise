import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { parseRequestBody } from "@/lib/http/request-body";
import { log } from "@/lib/platform/observability";
import { MAX_FILES, SCAN_UPLOAD_PREFIX, normalizeInstruction } from "@/lib/services/scan-to-task";
import { runMobileScanToTask } from "@/lib/services/scan-to-task-mobile";
import { scanSourceSchema, type ScanSourceInput } from "@/lib/validators/scan-to-task";

/** Rejects a storage path that was not issued for this org's scan-upload prefix. */
function isOwnedStoragePath(orgId: string, storagePath: string) {
  const expectedPrefix = `orgs/${orgId}/${SCAN_UPLOAD_PREFIX}/`;
  if (!storagePath.startsWith(expectedPrefix)) return false;

  const relativePath = storagePath.slice(expectedPrefix.length);
  return !relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

/**
 * Mobile-facing Scan to Task endpoint.
 *
 * Scans previously uploaded files (see `upload-url/route.ts`) into draft task
 * suggestions. Mirrors `scanToTaskAction` on the web app, minus the AI
 * duplicate-adjudication pass — see `scan-to-task-mobile.ts`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const record = body as Record<string, unknown>;
  const rawSources = Array.isArray(record.sources) ? record.sources : [];
  if (rawSources.length === 0) {
    return NextResponse.json({ error: "Upload at least one file." }, { status: 400 });
  }
  if (rawSources.length > MAX_FILES) {
    return NextResponse.json({ error: `Upload at most ${MAX_FILES} files at a time.` }, { status: 400 });
  }

  const parsedSources = rawSources.map((value) => scanSourceSchema.safeParse(value));
  if (parsedSources.some((source) => !source.success)) {
    return NextResponse.json({ error: "Upload valid files before scanning." }, { status: 400 });
  }

  const sources = parsedSources.map((source) => source.data as ScanSourceInput);
  if (sources.some((source) => !isOwnedStoragePath(orgId, source.storagePath))) {
    return NextResponse.json({ error: "Storage path does not belong to this organization." }, { status: 400 });
  }

  const demoCheck = await checkDemoLimit(authz.userEmail, "scan", orgId, authz.userId);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 403 });
  }

  const instruction = normalizeInstruction(typeof record.instruction === "string" ? record.instruction : null);

  try {
    const results = await runMobileScanToTask(orgId, authz.userId, sources, instruction);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    log.error("Unexpected error scanning files for mobile scan-to-task", { orgId, error });
    return NextResponse.json({ error: "Failed to scan files." }, { status: 500 });
  }
}
