import { notFound } from "next/navigation";
import { InstagramPublisherClient } from "@/components/instagram/InstagramPublisherClient";

interface Props {
  params: Promise<{ backupId: string }>;
}

export default async function InstagramPublishPage({ params }: Props) {
  const { backupId } = await params;
  const id = Number(backupId);
  if (!Number.isFinite(id)) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <InstagramPublisherClient backupId={id} />
    </main>
  );
}
