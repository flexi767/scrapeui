export function formatListingPrice(price?: number) {
  return price == null ? "-" : `€${price.toLocaleString("en-US")}`;
}

export function formatListingMileage(mileage?: number) {
  return mileage == null ? "-" : `${mileage.toLocaleString("en-US")} km`;
}
