import Link from "next/link";
import PromptForm from "@/components/PromptForm";

const suggestedPrompts = [
  "30-second calisthenics tips",
  "Quick physics explanations",
  "Funny cat fails",
  "Minimalist meal prep",
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <PromptForm />

        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Saved prompts
          </h2>
          <div className="flex flex-col gap-3">
            {suggestedPrompts.map((prompt) => (
              <Link
                key={prompt}
                href={`/feed?prompt=${encodeURIComponent(prompt)}`}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700"
              >
                {prompt}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
