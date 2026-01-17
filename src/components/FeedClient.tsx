"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import FeedScroller from "@/components/FeedScroller";

const FEED_BATCH_SIZE = 8;

type FeedClientProps = {
  feedIdParam: string;
};

export default function FeedClient({ feedIdParam }: FeedClientProps) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  const upsertUser = useMutation(api.users.upsert);
  const updateProgress = useMutation(api.feeds.updateProgress);
  const fetchForPrompt = useAction(api.reels.fetchForPrompt);
  const feedId = useMemo(
    () => (feedIdParam ? (feedIdParam as Id<"feeds">) : null),
    [feedIdParam],
  );
  const feed = useQuery(
    api.feeds.getById,
    feedId ? { feedId } : "skip",
  );
  const reels = useQuery(
    api.reels.listForFeed,
    feedId ? { feedId } : "skip",
  );

  const userInitRef = useRef(false);
  const hydrateRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const returnTo = `/feed/${encodeURIComponent(feedIdParam)}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
  }, [feedIdParam, isLoading, router, user]);

  useEffect(() => {
    if (userInitRef.current || !user) return;
    userInitRef.current = true;

    const run = async () => {
      try {
        const auth0Id = user.sub;
        if (!auth0Id) {
          throw new Error("Missing Auth0 user id");
        }
        const id = await upsertUser({
          auth0Id,
          email:
            user.email ?? `${auth0Id.replace("|", "_")}@reelearners.local`,
          name: user.name ?? user.nickname ?? "ReeLearner",
          avatarUrl: user.picture ?? undefined,
        });
        setUserId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to init user");
      }
    };

    void run();
  }, [upsertUser, user]);

  useEffect(() => {
    if (!feed || !userId) return;
    if (feed.userId !== userId) {
      setError("This feed does not belong to your account.");
    }
  }, [feed, userId]);

  useEffect(() => {
    if (!feedId || reels === undefined || !feed) return;
    if (reels.length > 0 || hydrateRef.current) return;

    hydrateRef.current = true;
    setIsHydrating(true);

    const run = async () => {
      try {
        await fetchForPrompt({
          feedId,
          prompt: feed.prompt,
          limit: FEED_BATCH_SIZE,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch videos",
        );
      } finally {
        setIsHydrating(false);
      }
    };

    void run();
  }, [feed, feedId, fetchForPrompt, reels]);

  const handleIndexChange = useCallback(
    (nextIndex: number) => {
      if (!feedId || !reels || !reels[nextIndex]) return;
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = setTimeout(() => {
        void updateProgress({
          feedId,
          lastSeenIndex: nextIndex,
          lastSeenReelId: reels[nextIndex]._id,
        });
      }, 400);
    },
    [feedId, reels, updateProgress],
  );

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  const items = useMemo(() => {
    if (!reels) return [];
    return reels
      .filter((reel) => Boolean(reel.videoUrl))
      .map((reel) => {
        const source =
          reel.sourceType === "generated"
            ? "Veo 3"
            : reel.sourceType === "external"
              ? "YouTube"
              : "Internal DB";
        return {
          id: reel._id,
          title: reel.title ?? "Untitled clip",
          source,
          description: reel.description ?? feed?.prompt ?? "Prompt feed",
          videoUrl: reel.videoUrl ?? "",
          isEmbed: reel.videoUrl?.includes("youtube.com/embed") ?? false,
        };
      });
  }, [feed, reels]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center text-sm text-white/70">
          {error}
        </div>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Authenticating
          </span>
          <p className="text-sm text-white/70">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (feed === undefined || reels === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Loading feed
          </span>
          <p className="text-sm text-white/70">Fetching your reels...</p>
        </div>
      </div>
    );
  }

  if (feed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center text-sm text-white/70">
          Feed not found.
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Building your feed
          </span>
          <p className="text-sm text-white/70">
            {isHydrating ? "Fetching videos..." : "Warming up the feed..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <FeedScroller
      key={feedId ?? "feed"}
      items={items}
      promptLabel={feed?.prompt ?? "Your prompt"}
      initialIndex={feed?.lastSeenIndex ?? 0}
      onIndexChange={handleIndexChange}
    />
  );
}
