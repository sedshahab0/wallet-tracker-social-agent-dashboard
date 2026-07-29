import type { LiveSource } from "@/lib/social-manager-types";

/**
 * First-party facts verified from the cloned Wallet Tracker backend repository.
 * This lets a brand-new account publish a truthful introduction even before it
 * has public mentions or historical posts.
 */
export const VERIFIED_PROJECT_SOURCE: LiveSource = {
  title: "دانش تأییدشده مخزن Wallet Tracker",
  url: "urn:wallet-tracker:verified-repositories",
  channel: "project",
  description: [
    "Wallet Tracker is a NestJS application for tracking cryptocurrency wallets.",
    "Implemented product capabilities documented in the repository include tracking wallets, real-time notifications for new transactions via WebSockets, favorite-wallet management, and wallet search history.",
    "The product uses public blockchain activity for monitoring; never claim investment performance, custody, partnerships, unsupported networks, or unreleased analytics.",
  ].join(" "),
};

export const PRODUCT_PROFILE_URL = "https://x.com/wallettrackerH";
export const PRODUCT_WEBSITE_URL = "https://wallettracker.app";
