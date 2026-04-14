import { Skeleton } from "@/components/ui/skeleton";

export default function FranchiseeLoading() {
  return (
    <div className="space-y-8">
      {/* Franchisee List */}
      <section>
        <Skeleton className="h-6 w-36 rounded mb-3" />
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["w-20", "w-20", "w-16", "w-16", "w-6"].map((w, i) => (
                  <th key={i} className="px-4 py-2 text-left">
                    <Skeleton className={`h-3.5 ${w} rounded`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-24 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-24 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-16 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-6 w-6 rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invite Tokens */}
      <section>
        <Skeleton className="h-6 w-32 rounded mb-3" />
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-9 w-56 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["w-20", "w-32", "w-20", "w-16", "w-16", "w-6"].map((w, i) => (
                  <th key={i} className="px-4 py-2 text-left">
                    <Skeleton className={`h-3.5 ${w} rounded`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-20 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-36 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-20 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-16 rounded" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-6 w-6 rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
