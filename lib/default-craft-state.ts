// Minimal Craft.js serialized state — empty canvas with one Section root.
// Both listingGrid and listingDetail start from this structure.
export const EMPTY_CRAFT_STATE = JSON.stringify({
  ROOT: {
    type: { resolvedName: "Section" },
    isCanvas: true,
    props: { backgroundColor: "#ffffff", padding: 24, maxWidth: 1200 },
    displayName: "Section",
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
});

export const DEFAULT_CONFIG_JSON = JSON.stringify({
  listingGrid: JSON.parse(EMPTY_CRAFT_STATE),
  listingDetail: JSON.parse(EMPTY_CRAFT_STATE),
});
