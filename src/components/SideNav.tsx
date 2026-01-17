import Link from "next/link";

const mockHistory = [
  { id: "calisthenics", label: "Calisthenics tutorials" },
  { id: "cat-fails", label: "Funny cat fails" },
  { id: "physics", label: "Explained physics concepts" },
  { id: "street-food", label: "Street food tours" },
];

export default function SideNav() {
  return (
    <aside className="flex h-screen w-72 flex-col gap-6 border-r border-zinc-200 bg-white px-5 py-6 dark:border-zinc-800 dark:bg-black">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ReeLearners
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Login
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Query History
        </p>
        <nav className="flex flex-col gap-1">
          {mockHistory.map((item) => (
            <Link
              key={item.id}
              href={`/feed?prompt=${encodeURIComponent(item.label)}`}
              className="rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto rounded-2xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Prompts are saved per user and resume where you left off.
      </div>
    </aside>
  );
}
