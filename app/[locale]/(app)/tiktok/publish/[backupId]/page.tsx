
import { notFound } from "next/navigation";
import { TikTokPublisherClient } from "@/components/tiktok/TikTokPublisherClient";

interface Props {
  params: Promise<{ backupId: string }>;
}

export default async function TikTokPublishPage({ params }: Props) {
  const { backupId } = await params;
  const id = Number(backupId);
  if (!Number.isFinite(id)) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <TikTokPublisherClient backupId={id} />
    </main>
  );
}
