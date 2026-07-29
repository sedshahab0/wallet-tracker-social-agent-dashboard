export type ManagerRisk = "green" | "yellow" | "red";

export type LiveSource = {
  title: string;
  url: string;
  description: string;
  channel: "x" | "news" | "product";
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
};

export type DailyManagerPlan = {
  date: string;
  generatedAt: string;
  mode: "live";
  headline: string;
  strategy: string;
  todayGoal: string;
  publishDecision: "publish" | "light" | "pause";
  publishReason: string;
  tasks: DailyManagerTask[];
  posts: DailyManagerPost[];
  interactions: DailyManagerInteraction[];
  signals: Array<{ title: string; insight: string; sourceUrl: string }>;
  sources: LiveSource[];
};
