import test from "node:test";
import assert from "node:assert/strict";
import { progress, parseRss, stripFrontMatter, transcriptCommand } from "../mods/hero/feed.js";

test("progress takes the last chain step as current and remembers earlier ones", () => {
  const p = progress(["research", "grill-me", "orum:to-spec", "to-tickets", "implement-spec"]);
  assert.equal(p.current, 3);
  assert.deepEqual([...p.seen].sort(), [0, 1, 2, 3]);
});

test("progress with no chain step", () => {
  const p = progress(["rename", "research"]);
  assert.equal(p.current, -1);
  assert.equal(p.seen.size, 0);
});

test("parseRss reads items and rejects an empty feed", () => {
  const xml = "<rss><channel><item><title><![CDATA[A &amp; B]]></title><link>https://x/y</link><pubDate>Sat, 16 May 2026 00:00:00 GMT</pubDate><description>d</description></item></channel></rss>";
  assert.equal(parseRss(xml, "article")[0].url, "https://x/y");
  assert.throws(() => parseRss("<rss></rss>", "article"), /no items/);
});

test("stripFrontMatter removes only the leading block", () => {
  assert.equal(stripFrontMatter('---\ntitle: "x"\n---\n# Hi\n---\nkeep'), "# Hi\n---\nkeep");
});

test("transcriptCommand picks PowerShell for a drive-letter folder and sh otherwise", () => {
  assert.equal(transcriptCommand("C:\\Users\\a b\\it's").at(0), "powershell");
  assert.match(transcriptCommand("C:\\x")[1][2], /'C:\\x'/);
  assert.equal(transcriptCommand("/home/x")[0], "sh");
});
