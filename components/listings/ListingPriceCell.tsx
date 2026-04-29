import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { getPriceWithVat } from "@/lib/vat";

export function ListingPriceCell({
  price,
  vat,
  priceChange,
  carsPrice,
  historyHref,
}: {
  price: number | null | undefined;
  vat?: string | null;
  priceChange?: number | null;
  carsPrice?: number | null;
  historyHref?: string | null;
}) {
  const priceWithVat = getPriceWithVat(price ?? null, vat ?? null);

  return (
    <>
      <span className="flex items-center justify-end gap-1 font-semibold text-green-400">
        {priceChange != null && historyHref ? (
          <Link
            href={historyHref}
            title={`${priceChange > 0 ? "+" : ""}${priceChange}`}
            className="text-sm"
          >
            <span className={priceChange < 0 ? "text-green-400" : "text-red-400"}>
              {priceChange < 0 ? "↘" : "↗"}
            </span>
          </Link>
        ) : null}
        {formatPrice(price)}
      </span>
      {priceWithVat != null ? (
        <div className="text-xs text-emerald-200/85">
          {formatPrice(priceWithVat)}
        </div>
      ) : null}
      {carsPrice != null && carsPrice !== price ? (
        <div className="text-xs text-orange-200/85">
          cars {formatPrice(carsPrice)}
        </div>
      ) : null}
    </>
  );
}
