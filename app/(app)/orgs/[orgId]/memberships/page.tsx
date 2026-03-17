import { getMemberships } from "@/lib/services/memberships";
import { requireOrgMember } from "@/lib/authz";
import { redirect } from "next/navigation";

const MembersPage = async ({ params }: { params: Promise<{ orgId: string }> }) => {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  const memberships = await getMemberships(orgId);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Members</h1>
      {memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {memberships.map((m) => (
            <li key={m.userId} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{m.user.name ?? "Unnamed user"}</span>
                <span className="text-xs text-muted-foreground">{m.role.title}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MembersPage;