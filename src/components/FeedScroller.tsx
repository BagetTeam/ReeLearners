"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const isTikTokEmbed = (url: string) => url.includes("tiktok.com/embed");

export default function FeedScroller({
  items,
  promptLabel,
  initialIndex = 0,
  currentStreak = 0,
  onIndexChange,
}: FeedScrollerProps) {
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(items.length - 1, 0),
  );
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [offset, setOffset] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
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
      if (!wheelTriggeredRef.current && Math.abs(wheelDeltaRef.current) >= WHEEL_THRESHOLD) {
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

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    onIndexChangeRef.current?.(currentIndex);
  }, [currentIndex]);

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

  const getTikTokEmbedUrl = (videoUrl: string) => {
    try {
      // 1. Extract the Video ID. 
      // This regex looks for a long string of digits at the end of the URL 
      // or after 'video/' or 'v2/'
      const idMatch = videoUrl.match(/(?:\/video\/|\/v2\/|_)(\d+)/);
      const videoId = idMatch ? idMatch[1] : null;

      if (!videoId) return videoUrl;

      // 2. Return the 'player/v1' URL.
      // This endpoint explicitly accepts autoplay parameters.
      return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&play_button=1`;    
    } catch (e) {
      return videoUrl;
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
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 border-(--muted) text-foreground">
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
                <h2 className="text-2xl font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl border-(--muted)">
                {item.isEmbed ? (
                  isTikTokEmbed(item.videoUrl) ? (
                    index === currentIndex ? (
                      <iframe
                        className="h-[60vh] w-full overflow-hidden"
                        src={getTikTokEmbedUrl(item.videoUrl)}
                        title={item.title}
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; "
                        allowFullScreen
                        scrolling="no"
                        frameBorder="0"
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
                    muted
                    loop
                    controls
                    autoPlay={index === currentIndex}
                  />
                )}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Swipe for next</span>
                  <span>Tap to like</span>
                </div>
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
