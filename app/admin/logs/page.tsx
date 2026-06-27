import { auth } from "@/auth";
import { getAuditLogs } from "@/lib/services/audit-log";
import { redirect } from "next/navigation";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { search, date } = await searchParams;

  const logs = await getAuditLogs("", { search, date });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>

      <form action="/admin/logs" className="flex gap-2 mb-6">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by action, email..."
          className="border rounded px-3 py-2 text-sm flex-1"
        />
        <input
          name="date"
          type="date"
          defaultValue={date}
          className="border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No logs found.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground ml-2">
                    {log.targetType} · {log.targetId}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.createdAt).toUTCString()}
                </span>
              </div>
              {log.actorEmail && (
                <p className="text-muted-foreground text-xs mt-1">
                  by {log.actorEmail}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
