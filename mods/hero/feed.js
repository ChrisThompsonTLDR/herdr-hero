export const BASE = "https://www.aihero.dev";
export const HEADERS = { "User-Agent": "herdr-hero-mod/0.1 (+https://herdr.dev/mods)", Accept: "*/*" };
export const CHAIN = ["grill-me", "to-spec", "to-tickets", "implement", "pr"];

const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (item, name) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item); return m ? decode(m[1]) : ""; };

// RSS 2.0 items: title, link, pubDate, description. Throws on anything that is not a feed.
export function parseRss(xml, kind) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (!items.length) throw new Error(`${kind} feed has no items`);
  return items.map((i) => ({ kind, title: tag(i, "title"), url: tag(i, "link"), date: Date.parse(tag(i, "pubDate")) || 0, summary: tag(i, "description") }));
}

export function parseSearch(json) {
  const hits = json && json.result && json.result.hits;
  if (!Array.isArray(hits)) throw new Error("search reply has no hits list");
  return hits.map((h) => ({ kind: h.type, title: h.title, url: h.url, date: 0, summary: h.summary || "" }));
}

export const mdUrl = (url) => `${url.replace(/\/$/, "")}.md`;

export function ago(ms, now) {
  if (!ms) return "";
  const d = Math.max(0, Math.floor((now - ms) / 86400000));
  return d < 1 ? "today" : d < 31 ? `${d}d` : d < 365 ? `${Math.floor(d / 30)}mo` : `${Math.floor(d / 365)}y`;
}

// The .md twins start with a YAML front matter block; the reader shows only the body.
export const stripFrontMatter = (md) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
