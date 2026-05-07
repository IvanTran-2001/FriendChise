/**
 * New Task page — `/orgs/[orgId]/tasks/new`
 *
 * Server component. Guards with `MANAGE_TASKS`. Fetches all org roles so the
 * create form can pre-populate the eligibility selector, then renders the
 * shared `TaskForm` in create mode.
 */
import { requireOrgPermissionPage } from "@/lib/authz";
import { PermissionAction } from "@prisma/client";
import { getRoles } from "@/lib/services/roles";
import { getOrgTags } from "@/lib/services/tags";
import { TaskForm } from "../task-form";
import { Toolbar } from "@/components/layout/toolbar";
import { BackButton } from "@/components/layout/back-button";

const NewTaskPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [allRoles, allTags] = await Promise.all([
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  return (
    <>
      <Toolbar>
        <BackButton
          fallbackHref={`/orgs/${orgId}/tasks`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ← Tasks
        </BackButton>
      </Toolbar>

      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Create Task</h1>
        <div className="w-full rounded-lg border bg-card p-6">
          <TaskForm mode="create" orgId={orgId} allRoles={allRoles} allTags={allTags} />
        </div>
      </div>
    </>
  );
};

export default NewTaskPage;
