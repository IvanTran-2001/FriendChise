import { requireSuperAdminPage } from "@/lib/authz";
import { getAuditLogs } from "@/lib/services/audit-log";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; date?: string | string[] }>;
}) {
  await requireSuperAdminPage();

  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const date = Array.isArray(params.date) ? params.date[0] : params.date;

  const logs = await getAuditLogs("", { search, date });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
      <div className="border-b border-border/60 bg-muted/30 p-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review recent admin activity with optional search and date filtering.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <form action="/admin/logs" className="mb-6 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search by action, email</span>
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by action, email..."
              className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">Filter by date</span>
            <input
              name="date"
              type="date"
              defaultValue={date}
              className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Filter
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs found.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="font-medium">{log.action}</span>
                      <span className="ml-2 text-muted-foreground">
                        {log.targetType} · {log.targetId}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground sm:ml-4 sm:whitespace-nowrap">
                      {new Date(log.createdAt).toUTCString()}
                    </span>
                  </div>
                  {log.actorEmail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {log.actorEmail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
