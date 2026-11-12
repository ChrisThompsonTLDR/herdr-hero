# AI Hero

A 320 px panel docked on the right that puts [aihero.dev](https://www.aihero.dev) (Matt Pocock's AI engineering site) next to your agents. Five buttons for the skill chain type slash commands into the agent you are working with, the site's latest posts and skills changelog are a list, and any item opens as markdown that you can hand to that agent in one click.

![AI Hero](preview.png)

## What you see

Top to bottom, on the theme's `surface` color, 12 px text:

1. **Header**, 12 px padding: `AI Hero` (13.5 px, semibold, `accent`), a 7 px round dot in the focused agent's status color (`working`, `blocked`, `done`, `idle` from the theme; `dim` when no agent has focus), then the agent's terminal title (11 px, `dim`, truncates). With no focused agent the text reads `no focused agent: chips start Claude`.
2. **Search field**, 30 px high, 7 px radius, `input` border, `background` fill, placeholder `Search aihero.dev, Enter`.
3. **Skill chain**: five chips, 24 px high, 6 px radius, 11 px text, `raised` fill, `border` outline: `/grill-me`, `/to-spec`, `/to-tickets`, `/implement`, `/pr`. They wrap if the panel is narrow.
4. **Caption**, 10.5 px `dim`: `Latest`, or `<n> results` after a search.
5. **List**, the rest of the height, scrolling. Each row has 12 px side padding, 6 px vertical: the title (`foreground`) and under it, 10.5 px `dim`, the kind (`article`, `skills`, or the search hit type such as `skill`) and its age (`today`, `6d`, `1mo`, `1y`; none for search hits). `hover` background on hover.
6. A red (`blocked`) error line above the caption when a fetch fails.

Clicking a row opens a 720 × 560 dialog (`popover` background, 16 px padding): the title, a `Hand to agent` primary button and a `Close` button, then the page's markdown, scrolling and selectable.

## How it behaves

- **Feed:** loads at start and every 30 minutes. Articles and the skills changelog are merged, sorted newest first, deduplicated by title, capped at 60.
- **Search:** typing only edits the field; Enter runs the search. Under 2 characters clears it back to `Latest`.
- **Chips:** click types `/<name>` and Enter into the focused agent, only when that agent is `idle`. If it is `working`, `blocked` or `done`, nothing is typed and an error toast says so. With no focused agent, a new tab named `/<name>` starts `claude` with that first message. The last chip clicked gets an `accent` outline until the panel reloads.
- **Hand to agent:** types `Read <page-url>.md and apply what it teaches to this repo.` into the focused agent (same idle-only rule), then closes the dialog. With no focused agent it shows an error toast and stays open.
- **Agent status in the header dot** follows `agents()` live; nothing polls it.
- No keys are bound. The panel is opened by its dock (`place: right`) or the palette.

## Built from

```
mods/hero/
  mod.json   { "place": "right", "size": 320, "title": "AI Hero" }
  main.js    default class Hero extends View. With props().url it draws the reader, else the panel.
  feed.js    pure helpers: parseRss, parseSearch, mdUrl, ago, stripFrontMatter, BASE, CHAIN, HEADERS
```

- Imports: `View, div` from `gpui-kit`; `v_flex, h_flex, InputState, Input, TextView` from `gpui-base`; `agents, closeOverlay, hc, notify, openOverlay, props, run, theme` from `herdr`.
- Network (tell the person before installing): `fetch` GET with header `User-Agent: herdr-hero-mod/0.1`, to
  - `https://www.aihero.dev/rss.xml` (RSS 2.0; items have title, link, pubDate, description; not sorted, so sort by pubDate),
  - `https://www.aihero.dev/skills/rss.xml` (the skills changelog, same shape),
  - `https://www.aihero.dev/api/search?q=<query>` returning `{ result: { hits: [{ type, title, url, summary }] } }`,
  - `<page url>.md` for the reader (every page has a markdown twin; it starts with a `---` YAML front matter block, which `stripFrontMatter` removes).
  
  aihero.dev's `robots.txt` allows all of these, and none needs a login. The mod runs no programs except `hc send`; it reads no files.
- Commands: `hc(["send", <agent address>, <text>, "--if", "idle"])` (exit code non-zero means not typed); `run("tab.new", { name, argv: ["claude"], task })`; `openOverlay({ mod: "hero", kind: "dialog", width: 720, height: 560, props: { url, title } })`; `closeOverlay(props().overlay)`; `notify({ title: "AI Hero", body, level: "error" })`.
- The focused agent is `agents().find((a) => a.focused)`.
- The input uses `InputState.new({ placeholder })` in `init`, `on("change")` to keep the text and `on("submit")` to search.
- The five chain names are Matt Pocock's skills (github.com/mattpocock/skills, MIT): grill-me, to-spec, to-tickets, implement, pr. The agent must have those skills installed (`claude plugin install mattpocock-skills@claude-plugins-official`); the mod does not install them.

## Watch out

- The dialog opens `mod: "hero"` by name. If the folder is renamed, change that string in `main.js`.
- `hc send` types and presses Enter; the `--if idle` guard is what stops it typing into a busy agent. Do not drop it.
- Errors are shown, never hidden: a feed that fails to parse, a non-200 answer or a search reply without `result.hits` shows the message in red and keeps the last good list. There is no fallback source.
- `/rss.xml` also lists site pages (newsletter, skills landing), and its `kind` is always `article`; only the skills feed is `skills`. Search hit kinds come from the site.
- `.md` twins load only for aihero.dev page URLs; a search hit of a type with no twin shows the server's error in the dialog.
- Do not poll faster than 30 minutes; the site is someone's small server.
- Search does not search as you type: one request per Enter.
- A `mod.json` with `place: "right"` docks a copy the first time Herdr sees the folder. To try it without docking, copy it to another name with `place: "none"` and open it with `mod.open`.

## Done when

- `herdr-app check mods/hero` passes and `herdr-app status` shows no errors.
- The panel lists at least 10 rows within a few seconds, newest first, no repeated titles, with ages like `6d` and `1mo`.
- Typing `tdd` and pressing Enter shows `<n> results` with `The /tdd Skill` among them.
- Clicking a row opens the dialog with the page's markdown and no `title:`/`slug:` front matter lines at the top.
- With an idle agent focused, clicking `/to-spec` types `/to-spec` into it; with a working agent focused it types nothing and shows an error toast.
- `Hand to agent` types the `Read ….md` sentence into the focused idle agent and closes the dialog.
- Turning the network off shows a red error line, not an empty list.
