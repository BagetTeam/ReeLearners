import FeedClient from "@/components/FeedClient";

type FeedPageProps = {
  params: Promise<{ feedId: string }>;
};

export default async function FeedPage({ params }: FeedPageProps) {
  const { feedId } = await params;

  return <FeedClient feedIdParam={feedId} />;
}
