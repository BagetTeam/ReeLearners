import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Auth0
          </p>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-zinc-500">
            Log in to continue your prompt-driven feed sessions.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <button className="h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white">
            Continue with Auth0
          </button>
          <button className="h-12 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
            Use demo account
          </button>
        </div>
        <div className="mt-8 text-xs text-zinc-500">
          <span>New here?</span>{" "}
          <Link className="font-semibold text-zinc-900 dark:text-zinc-100" href="/">
            Create a prompt feed
          </Link>
        </div>
      </div>
    </div>
  );
}
