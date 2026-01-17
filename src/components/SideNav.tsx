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
  const deleteFeed = useMutation(api.feeds.deleteFeed);
  const initRef = useRef(false);
  const [deletingId, setDeletingId] = useState<Id<"feeds"> | null>(null);

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

  const handleDelete = async (
    event: React.MouseEvent<HTMLButtonElement>,
    feedId: Id<"feeds">,
    promptLabel: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const shouldDelete = window.confirm(
      `Delete "${promptLabel}" and all its reels?`,
    );
    if (!shouldDelete) {
      return;
    }
    setDeletingId(feedId);
    try {
      await deleteFeed({ feedId });
    } finally {
      setDeletingId(null);
    }
  };

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
        <Link
          href="/"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          New prompt
        </Link>
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
            <div
              key={feed._id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <Link
                href={`/feed/${encodeURIComponent(feed._id)}`}
                className="flex-1 rounded-lg px-1 py-1 text-sm text-zinc-700 transition group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-50"
              >
                {feed.prompt}
              </Link>
              <button
                type="button"
                aria-label="Delete prompt"
                onClick={(event) => handleDelete(event, feed._id, feed.prompt)}
                disabled={deletingId === feed._id}
                className="opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  className="h-4 w-4 text-zinc-400 hover:text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.5 2.5a1 1 0 0 0-1 1V4H4a.75.75 0 0 0 0 1.5h.5v9A2.5 2.5 0 0 0 7 17h6a2.5 2.5 0 0 0 2.5-2.5v-9H16a.75.75 0 0 0 0-1.5h-2.5v-.5a1 1 0 0 0-1-1h-5ZM8 4h4v-.5H8V4Zm2 4a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 10 8Zm-3 .75a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Zm7 0a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-auto rounded-2xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Prompts are saved per user and resume where you left off.
      </div>
    </aside>
  );
}
