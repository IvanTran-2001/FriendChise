import { getMemberships } from "@/lib/services/memberships";
import { requireOrgMemberPage } from "@/lib/authz";
import { Toolbar } from "@/components/layout/toolbar";

/**
 * Members list page — server component.
 *
 * Guards access with `requireOrgMemberPage`; redirects to `/` if the caller is not
 * a member. Fetches and renders all memberships for the org with a toolbar
 * action to add a new member.
 */
const MembersPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  await requireOrgMemberPage(orgId);

  const memberships = await getMemberships(orgId);

  return (
    <>
      <Toolbar
        actions={[
          { label: "+ Add Member", href: `/orgs/${orgId}/memberships/new` },
        ]}
      />
      <div className="max-w-3xl mx-auto">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {memberships.map((m) => (
              <li
                key={m.userId}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {m.user.name ?? "Unnamed user"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.memberRoles.map(({ role }) => role.name).join(", ") ||
                      "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default MembersPage;
