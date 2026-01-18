import { useCallback, useEffect, useState } from "react";

type TikTokPlayerProps = {
  url: string;
  isActive: boolean;
};

export default function TikTokPlayer({
  url,
  isActive,
}: TikTokPlayerProps) {
  const [isUnmuted, setIsUnmuted] = useState(false);
  const [iframeUrl, setIframeUrl] = useState("");

  // Helper to construct URL
  const getUrl = useCallback((src: string, unmuted: boolean) => {
    try {
      const idMatch = src.match(/(?:\/video\/|\/v2\/|_)(\d+)/);
      const videoId = idMatch ? idMatch[1] : null;
      if (!videoId) return src;
      
      // params: loop=1 (required for feed feel)
      // play_button=1 (shows UI)
      // muted=1 (starts silent) or muted=0 (if user clicked)
      return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&play_button=1&muted=${unmuted ? "0" : "1"}`;
    } catch {
      return src;
    }
  }, []);

  // Reset mute state when scrolling to a new video
  useEffect(() => {
    if (!isActive) {
      setIsUnmuted(false);
    }
  }, [isActive]);

  // Update URL when active/unmute state changes
  useEffect(() => {
    setIframeUrl(getUrl(url, isUnmuted));
  }, [url, isUnmuted, getUrl]);

  if (!isActive) {
    // Render a placeholder when not active to save memory/performance
    return <div className="h-[60vh] w-full bg-black/20" />;
  }

  return (
    <div className="relative h-[60vh] w-full overflow-hidden">
      <iframe
        className="h-full w-full"
        src={iframeUrl}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        scrolling="no"
        frameBorder="0"
      />

      {/* OVERLAY: Only shows if video is active but still muted */}
      {!isUnmuted && (
        <button
          onClick={() => setIsUnmuted(true)}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/10 text-white hover:bg-black/20"
        >
          <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
            {/* Volume X Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" x2="17" y1="9" y2="15" />
              <line x1="17" x2="23" y1="9" y2="15" />
            </svg>
          </div>
          <span className="mt-2 text-sm font-semibold shadow-black drop-shadow-md">
            Tap to unmute
          </span>
        </button>
      )}
    </div>
  );
};