import { formatMileage, formatPrice } from "@/lib/utils";

export function formatListingPrice(price?: number) {
  return price == null ? "-" : formatPrice(price);
}

export function formatListingMileage(mileage?: number) {
  return mileage == null ? "-" : formatMileage(mileage);
}
