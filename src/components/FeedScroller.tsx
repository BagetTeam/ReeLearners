"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onIndexChange?: (nextIndex: number) => void;
};

const TRANSITION_MS = 360;
const WHEEL_THRESHOLD = 24;
const WHEEL_IDLE_MS = 220;

export default function FeedScroller({
  items,
  promptLabel,
  initialIndex = 0,
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
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Channel
          </p>
          <h1 className="text-lg font-semibold">{promptLabel}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-3 py-1">
            Auto-play on
          </span>
          <span className="rounded-full border border-border px-3 py-1">
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
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                {item.isEmbed ? (
                  <iframe
                    className="h-[60vh] w-full"
                    src={item.videoUrl}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    className="h-[60vh] w-full object-cover"
                    src={item.videoUrl}
                    playsInline
                    muted
                    loop
                    controls
                  />
                )}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Swipe for next</span>
                  <span>Tap to like</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
