export type ManagerRisk = "green" | "yellow" | "red";

export type LiveSource = {
  title: string;
  url: string;
  description: string;
  channel: "x" | "news" | "product" | "account" | "project" | "competitor";
};

export type AccountRecentPost = {
  id: string;
  url: string;
  text: string;
  postedAt: string;
};

export type AccountState = {
  handle: string;
  stage: "bootstrap" | "early" | "active";
  profileUrl: string;
  recentPosts: AccountRecentPost[];
  summaryFa: string;
  scrapedAt: string;
  intelligenceSummaryFa?: string;
  engagementTrend?: "up" | "flat" | "down" | "unknown";
};

export type DailyManagerTask = {
  id: string;
  time: string;
  title: string;
  instruction: string;
  kind: "publish" | "reply" | "interact" | "research" | "review" | "pause";
  priority: "now" | "today" | "optional";
  risk: ManagerRisk;
  why: string;
  targetUrl: string;
};

export type DailyManagerPost = {
  id: string;
  time: string;
  title: string;
  summaryFa: string;
  copy: string;
  language: string;
  imagePrompt: string;
  imageUrl?: string;
  risk: ManagerRisk;
  sourceUrls: string[];
};

export type DailyManagerInteraction = {
  id: string;
  time: string;
  account: string;
  postUrl: string;
  reason: string;
  comment: string;
  language: string;
  risk: ManagerRisk;
  reachScore?: number;
  tier?: "S" | "A" | "B" | "C";
  topicRelevance?: number;
  accountTierScore?: number;
  engagementScore?: number;
  freshnessScore?: number;
  engagementLabel?: string;
  followersLabel?: string;
  scoreReasonFa?: string;
  threadScraped?: boolean;
  threadEnriched?: boolean;
  commentRegenerated?: boolean;
  publishVerified?: boolean;
  matchedUrl?: string;
};

export type DailyManagerPlan = {
  date: string;
  generatedAt: string;
  contextRevision: string;
  contextGeneratedAt: string;
  mode: "live";
  headline: string;
  strategy: string;
  todayGoal: string;
  publishDecision: "publish" | "light" | "pause";
  publishReason: string;
  accountState: AccountState;
  tasks: DailyManagerTask[];
  posts: DailyManagerPost[];
  interactions: DailyManagerInteraction[];
  signals: Array<{ title: string; insight: string; sourceUrl: string }>;
  sources: LiveSource[];
};
