import type { InstagramListingPayload } from "./poster";

const PROMPT_TEMPLATE_FIELDS = [
  ["{make}", "make"],
  ["{model}", "model"],
  ["{description}", "description"],
  ["{color}", "color"],
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolvePromptTemplate(template: string, listing: InstagramListingPayload) {
  return PROMPT_TEMPLATE_FIELDS.reduce((current, [token, key]) => {
    const value = listing[key] || "";
    return current.replaceAll(token, String(value));
  }, template);
}

export function buildPromptTemplateFromListing(prompt: string, listing: InstagramListingPayload) {
  return PROMPT_TEMPLATE_FIELDS.reduce((current, [token, key]) => {
    const value = String(listing[key] || "").trim();
    if (!value) return current;
    return current.replace(new RegExp(escapeRegExp(value), "g"), token);
  }, prompt);
}
