import type { ListingGridProps, ListingDetailProps } from "./types";
import type React from "react";

export interface TemplateModule {
  ListingGrid: React.ComponentType<ListingGridProps>;
  ListingDetail: React.ComponentType<ListingDetailProps>;
}

// Stub components — replaced when template folders are created in Tasks 6-11
function StubGrid(_: ListingGridProps) { return null; }
function StubDetail(_: ListingDetailProps) { return null; }

const stub: TemplateModule = { ListingGrid: StubGrid, ListingDetail: StubDetail };

export const TEMPLATE_REGISTRY: Record<string, TemplateModule> = {
  bold: stub,
  executive: stub,
  atlas: stub,
  night: stub,
  sunset: stub,
  pro: stub,
};
