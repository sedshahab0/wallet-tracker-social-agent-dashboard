import type { LiveSource } from "@/lib/social-manager-types";
import {
  PROJECT_CONTEXT_GENERATED_AT,
  PROJECT_CONTEXT_MARKDOWN,
  PROJECT_CONTEXT_REVISION,
} from "@/lib/generated-project-context";

/**
 * First-party facts verified from the cloned Wallet Tracker backend repository.
 * This lets a brand-new account publish a truthful introduction even before it
 * has public mentions or historical posts.
 */
export const VERIFIED_PROJECT_SOURCE: LiveSource = {
  title: `دانش تأییدشده پنج مخزن Wallet Tracker · ${PROJECT_CONTEXT_REVISION.slice(0, 12)}`,
  url: `urn:wallet-tracker:project-context:${PROJECT_CONTEXT_REVISION}`,
  channel: "project",
  description: PROJECT_CONTEXT_MARKDOWN,
};

export { PROJECT_CONTEXT_GENERATED_AT, PROJECT_CONTEXT_MARKDOWN, PROJECT_CONTEXT_REVISION };

export const PRODUCT_PROFILE_URL = "https://x.com/wallettrackerH";
export const PRODUCT_WEBSITE_URL = "https://wallettracker.app";
