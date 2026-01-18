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
  const [activeIndex, setActiveIndex] = useState(0);

  const upsertUser = useMutation(api.users.upsert);
  const updateProgress = useMutation(api.feeds.updateProgress);
  const fetchForPrompt = useAction(api.reels.fetchForPrompt);
  const fetchTikTokForPrompt = useAction(api.reels.fetchTikTokForPrompt);
  const recordView = useMutation(api.stats.recordView);
  const feedId = useMemo(
    () => (feedIdParam ? (feedIdParam as Id<"feeds">) : null),
    [feedIdParam],
  );
  const feed = useQuery(api.feeds.getById, feedId ? { feedId } : "skip");
  const reels = useQuery(api.reels.listForFeed, feedId ? { feedId } : "skip");
  const stats = useQuery(api.stats.getByUser, userId ? { userId } : "skip");

  const userInitRef = useRef(false);
  const hydrateRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchMoreRef = useRef(false);
  const lastFetchLengthRef = useRef(0);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiktokFetchRef = useRef(false);

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
          email: user.email ?? `${auth0Id.replace("|", "_")}@reelearners.local`,
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
    if (feed === null) {
      return router.push("/");
    }
    if (!feed || !userId) return;
    if (feed.userId !== userId) {
      setError("This feed does not belong to your account.");
    }
  }, [feed, userId]);

  useEffect(() => {
    if (feed?.lastSeenIndex !== undefined) {
      setActiveIndex(feed.lastSeenIndex);
    } else {
      setActiveIndex(0);
    }
  }, [feed?.lastSeenIndex, feedId]);

  const items = useMemo(() => {
    if (!reels) return [];
    return reels
      .filter((reel) => Boolean(reel.videoUrl))
      .map((reel) => {
        return {
          id: reel._id,
          title: reel.title ?? "Untitled clip",
          source: "",
          description: reel.description ?? feed?.prompt ?? "Prompt feed",
          videoUrl: reel.videoUrl ?? "",
          isEmbed:
            reel.videoUrl?.includes("tiktok.com/embed") ||
            reel.videoUrl?.includes("tiktok.com/player") ||
            false,
        };
      });
  }, [feed, reels]);

  useEffect(() => {
    if (!feedId || !feed || tiktokFetchRef.current) return;
    if (!items.length) return;
    tiktokFetchRef.current = true;
    void fetchTikTokForPrompt({
      feedId,
      prompt: feed.prompt,
      limit: FEED_BATCH_SIZE,
    }).catch((err) => {
      tiktokFetchRef.current = false;
      setError(
        err instanceof Error ? err.message : "Failed to fetch TikTok videos",
      );
    });
  }, [feed, feedId, fetchTikTokForPrompt, items.length]);

  useEffect(() => {
    if (!feedId || reels === undefined || !feed) return;
    const remaining = items.length - (activeIndex + 1);
    if (remaining > 0 || hydrateRef.current || isHydrating) return;
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
        setError(err instanceof Error ? err.message : "Failed to fetch videos");
      } finally {
        setIsHydrating(false);
        hydrateRef.current = false;
      }
    };

    void run();
  }, [
    activeIndex,
    feed,
    feedId,
    fetchForPrompt,
    items.length,
    isHydrating,
    reels,
  ]);

  const handleIndexChange = useCallback(
    (nextIndex: number) => {
      if (!feedId || !reels || !reels[nextIndex]) return;
      setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));
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

      const isLastItem = nextIndex >= items.length - 1;
      if (!feed || !isLastItem) return;
      if (fetchMoreRef.current || lastFetchLengthRef.current === items.length) {
        return;
      }
      const startingLength = items.length;
      fetchMoreRef.current = true;
      lastFetchLengthRef.current = startingLength;
      void (async () => {
        try {
          await fetchForPrompt({
            feedId,
            prompt: feed.prompt,
            limit: FEED_BATCH_SIZE,
          });
        } catch (err) {
          lastFetchLengthRef.current = 0;
          setError(
            err instanceof Error ? err.message : "Failed to fetch videos",
          );
        } finally {
          fetchMoreRef.current = false;
        }
      })();
    },
    [feed, feedId, fetchForPrompt, items.length, reels, updateProgress],
  );

  useEffect(() => {
    if (!userId || !feedId) return;
    const currentItem = items[activeIndex];
    if (!currentItem) return;
    if (streakTimerRef.current) {
      clearTimeout(streakTimerRef.current);
    }
    streakTimerRef.current = setTimeout(() => {
      void recordView({
        userId,
        feedId,
        reelId: currentItem.id as Id<"reels">,
      }).catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to update streak",
        );
      });
    }, 5000);
  }, [activeIndex, feedId, items, recordView, userId]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
      if (streakTimerRef.current) {
        clearTimeout(streakTimerRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Authenticating
          </span>
          <p className="text-sm text-muted-foreground">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  if (feed === undefined || reels === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Loading feed
          </span>
          <p className="text-sm text-muted-foreground">
            Fetching your reels...
          </p>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Building your feed
          </span>
          <p className="text-sm text-muted-foreground">
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
      currentStreak={
        stats?.lastFeedId === feedId ? (stats?.currentStreak ?? 0) : 0
      }
      onIndexChange={handleIndexChange}
    />
  );
}
