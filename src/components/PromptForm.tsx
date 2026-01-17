"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PromptForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/feed?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl flex-col gap-4"
    >
      <label className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Describe what you want to watch
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder='Try "minimalist home workouts" or "street food tours"'
          className="h-12 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-900"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
        >
          Start feed
        </button>
      </div>
    </form>
  );
}
