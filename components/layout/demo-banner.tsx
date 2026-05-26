import { signOut, auth } from "@/auth";
import { isDemoEmail } from "@/lib/demo";

export async function DemoBanner() {
  const session = await auth();
  if (!isDemoEmail(session?.user?.email ?? "")) return null;

  return (
    <div className="shrink-0 flex items-center justify-between gap-4 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm">
      <p className="text-amber-800 dark:text-amber-300">
        <span className="font-medium">Demo mode</span>
        {" — "}
        Your session is isolated and will be deleted automatically.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="shrink-0 cursor-pointer text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
        >
          End session
        </button>
      </form>
    </div>
  );
}
