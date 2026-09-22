# Issue tracker: Linear

Issues and specs for this repo live in Linear, not GitHub Issues.

- Workspace team: **Ribo Project** (key `RIB`, id `54232475-5d3e-47d6-8f05-c789dc841a85`)
- Project: **OP-Codex** (https://linear.app/ribo-project/project/op-codex-2140459431f3)

Use the `mcp__claude_ai_Linear__*` tools for every operation. Always set team = `Ribo Project` and project = `OP-Codex` on new issues.

## Conventions

- **Create an issue**: `save_issue` with title, markdown description, team, project, labels.
- **Read an issue**: `get_issue` (e.g. `RIB-12`), plus `list_comments` for the discussion.
- **List issues**: `list_issues` filtered by project `OP-Codex`, plus label / state as needed.
- **Comment on an issue**: `save_comment` on the issue.
- **Apply / remove labels**: `save_issue` with the updated label list. If a label is missing, create it on the team with `save_issue_label`.
- **Close**: set the state to `Done` (completed) or `Canceled` (won't do), with a comment.

Workflow states: Backlog → Todo → In Progress → In Review → Done (plus Canceled and Duplicate).

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Code lives on GitHub `Ribo14/OP-Codex`; set to `yes` only if external PRs should be triaged as feature requests. `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a Linear issue in team Ribo Project, project OP-Codex.

## When a skill says "fetch the relevant ticket"

Run `get_issue` with the `RIB-<n>` identifier, then `list_comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a Linear sub-issue of the map (parent = map). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Linear's native "blocked by" issue relations. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier query**: list the map's open sub-issues, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: assign the issue to `me`, the session's first write.
- **Resolve**: `save_comment` with the answer, set state to `Done`, then append a context pointer (gist + link) to the map's Decisions-so-far.
