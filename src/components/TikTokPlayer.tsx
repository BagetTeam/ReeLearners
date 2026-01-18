import { useCallback, useEffect, useState } from "react";

type TikTokPlayerProps = {
  url: string;
  isActive: boolean;
};

export default function TikTokPlayer({
  url,
  isActive,
}: TikTokPlayerProps) {
  const getVideoId = (src: string) => {
    try {
      const match = src.match(/(?:\/video\/|\/v2\/|_)(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const videoId = getVideoId(url);

  if (!videoId || !isActive) {
    return <div className="h-[60vh] w-full bg-black/20" />;
  }

    const embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&play_button=1`;

  return (
    <div className="relative h-[60vh] w-full overflow-hidden">
      <iframe
        className="h-full w-full"
        src={embedUrl}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        scrolling="no"
        frameBorder="0"
      />
    </div>
  );
};