"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import FeedScroller from "@/components/FeedScroller";

const FEED_BATCH_SIZE = 8;
const DEMO_USER_STORAGE_KEY = "reel_demo_auth0_id";

const getDemoAuth0Id = () => {
  if (typeof window === "undefined") {
    return "demo-user";
  }
  const existing = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const auth0Id = `demo-${generated}`;
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, auth0Id);
  return auth0Id;
};

type FeedClientProps = {
  prompt: string;
};

export default function FeedClient({ prompt }: FeedClientProps) {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [feedId, setFeedId] = useState<Id<"feeds"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  const upsertUser = useMutation(api.users.upsert);
  const createFeed = useMutation(api.feeds.create);
  const fetchForPrompt = useAction(api.reels.fetchForPrompt);
  const reels = useQuery(
    api.reels.listForFeed,
    feedId ? { feedId } : "skip",
  );

  const userInitRef = useRef(false);
  const feedInitRef = useRef(false);
  const hydrateRef = useRef(false);

  useEffect(() => {
    if (userInitRef.current) return;
    userInitRef.current = true;

    const run = async () => {
      try {
        const auth0Id = getDemoAuth0Id();
        const id = await upsertUser({
          auth0Id,
          email: "demo@reelearners.local",
          name: "Demo Viewer",
        });
        setUserId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to init user");
      }
    };

    void run();
  }, [upsertUser]);

  useEffect(() => {
    if (!userId || feedInitRef.current) return;
    feedInitRef.current = true;

    const run = async () => {
      try {
        const id = await createFeed({
          userId,
          prompt,
          topic: prompt,
          description: `Prompted feed for ${prompt}`,
        });
        setFeedId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create feed");
      }
    };

    void run();
  }, [createFeed, prompt, userId]);

  useEffect(() => {
    if (!feedId || reels === undefined) return;
    if (reels.length > 0 || hydrateRef.current) return;

    hydrateRef.current = true;
    setIsHydrating(true);

    const run = async () => {
      try {
        await fetchForPrompt({
          feedId,
          prompt,
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
  }, [feedId, fetchForPrompt, prompt, reels]);

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
          description: reel.description ?? prompt,
          videoUrl: reel.videoUrl ?? "",
          isEmbed: reel.videoUrl?.includes("youtube.com/embed") ?? false,
        };
      });
  }, [prompt, reels]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center text-sm text-white/70">
          {error}
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

  return <FeedScroller items={items} promptLabel={prompt} />;
}
