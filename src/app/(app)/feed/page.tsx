import FeedClient from "@/components/FeedClient";

type FeedPageProps = {
  searchParams: Promise<{ prompt?: string }>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const prompt = (await searchParams)?.prompt ?? "Your prompt";

  return <FeedClient prompt={prompt} />;
}
