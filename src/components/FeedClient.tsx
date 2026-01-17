"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import FeedScroller from "@/components/FeedScroller";

const FEED_BATCH_SIZE = 8;

type FeedClientProps = {
  prompt: string;
};

export default function FeedClient({ prompt }: FeedClientProps) {
  const { user, isLoading } = useUser();
  const router = useRouter();
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
    if (isLoading) return;
    if (!user) {
      const returnTo = `/feed?prompt=${encodeURIComponent(prompt)}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
  }, [isLoading, prompt, router, user]);

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
