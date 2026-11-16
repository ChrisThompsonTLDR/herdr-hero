# Issue tracker: Gitea (orum-authored, not upstream)

Specs, tickets and wayfinder maps for this repo live as Gitea issues on `orum/herdr-hero`. Every operation is a call to the Gitea MCP (`mcp__plugin_orum_gitea__gitea-issue_write`, `-issue_read`, `-list_issues`, `-search_issues`, `-label_read`, `-label_write`, `-pull_request_write`). Never use the REST API, `tea`, `gh` or the database. If a call fails or the MCP lacks a capability, stop on that step and report the error verbatim; never guess a value, never substitute another route. Replace `orum/herdr-hero` when this file is copied into `docs/agents/issue-tracker.md`.

## What Gitea gives natively

- **Dependencies: yes.** `issue_write` `add_dependency` / `remove_dependency` (`issue_number`, `dependency_type` `blocked_by` or `blocking`, `related_issue_number`), read with `issue_read` `get_blocked_by` / `get_blocking` (page to the end). An issue with an open blocker cannot be closed: the call fails with "cannot close this issue or pull request because it still has open dependencies".
- **Sub-issues: no.** Gitea has none (go-gitea/gitea#36696 is an unaccepted proposal). The parent link is the first body line `Part of #<parent>` plus a dependency, both defined below. Gitea gives no progress roll-up.
- **Exclusive scoped labels: yes.** A label named `kind/spec` created with `exclusive: true` replaces any other `kind/` label when applied.
- **Issues and PRs share one number space**, so a bare `#42` may be either.
- `list_issues` omits the issue body. To test a body convention (`Part of #n`), read each candidate with `issue_read` `get`.

## Labels

Create each missing label once, at conversion, with `label_write` `create_repo_label` (an org label with `create_org_label` serves every repo; ask before adding one for the whole org). Resolve ids with `label_read` `list_repo_labels` (page to the end).

| Label | Exclusive | Meaning |
| --- | --- | --- |
| `kind/spec` | yes | The issue is a spec |
| `kind/ticket` | yes | The issue is a ticket under a spec |
| `chain:ready` | no | The skills' `ready-for-agent`: an implementer subagent of the chain may take it |
| `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task` | no | Wayfinder map and its child types |

Attach with `issue_write` `add_labels` (label names or ids), remove with `remove_label` (`label_id`), swap all with `replace_labels`.

## Role mapping

- **`ready-for-agent` maps to `chain:ready`** wherever `/to-spec` and `/to-tickets` say to apply it. Chain tickets never carry the opencode hand-off label, so they never trigger it. Handing a ticket to opencode stays the deliberate `hand-to-opencode` step: it is never implied by `chain:ready`.
- `/triage` keeps its own fixed labels and its own `ready-for-agent` hand-off (its Orum adaptation overrides this file). Never put `chain:ready` on an issue through `/triage`.
- Other triage roles are not used by the chain.

## Conventions

- **Create / publish to the issue tracker**: search first (`list_issues` with `labels` and `state` `all`, or `search_issues`); update on a confident match, `issue_write` `create` only when new. `title` and `body` are required, labels go in `labels`.
- **Read / fetch the relevant ticket**: `issue_read` `get`, then every page of `get_comments`, then `get_blocked_by` and `get_blocking`. Read until a page comes back short.
- **List**: `list_issues` with `labels`, `state`, `page` (and `type` `issues`). Page to the end; a short page is the end.
- **Comment**: `issue_write` `add_comment` (`issue_number`, `body`).
- **Close**: `issue_write` `update` with `state` `closed`. If Gitea refuses because of an open dependency, report that error; do not remove the dependency to get around it.
- **Link text**: write issues as `#<n>` in bodies. In prose to the user, refer by title with the link; never a bare number.

## Spec

- One issue with the exclusive label `kind/spec` and `chain:ready`, body from the `/to-spec` template.
- **The spec body is not edited after `/to-spec` publishes it.** Corrections go in a comment. The only things that change on a spec afterward are its dependencies (tickets added by `/to-tickets`), its comments, and its open or closed state.
- A spec is closed only by the post-merge step, once every ticket is closed (see Closing).

## Ticket (make-sub-issue)

A ticket is a child of exactly one spec:

1. Create the issue (`issue_write` `create`) with labels `kind/ticket` and `chain:ready`. The first line of its body is exactly `Part of #<spec>`, then a blank line, then the `/to-tickets` issue template without its `Parent` section and without its `Blocked by` section (the edges are native).
2. Make the spec depend on it: `issue_write` `add_dependency` on the spec with `dependency_type` `blocked_by` and `related_issue_number` the ticket. The spec thus lists every child in its dependency sidebar and cannot close while one is open.
3. For each blocker of the ticket, `add_dependency` on the ticket with `blocked_by` and `related_issue_number` the blocker. Publish tickets blockers first so every blocker already has a number.
4. When the ticket comes from an existing issue, `issue_write` `update` that issue's body with `Part of #<spec>` prepended, and add the labels.

"Do NOT close or modify any parent issue" (the `/to-tickets` rule) is read as: never close, retitle, relabel or rewrite the spec; adding the `blocked_by` edge in step 2 is the one allowed change. Re-running `/to-tickets` to add a ticket is allowed: repeat steps 1 to 3 for the new ticket only.

A ticket that carries two `Part of` lines, or two specs, is an error: remove the second line and its dependency (`remove_dependency`) before continuing.

## Blocking

Edges between tickets are native Gitea dependencies (above), never a `Blocked by:` body line. A ticket is unblocked when every blocker is closed (read the `state` of every entry `get_blocked_by` returns; an empty list, or only closed entries, means unblocked). If a dependency cannot be created, stop and report the error; do not write a body line instead.

## Frontier

The tickets an implementer may start: `list_issues` with `labels` `["kind/ticket"]`, `state` `open`, paged to the end; keep those whose body (read with `issue_read` `get`) starts with `Part of #<spec>`; drop any with an assignee or a holder claim, and any with an open blocker (`get_blocked_by`, paged, entry `state` `open`). The spec's tickets are the ones its dependency list (`get_blocked_by` on the spec) names; use that list to cross-check.

## Integration branch and PR

- The integration branch for a spec is named `spec/<n>-<slug>`: `<n>` the spec's number, `<slug>` its title in lowercase ASCII with runs of other characters turned into single hyphens.
- The draft PR (`pull_request_write` `create`, body from the `pr` skill) lists one `Closes #<ticket>` line per ticket and **no closing keyword for the spec**. Name the spec with one line `Refs #<spec>` (chain-state finds the PR by it, also after the branch is deleted). Never put `close`, `closes`, `fix`, `fixes`, `resolve` or `resolves` before the spec number.
- Implementer commits on the integration branch carry a footer `Refs: #<ticket>` (or `Closes #<ticket>`); chain-state counts a ticket as finished when such a commit is on the branch.
- Gitea closes each listed ticket when the PR merges. Because a ticket closes only when its blockers are closed, merge order never matters for the PR itself.

## Closing (post-merge step)

After the integration PR merges, read the spec's `get_blocked_by`. If every ticket is closed, close the spec with `issue_write` `update` (`state` `closed`). If a ticket is still open (a `Closes` line was missed), report the error naming that ticket, close the ticket through the MCP once it is verified done, then close the spec. Gitea will refuse to close the spec while any ticket is open: report that refusal, do not work around it.

## Markers

Durable step markers are comments whose first line is exactly one hidden marker:

- `<!-- chain:grilled -->`: a grilling on this issue finished (post once, with a one-line summary).
- `<!-- chain:retro -->`: `/retro` ran for this spec; the retro findings follow in the same comment, posted on the spec.

Find a marker by reading every comment page (`get_comments`) and matching the first line exactly.

## Pull requests as a triage surface

**PRs as a request surface: no.** (Set to `yes` only if this repo treats external PRs as feature requests; `/triage` reads this flag.) When `yes`, read a PR with `pull_request_read`, list with `list_pull_requests`, and label, comment and close through `issue_write` using the PR's number.

## Wayfinding operations

Used by `/wayfinder`. The **map** is one issue with **child** issues as tickets. Same operations as `wayfinder/issue-tracker-gitea.md`.

- **Map**: one issue labeled `wayfinder:map`, holding Destination / Notes / Decisions so far / Not yet specified / Out of scope, and a task list of its tickets (`- [ ] #<n> <title>`), which Gitea renders with progress. It does not carry `kind/` labels.
- **Child ticket**: an issue labeled only with `wayfinder:<type>` (`research`, `prototype`, `grilling`, `task`); it never carries `kind/` or `chain:` labels. Its body starts with `Part of #<map>`, and the map depends on it (`add_dependency` on the map, `blocked_by` the child), so the map cannot close while a child is open. Claimed = assigned to the driving user (`issue_write` `update`, `assignees`).
- **Blocking**: native dependencies between children, as above.
- **Frontier**: `list_issues` with `labels` of the ticket types, `state` open; keep those whose body names `Part of #<map>`, drop the assigned ones and those with an open blocker; first in map order wins.
- **Claim**: assign the issue as the session's first write.
- **Resolve**: post the answer as a comment, close the issue, tick its line in the map's task list and append a context pointer (gist and link) to the map's Decisions so far.
- **Refer by name**: titles wrap the links; never a bare number.
