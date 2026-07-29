const STATUS_URL_RE = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/gi;
const HANDLE_RE = /@([A-Za-z0-9_]{1,15})\b/g;
const AUTHOR_LINE_RE = /(?:Author|Post by|by)\s*[:#]?\s*(?:[^@\n]*?)@([A-Za-z0-9_]{1,15})/i;
const PROFILE_TITLE_RE = /^#\s+.+\(@([A-Za-z0-9_]{1,15})\)/m;

function ownUsername() {
  return process.env.X_ACCOUNT_USERNAME?.trim().replace(/^@/, "") || "wallettrackerH";
}

export function normalizeXUrl(value: string) {
  try {
    const url = new URL(value.replace(/\\/g, ""));
    if (!/(?:^|\.)(?:x|twitter)\.com$/i.test(url.hostname)) return "";
    url.hash = "";
    url.search = "";
    url.protocol = "https:";
    url.hostname = "x.com";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function extractStatusUrls(markdownOrLinks: string | string[]) {
  const text = Array.isArray(markdownOrLinks) ? markdownOrLinks.join("\n") : markdownOrLinks;
  const urls = new Set<string>();
  for (const match of text.matchAll(STATUS_URL_RE)) {
    const normalized = normalizeXUrl(`https://x.com/${match[1]}/status/${match[2]}`);
    if (normalized) urls.add(normalized);
  }
  return [...urls];
}

export function extractHandle(markdown: string, preferredStatusId?: string) {
  const cleaned = markdown.replace(/\\/g, "");
  if (preferredStatusId) {
    for (const match of cleaned.matchAll(STATUS_URL_RE)) {
      if (match[2] === preferredStatusId && match[1].toLowerCase() !== "i") {
        return `@${match[1]}`;
      }
    }
  }
  const author = cleaned.match(AUTHOR_LINE_RE)?.[1];
  if (author) return `@${author}`;
  const title = cleaned.match(PROFILE_TITLE_RE)?.[1];
  if (title) return `@${title}`;
  const own = ownUsername().toLowerCase();
  for (const match of cleaned.matchAll(HANDLE_RE)) {
    const handle = match[1];
    if (handle.toLowerCase() === "i" || handle.toLowerCase() === own) continue;
    return `@${handle}`;
  }
  return "";
}

export function statusUrlFor(handleOrFallback: string, statusId: string) {
  const cleaned = handleOrFallback.replace(/^@/, "").trim();
  if (cleaned && cleaned.toLowerCase() !== "i" && /^[A-Za-z0-9_]{1,15}$/.test(cleaned)) {
    return `https://x.com/${cleaned}/status/${statusId}`;
  }
  return `https://x.com/i/web/status/${statusId}`;
}

export function parseOwnRecentPosts(markdown: string, links: string[] = []) {
  const own = ownUsername().toLowerCase();
  const urls = extractStatusUrls([markdown, ...links]).filter((url) => url.toLowerCase().includes(`/${own}/status/`));
  const posts = urls.map((url) => {
    const id = url.match(/status\/(\d+)/)?.[1] || "";
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = markdown.match(new RegExp(`${escaped}[\\s\\S]{0,500}`, "i"))?.[0] || "";
    const quoted = block.match(/>\s*([^\n]+)/)?.[1]?.trim() || "";
    const posted = block.match(/Posted:\s*([^\n]+)/i)?.[1]?.trim() || "";
    return {
      id,
      url,
      text: quoted.replace(/\\/g, "").slice(0, 280),
      postedAt: posted.replace(/\\/g, ""),
    };
  }).filter((post) => post.id && post.text);
  return posts.slice(0, 8);
}

export function accountStageFromPosts(postCount: number): "bootstrap" | "early" | "active" {
  if (postCount <= 0) return "bootstrap";
  if (postCount < 5) return "early";
  return "active";
}

export function normalizeComparableText(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\u2013\u2014\u2212]/g, " ")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textLooksPublished(haystack: string, needle: string) {
  const source = normalizeComparableText(haystack);
  const target = normalizeComparableText(needle);
  if (!source || !target || target.length < 24) return false;
  // Require a distinctive contiguous phrase so an older intro post cannot
  // falsely verify a regenerated draft with a different message.
  const phrase = target.slice(0, Math.min(48, target.length));
  if (source.includes(phrase)) return true;
  const tokens = target.split(" ").filter((token) => token.length > 3);
  if (tokens.length < 6) return false;
  const hits = tokens.filter((token) => source.includes(token)).length;
  return hits / tokens.length >= 0.88;
}
