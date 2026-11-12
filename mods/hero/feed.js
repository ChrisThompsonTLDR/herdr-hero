export const BASE = "https://www.aihero.dev";
export const HEADERS = { "User-Agent": "herdr-hero-mod/0.1 (+https://herdr.dev/mods)", Accept: "*/*" };
// Matt Pocock's chain. `cmd` is what a pip types; `names` are every command or skill that counts as that step.
export const STEPS = [
  { id: "grill", label: "grill", cmd: "grill-me", names: ["grill-me", "grilling", "grill-with-docs"] },
  { id: "spec", label: "spec", cmd: "to-spec", names: ["to-spec"] },
  { id: "tickets", label: "tickets", cmd: "to-tickets", names: ["to-tickets"] },
  { id: "build", label: "build", cmd: "implement", names: ["implement", "implement-spec", "tdd"] },
  { id: "pr", label: "pr", cmd: "pr", names: ["pr"] },
];

// Command and skill names in transcript order -> { seen: Set of step indexes, current: index of the last one, -1 for none }.
// A plugin prefix ("mattpocock-skills:to-spec") is ignored.
export function progress(names) {
  const seen = new Set();
  let current = -1;
  for (const raw of names) {
    const name = raw.includes(":") ? raw.split(":").pop() : raw;
    const i = STEPS.findIndex((s) => s.names.includes(name));
    if (i >= 0) { seen.add(i); current = i; }
  }
  return { seen, current };
}

// Run on the agent's machine with its folder as $1: prints the names, newest transcript only.
export const TRANSCRIPT_SCRIPT = [
  'd="$HOME/.claude/projects/$(printf %s "$1" | sed "s/[^A-Za-z0-9]/-/g")"',
  'f=$(ls -t "$d"/*.jsonl 2>/dev/null | head -1)',
  '[ -n "$f" ] || { echo "#none"; exit 0; }',
  `grep -o -E '<command-name>/[A-Za-z:-]+</command-name>|"skill":"[A-Za-z:-]+"' "$f" | sed -E 's#<command-name>/##; s#</command-name>##; s#"skill":"##; s#"$##'`,
].join("\n");

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

const PS_SCRIPT = (cwd) => [
  `$d = Join-Path $env:USERPROFILE ('.claude\\projects\\' + ('${cwd.replace(/'/g, "''")}' -replace '[^A-Za-z0-9]','-'))`,
  "$f = Get-ChildItem -LiteralPath $d -Filter *.jsonl -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1",
  "if (-not $f) { '#none'; exit 0 }",
  "$r = [regex]'<command-name>/([A-Za-z:-]+)</command-name>|\"skill\":\"([A-Za-z:-]+)\"'",
  "foreach ($l in [IO.File]::ReadLines($f.FullName)) { foreach ($m in $r.Matches($l)) { if ($m.Groups[1].Success) { $m.Groups[1].Value } else { $m.Groups[2].Value } } }",
].join("; ");

// The program and arguments that print an agent's transcript names on its machine. A drive-letter folder
// means a Windows machine (PowerShell); anything else is POSIX (sh).
export function transcriptCommand(cwd) {
  return /^[A-Za-z]:[\\/]/.test(cwd)
    ? ["powershell", ["-NoProfile", "-Command", PS_SCRIPT(cwd)]]
    : ["sh", ["-c", TRANSCRIPT_SCRIPT, "sh", cwd]];
}
