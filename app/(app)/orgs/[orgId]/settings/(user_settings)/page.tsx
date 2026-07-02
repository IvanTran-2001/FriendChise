import { requireOrgMemberPage } from "@/lib/authz";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  await requireOrgMemberPage(orgId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
          Organization settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Empty template for now. This page can later hold the settings home view or
          general organization preferences.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">Org ID: {orgId}</p>
      </section>

      <section className="rounded-3xl border border-dashed border-border bg-background/60 p-5 sm:p-6">
        <p className="text-sm font-medium text-foreground">Placeholder content</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add settings sections here when the page is ready.
        </p>
      </section>
    </div>
  );
}
