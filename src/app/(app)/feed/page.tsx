type FeedPageProps = {
  searchParams?: { prompt?: string };
};

const demoItems = [
  {
    id: "clip-1",
    title: "Generated: Intro to calisthenics",
    source: "Veo 3",
    description: "AI generated in the background for your prompt.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "clip-2",
    title: "External: YouTube Short",
    source: "YouTube",
    description: "Indexed from external shorts while AI renders.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    id: "clip-3",
    title: "Library: Saved tutorial",
    source: "Internal DB",
    description: "Matched from your existing library and embeddings.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
];

export default function FeedPage({ searchParams }: FeedPageProps) {
  const prompt = searchParams?.prompt ?? "Your prompt";

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            Channel
          </p>
          <h1 className="text-lg font-semibold">{prompt}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span className="rounded-full border border-white/20 px-3 py-1">
            Auto-play on
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1">
            Scroll snap
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory">
        {demoItems.map((item) => (
          <section
            key={item.id}
            className="flex h-screen snap-start flex-col items-center justify-center gap-6 px-6 py-10"
          >
            <div className="flex w-full max-w-sm flex-col gap-3 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                {item.source}
              </p>
              <h2 className="text-2xl font-semibold">{item.title}</h2>
              <p className="text-sm text-white/70">{item.description}</p>
            </div>
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
              <video
                className="h-[60vh] w-full object-cover"
                src={item.videoUrl}
                playsInline
                muted
                loop
                controls
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/70">
                <span>Tap to like</span>
                <span>Swipe up for next</span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
