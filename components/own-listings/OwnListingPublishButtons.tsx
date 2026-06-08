"use client";

import { InstagramIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TikTokIcon } from "@/components/tiktok/TikTokIcon";
import type { OwnListingRow } from "@/lib/queries";
import { FbIcon } from "./TableControls";

interface OwnListingPublishButtonsProps {
  publishingToFb: boolean;
  row: OwnListingRow;
  onPublishToFacebook: (row: OwnListingRow) => void;
}

export function OwnListingPublishButtons({
  publishingToFb,
  row,
  onPublishToFacebook,
}: OwnListingPublishButtonsProps) {
  const router = useRouter();
  const t = useTranslations("ui");

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={(event) => {
          event.stopPropagation();
          onPublishToFacebook(row);
        }}
        disabled={publishingToFb}
        title={t("publish_to_facebook_marketplace")}
        aria-label={t("publish_to_facebook_marketplace")}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-600/50 text-[#1877F2] hover:bg-blue-900/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FbIcon className="h-3 w-3" />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          router.push(`/instagram/publish/${row.backup_id}`);
        }}
        title={t("publish_to_instagram")}
        aria-label={t("publish_to_instagram")}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-pink-500/50 text-pink-300 hover:bg-pink-950/40"
      >
        <InstagramIcon className="h-3 w-3" />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          router.push(`/tiktok/publish/${row.backup_id}`);
        }}
        title={t("create_tiktok_video")}
        aria-label={t("create_tiktok_video")}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/50 text-cyan-200 hover:bg-cyan-950/40"
      >
        <TikTokIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
