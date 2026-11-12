// AI Hero beside your agents: Matt Pocock's skill chain as buttons that type into the
// focused agent, aihero.dev's feeds and search as a list, and any page opened as markdown
// that can be handed to the agent. One mod: the panel, and (given a url prop) the reader.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { agents, closeOverlay, hc, notify, openOverlay, props, run, theme } from "herdr";
import { BASE, CHAIN, HEADERS, ago, mdUrl, parseRss, parseSearch, stripFrontMatter } from "./feed.js";

const REFRESH_MS = 30 * 60 * 1000;

const get = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r;
};

// The agent that has the keyboard, else null. Chips and hand-offs go to this one.
const target = () => agents().find((a) => a.focused) ?? null;

async function typeInto(agent, text) {
  const r = await hc(["send", agent.address, text, "--if", "idle"]);
  if (r.code !== 0) throw new Error(`${agent.title || agent.address} is ${agent.status}, not idle: nothing typed`);
}

export default class Hero extends View {
  init(_props, cx) {
    this.reader = props()?.url ? { url: props().url, title: props().title, body: null, error: null } : null;
    this.feed = [];
    this.hits = null;
    this.error = null;
    this.query = "";
    this.sent = null;
    if (this.reader) return this.openReader(cx);
    this.input = InputState.new({ placeholder: "Search aihero.dev, Enter" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.search(cx));
    this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        const [posts, skills] = await Promise.all([get(`${BASE}/rss.xml`), get(`${BASE}/skills/rss.xml`)]);
        const all = [...parseRss(await posts.text(), "article"), ...parseRss(await skills.text(), "skills")];
        const seen = new Set();
        this.feed = all.sort((a, b) => b.date - a.date).filter((i) => !seen.has(i.title) && seen.add(i.title)).slice(0, 60);
        this.error = null;
      } catch (e) { this.error = String(e.message ?? e); }
      cx.notify();
    });
  }

  search(cx) {
    const q = this.query.trim();
    if (q.length < 2) { this.hits = null; return cx.notify(); }
    cx.spawn(async (cx) => {
      try {
        this.hits = parseSearch(await (await get(`${BASE}/api/search?q=${encodeURIComponent(q)}`)).json());
        this.error = null;
      } catch (e) { this.error = String(e.message ?? e); }
      cx.notify();
    });
  }

  openReader(cx) {
    cx.spawn(async (cx) => {
      try { this.reader.body = stripFrontMatter(await (await get(mdUrl(this.reader.url))).text()); }
      catch (e) { this.reader.error = String(e.message ?? e); }
      cx.notify();
    });
  }

  chain(name, cx) {
    cx.spawn(async (cx) => {
      const agent = target();
      try {
        if (agent) await typeInto(agent, `/${name}`);
        else run("tab.new", { name: `/${name}`, argv: ["claude"], task: `/${name}` });
        this.sent = name;
      } catch (e) { notify({ title: "AI Hero", body: String(e.message ?? e), level: "error" }); }
      cx.notify();
    });
  }

  hand(cx) {
    cx.spawn(async (cx) => {
      const agent = target();
      try {
        if (!agent) throw new Error("no focused agent to hand this to");
        await typeInto(agent, `Read ${mdUrl(this.reader.url)} and apply what it teaches to this repo.`);
        closeOverlay(props().overlay);
      } catch (e) { notify({ title: "AI Hero", body: String(e.message ?? e), level: "error" }); }
      cx.notify();
    });
  }

  button(id, text, primary, action, t) {
    return h_flex().id(id).h(28).px(12).items_center().rounded(7).border_1().border_color(primary ? t.solid : t.input)
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium()
      .cursor_pointer().hover((s) => s.opacity(0.88)).on_click(action).child(text);
  }

  renderReader(t) {
    const r = this.reader;
    return v_flex().size_full().bg(t.popover).text_color(t.foreground).p(16).gap(10)
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().font_semibold().text_size(14).truncate().child(r.title))
        .child(this.button("hand", "Hand to agent", true, (_e, cx) => this.hand(cx), t))
        .child(this.button("close", "Close", false, () => closeOverlay(props().overlay), t)))
      .child(div().id("body").flex_1().min_h(0).overflow_y_scrollbar().text_size(12.5)
        .child(r.error ? div().text_color(t.blocked).child(r.error)
          : r.body === null ? div().text_color(t.dim).child("Loading…")
          : TextView.markdown("hero-md", r.body).selectable(true)));
  }

  render(cx) {
    const t = theme();
    if (this.reader) return this.renderReader(t);
    const agent = target();
    const now = Date.now();
    const list = this.hits ?? this.feed;
    const dot = agent ? ({ working: t.working, blocked: t.blocked, done: t.done, idle: t.idle })[agent.status] ?? t.idle : t.dim;
    return v_flex().size_full().bg(t.surface).text_color(t.foreground).text_size(12)
      .child(h_flex().px(12).pt(12).pb(8).gap(8).items_center()
        .child(div().font_semibold().text_size(13.5).text_color(t.accent).child("AI Hero"))
        .child(div().w(7).h(7).rounded(4).bg(dot))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(agent ? (agent.title || agent.program.name) : "no focused agent: chips start Claude")))
      .child(div().px(12).pb(8).child(Input.new(this.input).h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12)))
      .child(h_flex().px(12).pb(8).gap(3).flex_wrap().children(CHAIN.map((name) =>
        h_flex().id(`chain-${name}`).h(24).px(6).items_center().rounded(6).text_size(11)
          .border_1().border_color(this.sent === name ? t.accent : t.border).bg(t.raised)
          .text_color(this.sent === name ? t.accent : t.foreground).cursor_pointer()
          .hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.chain(name, cx)).child(`/${name}`))))
      .when(this.error != null, (el) => el.child(div().px(12).pb(6).text_color(t.blocked).child(this.error)))
      .child(div().px(12).pb(4).text_size(10.5).text_color(t.dim).child(this.hits ? `${this.hits.length} results` : "Latest"))
      .child(v_flex().id("hero-list").flex_1().min_h(0).overflow_y_scrollbar().children(list.map((i, n) =>
        v_flex().id(`row-${n}`).px(12).py(6).gap(2).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => openOverlay({ mod: "hero", kind: "dialog", width: 720, height: 560, props: { url: i.url, title: i.title } }))
          .child(div().text_color(t.foreground).child(i.title))
          .child(h_flex().gap(6).text_size(10.5).text_color(t.dim).child(i.kind).child(ago(i.date, now))))));
  }
}
