import type { ListingGridProps, ListingDetailProps } from "./types";
import type React from "react";

export interface TemplateModule {
  ListingGrid: React.ComponentType<ListingGridProps>;
  ListingDetail: React.ComponentType<ListingDetailProps>;
}

import * as bold from "./bold";
import * as executive from "./executive";
import * as atlas from "./atlas";
import * as night from "./night";
import * as sunset from "./sunset";
import * as pro from "./pro";

export const TEMPLATE_REGISTRY: Record<string, TemplateModule> = {
  bold,
  executive,
  atlas,
  night,
  sunset,
  pro,
};
