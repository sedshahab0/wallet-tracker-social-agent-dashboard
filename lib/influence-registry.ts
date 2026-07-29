export type InfluenceTier = "S" | "A" | "B" | "C";

export type RegistryEntry = {
  handle: string;
  tier: InfluenceTier;
  category: string;
  minFollowers: number;
};

const REGISTRY: RegistryEntry[] = [
  { handle: "VitalikButerin", tier: "S", category: "ethereum", minFollowers: 5_000_000 },
  { handle: "cz_binance", tier: "S", category: "exchange", minFollowers: 8_000_000 },
  { handle: "WhaleAlert", tier: "S", category: "onchain-monitoring", minFollowers: 2_500_000 },
  { handle: "coinbase", tier: "S", category: "exchange", minFollowers: 5_000_000 },
  { handle: "binance", tier: "S", category: "exchange", minFollowers: 10_000_000 },
  { handle: "ethereum", tier: "S", category: "ethereum", minFollowers: 3_000_000 },
  { handle: "solana", tier: "S", category: "solana", minFollowers: 2_000_000 },
  { handle: "arbitrum", tier: "S", category: "layer2", minFollowers: 1_000_000 },
  { handle: "Optimism", tier: "S", category: "layer2", minFollowers: 700_000 },
  { handle: "lookonchain", tier: "S", category: "onchain-analytics", minFollowers: 500_000 },
  { handle: "PeckShieldAlert", tier: "S", category: "wallet-security", minFollowers: 500_000 },
  { handle: "CertiKAlert", tier: "S", category: "wallet-security", minFollowers: 400_000 },
  { handle: "MetaMask", tier: "A", category: "wallet", minFollowers: 1_000_000 },
  { handle: "Ledger", tier: "A", category: "wallet", minFollowers: 500_000 },
  { handle: "Trezor", tier: "A", category: "wallet", minFollowers: 200_000 },
  { handle: "DeBankDeFi", tier: "A", category: "portfolio", minFollowers: 300_000 },
  { handle: "ZapperFi", tier: "A", category: "portfolio", minFollowers: 200_000 },
  { handle: "nansen_ai", tier: "A", category: "onchain-analytics", minFollowers: 300_000 },
  { handle: "glassnode", tier: "A", category: "onchain-analytics", minFollowers: 500_000 },
  { handle: "Etherscan", tier: "A", category: "explorer", minFollowers: 200_000 },
  { handle: "bscscan", tier: "A", category: "explorer", minFollowers: 150_000 },
  { handle: "Chainalysis", tier: "A", category: "compliance", minFollowers: 200_000 },
  { handle: "SlowMist_Team", tier: "A", category: "wallet-security", minFollowers: 150_000 },
  { handle: "zachxbt", tier: "A", category: "wallet-security", minFollowers: 600_000 },
  { handle: "Cointelegraph", tier: "A", category: "news", minFollowers: 2_000_000 },
  { handle: "CoinDesk", tier: "A", category: "news", minFollowers: 1_500_000 },
  { handle: "TheBlock__", tier: "A", category: "news", minFollowers: 400_000 },
  { handle: "DefiIgnas", tier: "B", category: "defi-education", minFollowers: 100_000 },
  { handle: "BanklessHQ", tier: "B", category: "defi-education", minFollowers: 200_000 },
  { handle: "TrustWallet", tier: "B", category: "wallet", minFollowers: 300_000 },
  { handle: "phantom", tier: "B", category: "wallet", minFollowers: 400_000 },
  { handle: "RainbowWallet", tier: "B", category: "wallet", minFollowers: 50_000 },
  { handle: "ArkhamIntel", tier: "B", category: "onchain-analytics", minFollowers: 300_000 },
  { handle: "DuneAnalytics", tier: "B", category: "onchain-analytics", minFollowers: 200_000 },
  { handle: "MessariCrypto", tier: "B", category: "research", minFollowers: 300_000 },
];

const REGISTRY_MAP = new Map(REGISTRY.map((entry) => [entry.handle.toLowerCase(), entry]));

export function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function extractHandleFromPostUrl(postUrl: string) {
  const match = postUrl.match(/x\.com\/([A-Za-z0-9_]{1,15})\/status\//i);
  return match?.[1] || "";
}

export function lookupRegistryEntry(handleOrUrl: string): RegistryEntry | null {
  const handle = handleOrUrl.includes("x.com")
    ? extractHandleFromPostUrl(handleOrUrl)
    : handleOrUrl.replace(/^@/, "");
  if (!handle) return null;
  return REGISTRY_MAP.get(handle.toLowerCase()) || null;
}

export function tierFromFollowerCount(followers: number): InfluenceTier {
  if (followers >= 500_000) return "S";
  if (followers >= 50_000) return "A";
  if (followers >= 10_000) return "B";
  return "C";
}

export function tierBaseScore(tier: InfluenceTier) {
  switch (tier) {
    case "S": return 30;
    case "A": return 22;
    case "B": return 14;
    default: return 6;
  }
}

export function tierLabelFa(tier: InfluenceTier) {
  switch (tier) {
    case "S": return "سطح S · تأثیر بالا";
    case "A": return "سطح A · اکانت بزرگ";
    case "B": return "سطح B · اکانت فعال";
    default: return "سطح C · اکانت کوچک";
  }
}

export function listRegistryByCategory(category: string) {
  return REGISTRY.filter((entry) => entry.category === category);
}

export function registrySize() {
  return REGISTRY.length;
}
