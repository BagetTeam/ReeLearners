import FeedScroller from "@/components/FeedScroller";

type FeedPageProps = {
  searchParams?: { prompt?: string };
};

const demoItems = [
  {
    id: "clip-1",
    title: "Generated: Intro to calisthenics",
    source: "Veo 3",
    description: "AI generated in the background for your prompt.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "clip-2",
    title: "External: YouTube Short",
    source: "YouTube",
    description: "Indexed from external shorts while AI renders.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    id: "clip-3",
    title: "Library: Saved tutorial",
    source: "Internal DB",
    description: "Matched from your existing library and embeddings.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  {
    id: "clip-4",
    title: "Generated: Form check",
    source: "Veo 3",
    description: "AI clips preloaded while you watch.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
  {
    id: "clip-5",
    title: "External: Movement breakdown",
    source: "YouTube",
    description: "Short tutorial from external sources.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
  {
    id: "clip-6",
    title: "Library: Quick warmup",
    source: "Internal DB",
    description: "Matched from your saved prompt history.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "clip-7",
    title: "Generated: Momentum tricks",
    source: "Veo 3",
    description: "Rendered in the background for this channel.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

export default function FeedPage({ searchParams }: FeedPageProps) {
  const prompt = searchParams?.prompt ?? "Your prompt";

  return <FeedScroller items={demoItems} promptLabel={prompt} />;
}
