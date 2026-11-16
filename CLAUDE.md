# herdr-hero: working agreement for AI agents

This file covers only what is specific to this repository.

## The repo

A Herdr mod that shows which step of the skill chain each agent session is on and lets you read aihero.dev posts. See `RECIPE.md` for what it does. The code is in `mods/hero`, the tests in `tests/`.

## Where the work lives

The canonical repo is `orum/herdr-hero` on Gitea. The GitHub repo `ChrisThompsonTLDR/herdr-hero` is a read-only mirror: every push to `main` on Gitea is pushed there. Do not open pull requests or issues on GitHub.

Specs and tickets are Gitea issues on `orum/herdr-hero` (see `docs/agents/issue-tracker.md`). Never file a spec or a ticket in Plane, Linear or on GitHub. An effort still open in one of those is moved to Gitea, not finished there.

## Tests

Run only the test file that covers the code you changed, for example `node --test tests/feed.test.mjs`. CI runs the rest on the pull request.

## Agent skills

### Issue tracker

Specs and tickets are Gitea issues on orum/herdr-hero. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
