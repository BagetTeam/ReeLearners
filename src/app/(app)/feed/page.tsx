import FeedClient from "@/components/FeedClient";

type FeedPageProps = {
  searchParams: Promise<{ prompt?: string; feedId?: string }>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const prompt = params?.prompt ?? "Your prompt";
  const feedId = params?.feedId;

  return <FeedClient prompt={prompt} feedIdParam={feedId} />;
}
