export interface MarketplaceListing {
  title: string; // used for display / reference only; FB vehicle form has no title field
  price: number;
  description: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  color?: string;
  bodyType?: string;
  transmission?: string;
  condition?: string;
  noDamage?: boolean;
  vehicleType?: string;
  location?: string;
  photos: string[];
}

export type MarketplacePostResult = {
  status: "ready_to_publish" | "error";
  message: string;
};
