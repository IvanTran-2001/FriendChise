import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { PermissionAction } from "@prisma/client";
import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getMembershipDetail } from "@/lib/services/memberships";
import { Toolbar } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";
import { MemberToolbarActions } from "./_components/member-toolbar-actions";
import { DAYS } from "../_constants";

const MemberDetailPage = async ({
  params,
}: {
  params: Promise<{ orgId: string; memberId: string }>;
}) => {
  const { orgId, memberId } = await params;

  const { userId } = await requireOrgMemberPage(orgId);

  const [membership, callerMembership] = await Promise.all([
    getMembershipDetail(orgId, memberId),
    getOrgMembership(orgId, userId),
  ]);

  if (!membership) notFound();

  const canManage = callerMembership
    ? await memberHasPermission(
        callerMembership.id,
        orgId,
        PermissionAction.MANAGE_MEMBERS,
      )
    : false;

  const { user, botName, memberRoles, workingDays, status, joinedAt } =
    membership;
  const isRestricted = status === "RESTRICTED";
  const displayName = user?.name ?? botName ?? "Bot";
  const isBot = user === null;

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/memberships`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Members
        </Link>
        {canManage && (
          <div className="flex items-center gap-2 ml-auto">
            <Button asChild size="sm" variant="outline">
              <Link href={`/orgs/${orgId}/memberships/${memberId}/edit`}>
                Edit
              </Link>
            </Button>
            <MemberToolbarActions
              orgId={orgId}
              membershipId={memberId}
              memberName={displayName}
              status={status as "ACTIVE" | "RESTRICTED"}
            />
          </div>
        )}
      </Toolbar>

      <div className="w-full max-w-3xl mx-auto">
        <div className="w-full rounded-xl border bg-card p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
          <dl className="flex flex-col gap-5">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Full Name
              </dt>
              <dd className="text-sm font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Email
              </dt>
              <dd className="text-sm">{isBot ? "—" : (user?.email ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Working Days
              </dt>
              <dd className="flex flex-wrap gap-2">
                {DAYS.map(({ key, label }) => (
                  <span
                    key={key}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      workingDays.includes(key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Roles
              </dt>
              <dd className="flex flex-wrap gap-2">
                {memberRoles.length > 0 ? (
                  memberRoles.map(({ role }) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium"
                    >
                      {role.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No roles assigned
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </dt>
              <dd>
                {isRestricted ? (
                  <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/20 ring-inset">
                    Restricted
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Active</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Join Date
              </dt>
              <dd className="text-sm text-muted-foreground">
                {new Date(joinedAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col items-center gap-2 md:pt-1 order-first md:order-last">
            {user?.image ? (
              <Image
                src={user.image}
                alt={displayName}
                width={96}
                height={96}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 text-primary font-semibold text-2xl flex items-center justify-center">
                {initials}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MemberDetailPage;
