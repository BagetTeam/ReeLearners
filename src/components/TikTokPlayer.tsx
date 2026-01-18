type TikTokPlayerProps = {
  url: string;
  isActive: boolean;
  canPlayWithSound: boolean;
  onEnableSound?: () => void;
};

export default function TikTokPlayer({
  url,
  isActive,
  canPlayWithSound,
  onEnableSound,
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

  const baseEmbedUrl = url.includes("tiktok.com/player")
    ? url
    : `https://www.tiktok.com/player/v1/${videoId}`;
  const autoplay = isActive ? "1" : "0";
  // const muted = canPlayWithSound ? "0" : "1";
  const embedUrl = (() => {
    try {
      const embed = new URL(baseEmbedUrl);
      embed.searchParams.set("autoplay", autoplay);
      embed.searchParams.set("loop", "1");
      embed.searchParams.set("play_button", "1");
      // embed.searchParams.set("muted", muted);
      embed.searchParams.set("volume", "1");
      return embed.toString();
    } catch {
      return `${baseEmbedUrl}?autoplay=${autoplay}&loop=1&play_button=1&volume=1`;
    }
  })();

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
      {/* {!canPlayWithSound && (
        <button
          type="button"
          onClick={onEnableSound}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white"
        >
          Tap to play with sound
        </button>
      )} */}
    </div>
  );
};
