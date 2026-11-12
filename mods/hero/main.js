// AI Hero beside your agents: which step of Matt Pocock's chain (grill, spec, tickets, build, pr)
// each session is on, read from its Claude Code transcript; plus aihero.dev's feed and search,
// with any page opened as markdown that can be handed to an agent. One mod: the panel, and
// (given a url prop) the reader.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { agents, closeOverlay, exec, hc, notify, openOverlay, panes, props, run, spaces, theme } from "herdr";
import { BASE, HEADERS, STEPS, ago, mdUrl, parseRss, parseSearch, progress, stripFrontMatter, transcriptCommand } from "./feed.js";

const FEED_MS = 30 * 60 * 1000;
const TRACK_MS = 20 * 1000;
const RECHECK_MS = 90 * 1000;

const get = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r;
};

const target = () => agents().find((a) => a.focused) ?? null;

async function typeInto(agent, text) {
  const r = await hc(["send", agent.address, text, "--if", "idle"]);
  if (r.code !== 0) throw new Error(`${agent.title || agent.address} is ${agent.status}, not idle: nothing typed`);
}

// Where an agent's transcript lives: its folder, on its space's machine.
function whereIs(agent) {
  const pane = panes().find((p) => p.pane === agent.pane);
  const space = spaces().find((s) => s.id === agent.space);
  return { cwd: pane && pane.cwd, machine: space ? space.machine : null };
}

export default class Hero extends View {
  init(_props, cx) {
    this.reader = props()?.url ? { url: props().url, title: props().title, body: null, error: null } : null;
    if (this.reader) return this.openReader(cx);
    this.tab = "sessions";
    this.feed = [];
    this.hits = null;
    this.error = null;
    this.query = "";
    this.steps = {};
    this.checked = {};
    this.input = InputState.new({ placeholder: "Search aihero.dev, Enter" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.search(cx));
    this.refresh(cx);
    this.track(cx);
    cx.timer.every(FEED_MS, (cx) => this.refresh(cx));
    cx.timer.every(TRACK_MS, (cx) => this.track(cx));
  }

  // Re-read an agent's transcript when its status changed or it has not been read for a while.
  track(cx) {
    const now = Date.now();
    const due = agents().filter((a) => {
      const c = this.checked[a.address];
      return !c || c.status !== a.status || now - c.at > RECHECK_MS;
    });
    if (!due.length) return;
    due.forEach((a) => { this.checked[a.address] = { status: a.status, at: now }; });
    // Agents in one folder on one machine share a transcript folder: read it once.
    const reads = new Map();
    due.forEach((a) => { const w = whereIs(a); const k = `${w.machine}|${w.cwd}`; reads.set(k, [...(reads.get(k) ?? []), a]); });
    cx.spawn(async (cx) => {
      await Promise.all([...reads.values()].map(async (group) => {
        const { cwd, machine } = whereIs(group[0]);
        let result;
        try {
          if (!cwd) throw new Error("no folder for this pane");
          const [program, args] = transcriptCommand(cwd);
          const r = await exec(program, args, { on: machine, timeout: 60000 });
          if (r.code !== 0) throw new Error((r.stderr || `exit ${r.code}`).trim().split("\n")[0]);
          const names = r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
          result = names[0] === "#none" ? { seen: new Set(), current: -1, note: "no transcript" } : progress(names);
        } catch (e) { result = { seen: new Set(), current: -1, error: String(e.message ?? e) }; }
        group.forEach((a) => { this.steps[a.address] = result; });
      }));
      cx.notify();
    });
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

  // A pip types its command into that session, only when it is idle.
  send(agent, text, cx) {
    cx.spawn(async (cx) => {
      try { await typeInto(agent, text); this.checked[agent.address] = null; this.track(cx); }
      catch (e) { notify({ title: "AI Hero", body: String(e.message ?? e), level: "error" }); }
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

  session(a, t) {
    const st = this.steps[a.address];
    const color = ({ working: t.working, blocked: t.blocked, done: t.done, idle: t.idle })[a.status] ?? t.idle;
    const label = !st ? "reading…" : st.error ? "no read" : st.current < 0 ? "no step yet" : STEPS[st.current].label;
    return v_flex().id(`s-${a.address}`).px(12).py(7).gap(5).hover((s) => s.bg(t.hover))
      .child(h_flex().gap(7).items_center().cursor_pointer().on_click(() => run("agent.focus", { terminal: a.address }))
        .child(div().w(7).h(7).rounded(4).bg(color))
        .child(div().flex_1().min_w(0).truncate().text_color(a.focused ? t.accent : t.foreground).child(a.space_name))
        .child(div().text_size(10.5).text_color(st && st.error ? t.blocked : t.dim).child(label))
        .child(div().text_size(10.5).text_color(color).child(a.status)))
      .child(h_flex().gap(3).children(STEPS.map((s, i) => {
        const done = st && st.seen.has(i);
        const now = st && st.current === i;
        const bar = div().h(4).rounded(2).bg(now ? t.accent : done ? t.accent : t.border).opacity(now ? 1 : done ? 0.6 : 1);
        return v_flex().id(`p-${a.address}-${s.id}`).flex_1().gap(2).cursor_pointer().on_click((_e, cx) => this.send(a, `/${s.cmd}`, cx))
          .child(now && a.status === "working" ? bar.loop("opacity", { from: 0.45, to: 1, period: 1400 }) : bar)
          .child(div().text_size(9.5).text_color(now ? t.accent : t.dim).child(s.label));
      })));
  }

  renderSessions(t) {
    const list = agents();
    const bad = list.filter((a) => this.steps[a.address]?.error).length;
    return v_flex().id("sessions").flex_1().min_h(0).overflow_y_scrollbar()
      .when(!list.length, (el) => el.child(div().px(12).py(8).text_color(t.dim).child("No agents running.")))
      .children(list.map((a) => this.session(a, t)))
      .when(bad > 0, (el) => el.child(div().px(12).py(6).text_size(10.5).text_color(t.blocked)
        .child(`${bad} session${bad > 1 ? "s" : ""} could not be read: ${list.map((a) => this.steps[a.address]?.error).find(Boolean)}`)));
  }

  renderLearn(t) {
    const now = Date.now();
    const list = this.hits ?? this.feed;
    return v_flex().flex_1().min_h(0)
      .child(div().px(12).pb(8).child(Input.new(this.input).h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12)))
      .when(this.error != null, (el) => el.child(div().px(12).pb(6).text_color(t.blocked).child(this.error)))
      .child(div().px(12).pb(4).text_size(10.5).text_color(t.dim).child(this.hits ? `${this.hits.length} results` : "Latest"))
      .child(v_flex().id("hero-list").flex_1().min_h(0).overflow_y_scrollbar().children(list.map((i, n) =>
        v_flex().id(`row-${n}`).px(12).py(6).gap(2).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => openOverlay({ mod: "hero", kind: "dialog", width: 720, height: 560, props: { url: i.url, title: i.title } }))
          .child(div().text_color(t.foreground).child(i.title))
          .child(h_flex().gap(6).text_size(10.5).text_color(t.dim).child(i.kind).child(ago(i.date, now))))));
  }

  render(cx) {
    const t = theme();
    if (this.reader) return this.renderReader(t);
    const tab = (id, text) => div().id(`tab-${id}`).px(8).py(3).rounded(6).text_size(11.5).cursor_pointer()
      .bg(this.tab === id ? t.raised : t.surface).text_color(this.tab === id ? t.foreground : t.dim)
      .on_click((_e, cx) => { this.tab = id; cx.notify(); }).child(text);
    return v_flex().size_full().bg(t.surface).text_color(t.foreground).text_size(12)
      .child(h_flex().px(12).pt(12).pb(8).gap(10).items_center()
        .child(div().font_semibold().text_size(13.5).text_color(t.accent).child("AI Hero"))
        .child(h_flex().gap(2).child(tab("sessions", "Sessions")).child(tab("learn", "Learn"))))
      .child(this.tab === "sessions" ? this.renderSessions(t) : this.renderLearn(t));
  }
}
