import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function DealerNotFound() {
  const t = await getTranslations("ui");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 px-6 text-center text-gray-100">
      <h1 className="text-3xl font-semibold">{t("dealer_not_found_title")}</h1>
      <p className="max-w-md text-gray-400">{t("dealer_not_found_message")}</p>
      <Link href="/" className="text-blue-400 underline underline-offset-4 hover:text-blue-300">
        {t("dealer_not_found_back_link")}
      </Link>
    </main>
  );
}
