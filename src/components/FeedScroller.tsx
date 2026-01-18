"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import TikTokPlayer from "./TikTokPlayer";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    _ytApiReady?: boolean;
    _ytApiLoading?: boolean;
    _ytApiCallbacks?: Array<() => void>;
  }
}

type FeedItem = {
  id: string;
  title: string;
  source: string;
  description: string;
  videoUrl: string;
  isEmbed?: boolean;
};

type FeedScrollerProps = {
  items: FeedItem[];
  promptLabel: string;
  initialIndex?: number;
  currentStreak?: number;
  userId: Id<"users"> | null;
  onIndexChange?: (nextIndex: number) => void;
};

const TRANSITION_MS = 360;
const WHEEL_THRESHOLD = 100;
const WHEEL_IDLE_MS = 220;

const getYouTubeId = (url: string) => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
  );
  return match?.[1] ?? null;
};

const isTikTokEmbed = (url: string) =>
  url.includes("tiktok.com/embed") || url.includes("tiktok.com/player");
const isTikTokVideoUrl = (url: string) =>
  url.includes("tiktok") && !url.includes("youtube");

const getTikTokEmbedUrl = (videoUrl: string) => {
  try {
    const idMatch = videoUrl.match(/(?:\/video\/|\/v2\/|_)(\d+)/);
    const videoId = idMatch ? idMatch[1] : null;

    if (!videoId) return videoUrl;

    return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&play_button=1`;
  } catch (e) {
    return videoUrl;
  }
};

export default function FeedScroller({
  items,
  promptLabel,
  initialIndex = 0,
  currentStreak = 0,
  userId,
  onIndexChange,
}: FeedScrollerProps) {
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(items.length - 1, 0),
  );
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [offset, setOffset] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [tikTokUnmutedIndices, setTikTokUnmutedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState<number | null>(
    null,
  );
  const [streakAnimating, setStreakAnimating] = useState(false);
  const prevStreakRef = useRef(currentStreak);

  const wheelDeltaRef = useRef(0);
  const wheelActiveRef = useRef(false);
  const wheelTriggeredRef = useRef(false);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());
  const ytContainerRefs = useRef(new Map<number, HTMLDivElement>());
  const ytPlayerRefs = useRef(new Map<number, any>());
  const [ytReady, setYtReady] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const userInteractedRef = useRef(false);
  const onIndexChangeRef = useRef(onIndexChange);

  const currentItem = items[currentIndex];
  const currentReelId = currentItem?.id as Id<"reels"> | undefined;
  const engagement = useQuery(
    api.engagement.getReelEngagement,
    currentReelId
      ? { reelId: currentReelId, userId: userId ?? undefined, limit: 4 }
      : "skip",
  );
  const toggleLike = useMutation(api.engagement.toggleLike);
  const addComment = useMutation(api.engagement.addComment);

  const visibleIndices = useMemo(() => {
    return [currentIndex - 1, currentIndex, currentIndex + 1].filter(
      (index) => index >= 0 && index < items.length,
    );
  }, [currentIndex, items.length]);

  const finishTransition = useCallback((nextIndex: number) => {
    setTimeout(() => {
      setTransitionEnabled(false);
      setCurrentIndex(nextIndex);
      setOffset(0);
      wheelDeltaRef.current = 0;
      wheelTriggeredRef.current = false;
      requestAnimationFrame(() => setTransitionEnabled(true));
      isAnimatingRef.current = false;
    }, TRANSITION_MS);
  }, []);

  const goNext = useCallback(() => {
    if (isAnimatingRef.current || currentIndex >= items.length - 1) return;
    isAnimatingRef.current = true;
    setTransitionEnabled(true);
    setOffset(-1);
    wheelDeltaRef.current = 0;
    finishTransition(currentIndex + 1);
  }, [currentIndex, finishTransition, items.length]);

  const goPrev = useCallback(() => {
    if (isAnimatingRef.current || currentIndex <= 0) return;
    isAnimatingRef.current = true;
    setTransitionEnabled(true);
    setOffset(1);
    wheelDeltaRef.current = 0;
    finishTransition(currentIndex - 1);
  }, [currentIndex, finishTransition]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isAnimatingRef.current) {
        return;
      }
      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true;
      }
      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
      }
      wheelDeltaRef.current += event.deltaY;
      if (
        !wheelTriggeredRef.current &&
        Math.abs(wheelDeltaRef.current) >= WHEEL_THRESHOLD
      ) {
        wheelTriggeredRef.current = true;
        if (wheelDeltaRef.current > 0) {
          goNext();
        } else {
          goPrev();
        }
        wheelDeltaRef.current = 0;
      }
      wheelIdleTimerRef.current = setTimeout(() => {
        wheelActiveRef.current = false;
        wheelTriggeredRef.current = false;
        wheelDeltaRef.current = 0;
      }, WHEEL_IDLE_MS);
    },
    [goNext, goPrev],
  );

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartRef.current === null) return;
    const endY = event.changedTouches[0]?.clientY ?? touchStartRef.current;
    const delta = touchStartRef.current - endY;
    touchStartRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  const enableTikTokSound = useCallback((index: number) => {
    setTikTokUnmutedIndices((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    userInteractedRef.current = true;
  }, []);

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    onIndexChangeRef.current?.(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    setShowComments(false);
    setCommentDraft("");
    setCommentError(null);
    setOptimisticLiked(null);
    setOptimisticLikeCount(null);
  }, [currentItem?.id]);

  useEffect(() => {
    if (optimisticLiked === null) return;
    setOptimisticLiked(null);
    setOptimisticLikeCount(null);
  }, [engagement?.likedByUser, engagement?.likeCount]);

  useEffect(() => {
    if (currentStreak > prevStreakRef.current) {
      setStreakAnimating(true);
      const timer = setTimeout(() => {
        setStreakAnimating(false);
        prevStreakRef.current = currentStreak;
      }, 600);
      return () => clearTimeout(timer);
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setYtReady(true);
      return;
    }
    if (!window._ytApiCallbacks) {
      window._ytApiCallbacks = [];
    }
    window._ytApiCallbacks.push(() => setYtReady(true));
    if (window._ytApiLoading) return;
    window._ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      window._ytApiReady = true;
      window._ytApiLoading = false;
      window._ytApiCallbacks?.forEach((callback) => callback());
      window._ytApiCallbacks = [];
    };
  }, []);

  const playCurrentMedia = useCallback(
    (fromGesture = false) => {
      if (fromGesture) {
        userInteractedRef.current = true;
      }
      setNeedsUserGesture(false);

      videoRefs.current.forEach((video, index) => {
        if (index !== currentIndex) {
          video.pause();
        }
      });

      const currentVideo = videoRefs.current.get(currentIndex);
      if (currentVideo) {
        const playPromise = currentVideo.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {
            if (!userInteractedRef.current) {
              setNeedsUserGesture(true);
            }
          });
        }
        return;
      }

      const ytPlayer = ytPlayerRefs.current.get(currentIndex);
      if (ytPlayer && typeof ytPlayer.playVideo === "function") {
        ytPlayer.playVideo();
        if (typeof ytPlayer.getPlayerState === "function") {
          setTimeout(() => {
            const state = ytPlayer.getPlayerState();
            if (state !== 1 && !userInteractedRef.current) {
              setNeedsUserGesture(true);
            }
          }, 200);
        }
      }
    },
    [currentIndex],
  );

  useEffect(() => {
    playCurrentMedia();
  }, [currentIndex, visibleIndices, playCurrentMedia]);

  useEffect(() => {
    if (!ytReady) return;
    visibleIndices.forEach((index) => {
      const item = items[index];
      if (item?.isEmbed && isTikTokEmbed(item.videoUrl)) {
        return;
      }
      if (!item?.isEmbed) return;
      if (ytPlayerRefs.current.has(index)) return;
      const container = ytContainerRefs.current.get(index);
      if (!container) return;
      const videoId = getYouTubeId(item.videoUrl);
      if (!videoId || !window.YT?.Player) return;
      const player = new window.YT.Player(container, {
        videoId,
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          mute: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            if (index === currentIndex) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
        },
      });
      ytPlayerRefs.current.set(index, player);
    });

    const keep = new Set(visibleIndices);
    ytPlayerRefs.current.forEach((player, index) => {
      if (!keep.has(index)) {
        player.destroy();
        ytPlayerRefs.current.delete(index);
      }
    });
  }, [currentIndex, items, visibleIndices, ytReady]);

  useEffect(() => {
    if (!ytReady) return;
    ytPlayerRefs.current.forEach((player, index) => {
      const canPlay = typeof player?.playVideo === "function";
      const canPause = typeof player?.pauseVideo === "function";
      if (index === currentIndex) {
        if (canPlay) {
          player.playVideo();
        }
      } else if (canPause) {
        player.pauseVideo();
      }
    });
  }, [currentIndex, visibleIndices]);

  const filterOutTitle = (title: string) => {
    // Remove trailing hashtag blocks but keep full title when no hashtags exist.
    const hashIndex = title.indexOf("#");
    const trimmed =
      hashIndex > 0 ? title.slice(0, hashIndex).trim() : title.trim();
    return trimmed || title.trim();
  };

  const likeCount = optimisticLikeCount ?? engagement?.likeCount ?? 0;
  const likedByUser = optimisticLiked ?? engagement?.likedByUser ?? false;
  const commentCount = engagement?.commentCount ?? 0;
  const comments = engagement?.comments ?? [];

  const handleToggleLike = async () => {
    if (!userId || !currentReelId) return;
    const nextLiked = !likedByUser;
    setOptimisticLiked(nextLiked);
    setOptimisticLikeCount((prev) => {
      const base = prev ?? likeCount;
      return Math.max(0, base + (nextLiked ? 1 : -1));
    });
    try {
      await toggleLike({ reelId: currentReelId, userId });
    } catch (err) {
      setOptimisticLiked(null);
      setOptimisticLikeCount(null);
    }
  };

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !currentReelId) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      await addComment({ reelId: currentReelId, userId, body: trimmed });
      setCommentDraft("");
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Failed to add comment",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 border-(--muted)">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Channel
          </p>
          <h1 className="text-lg font-semibold">{promptLabel}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div
            className={`flex items-center gap-2 rounded-full border border-border px-3 py-1 border-(--muted) text-foreground ${
              streakAnimating ? "animate-streak-pop" : ""
            }`}
          >
            <span className="text-base">🔥</span>
            <span className="font-semibold">{currentStreak}</span>
          </div>
          <span className="rounded-full border border-border px-3 py-1 border-(--muted)">
            Auto-play on
          </span>
          <span className="rounded-full border border-border px-3 py-1 border-(--muted)">
            {Math.min(currentIndex + 1, items.length)} of {items.length}
          </span>
        </div>
      </div>

      <div
        className="relative flex-1 overflow-hidden touch-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {visibleIndices.map((index) => {
          const item = items[index];
          const relativeIndex = index - currentIndex;
          const translateY = `${(relativeIndex + offset) * 100}%`;

          return (
            <section
              key={item.id}
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 py-10"
              style={{
                transform: `translateY(${translateY})`,
                transition: transitionEnabled
                  ? `transform ${TRANSITION_MS}ms ease`
                  : "none",
              }}
            >
              <div className="flex w-full max-w-sm flex-col gap-3 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {item.source}
                </p>
                <h2 className="text-base font-semibold">
                  {filterOutTitle(item.title)}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl border-(--muted)">
                  {item.isEmbed ? (
                    isTikTokEmbed(item.videoUrl) ? (
                      index === currentIndex ? (
                        <TikTokPlayer
                          url={item.videoUrl}
                          isActive={index === currentIndex}
                          canPlayWithSound={tikTokUnmutedIndices.has(index)}
                          onEnableSound={() => enableTikTokSound(index)}
                        />
                      ) : (
                        <div className="h-[60vh] w-full bg-black/20" />
                      )
                    ) : (
                      <div
                        ref={(element) => {
                          if (element) {
                            ytContainerRefs.current.set(index, element);
                          } else {
                            ytContainerRefs.current.delete(index);
                          }
                        }}
                        className="h-[60vh] w-full"
                      />
                    )
                  ) : (
                    <video
                      ref={(element) => {
                        if (element) {
                          videoRefs.current.set(index, element);
                        } else {
                          videoRefs.current.delete(index);
                        }
                      }}
                      className="h-[60vh] w-full object-cover"
                      src={item.videoUrl}
                      playsInline
                      muted={!isTikTokVideoUrl(item.videoUrl)}
                      loop
                      controls
                      autoPlay={index === currentIndex}
                    />
                  )}
                  {index === currentIndex && needsUserGesture && (
                    <button
                      type="button"
                      onClick={() => playCurrentMedia(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold"
                    >
                      Tap to play
                    </button>
                  )}
                </div>
                {index === currentIndex && (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={handleToggleLike}
                          disabled={!userId}
                          aria-pressed={likedByUser}
                          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                            likedByUser
                              ? "bg-red-500 text-white"
                              : "bg-card/80 text-foreground hover:bg-card"
                          } ${!userId ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill={likedByUser ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={2}
                            className="h-6 w-6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                            />
                          </svg>
                        </button>
                        <span className="text-xs text-muted-foreground">{likeCount}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowComments((prev) => !prev)}
                          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                            showComments
                              ? "bg-foreground text-background"
                              : "bg-card/80 text-foreground hover:bg-card"
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="h-6 w-6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                            />
                          </svg>
                        </button>
                        <span className="text-xs text-muted-foreground">{commentCount}</span>
                      </div>
                    </div>
                    {showComments && (
                      <div className="w-64 mt-5 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
                        <div className="max-h-48 space-y-2 overflow-y-auto scrollbar-none">
                          {comments.length === 0 ? (
                            <p className="py-4 text-center text-xs text-muted-foreground">
                              No comments yet. Be the first!
                            </p>
                          ) : (
                            comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="space-y-1 border-b border-border/40 pb-2 last:border-b-0 last:pb-0"
                              >
                                <div className="text-xs font-semibold text-foreground">
                                  {comment.userName}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {comment.body}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                        <form
                          onSubmit={handleSubmitComment}
                          className="mt-3 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder={userId ? "Add a comment..." : "Log in to comment"}
                            disabled={!userId || commentSubmitting}
                            maxLength={240}
                            className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <button
                            type="submit"
                            disabled={
                              !userId || commentSubmitting || !commentDraft.trim()
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                          </button>
                        </form>
                        {commentError && (
                          <p className="mt-2 text-xs text-red-500">{commentError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
