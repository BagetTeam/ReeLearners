"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

export default function SideNav() {
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

  return (
    <aside className="flex h-screen w-72 flex-col gap-6 border-r border-zinc-200 bg-white px-5 py-6 dark:border-zinc-800 dark:bg-black">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ReeLearners
        </Link>
        {user ? (
          <a
            href="/auth/logout"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Log out
          </a>
        ) : (
          <a
            href="/auth/login"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Log in
          </a>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Query History
        </p>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {isLoading && (
            <span className="px-3 py-2 text-xs text-zinc-400">
              Loading history...
            </span>
          )}
          {!isLoading && !user && (
            <span className="px-3 py-2 text-xs text-zinc-400">
              Sign in to save prompts.
            </span>
          )}
          {error && (
            <span className="px-3 py-2 text-xs text-red-500">{error}</span>
          )}
          {feeds?.length === 0 && (
            <span className="px-3 py-2 text-xs text-zinc-400">
              No prompts yet.
            </span>
          )}
          {feeds?.map((feed) => (
            <Link
              key={feed._id}
              href={`/feed?feedId=${encodeURIComponent(
                feed._id,
              )}&prompt=${encodeURIComponent(feed.prompt)}`}
              className="rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              {feed.prompt}
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
