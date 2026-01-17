"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

const MAX_HISTORY = 6;

export default function PromptHistory() {
  const { user, isLoading } = useUser();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upsertUser = useMutation(api.users.upsert);
  const initRef = useRef(false);

  useEffect(() => {
    if (isLoading || !user || initRef.current) return;
    initRef.current = true;

    const run = async () => {
      try {
        if (!user.sub) {
          throw new Error("Missing Auth0 user id");
        }
        const id = await upsertUser({
          auth0Id: user.sub,
          email: user.email ?? `${user.sub.replace("|", "_")}@reelearners.local`,
          name: user.name ?? user.nickname ?? "ReeLearner",
          avatarUrl: user.picture ?? undefined,
        });
        setUserId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync user");
      }
    };

    void run();
  }, [isLoading, upsertUser, user]);

  const feeds = useQuery(
    api.feeds.listByUser,
    userId ? { userId } : "skip",
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading your history...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        <p className="mb-2 font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Sign in to see your history
        </p>
        <a
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
        >
          Log in
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!feeds) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading prompts...
      </div>
    );
  }

  if (!feeds.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        No saved prompts yet. Start a feed to build your history.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {feeds.slice(0, MAX_HISTORY).map((feed) => (
        <Link
          key={feed._id}
          href={`/feed/${encodeURIComponent(feed._id)}`}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{feed.prompt}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              {feed.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {feed.description ?? "Prompt feed"}
          </div>
        </Link>
      ))}
    </div>
  );
}
