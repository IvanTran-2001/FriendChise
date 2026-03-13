import { redirect } from "next/navigation"
import { auth, signIn } from "@/auth"

export default async function SignInPage() {
  const session = await auth()
  if (session?.user) redirect("/")

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sign in to access your organizations.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  )
}