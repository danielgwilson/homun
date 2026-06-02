# Local Codex TUI Actor Contract

Date: 2026-06-02

Status: spec for issue #28. Implementation should start with one local actor
before four-lane fanout.

## Goal

Let `mimetic run` dogfood `mimetic-cli` with a real local Codex TUI actor while
preserving the public-safe harness contract:

```text
spawn actor
-> submit bounded prompt
-> stream sanitized lifecycle events
-> write run bundle
-> render Observer while active
-> verify final bundle
```

This actor proves the local harness substrate. It must not claim target product
behavior beyond the commands and artifacts it actually observes.

## Explicit Opt-In

The first live actor must require an explicit flag or env var. Non-dry-run
without opt-in should continue to fail closed.

Suggested gate:

```bash
mimetic run --actor codex-tui --sims 1
```

or:

```bash
MIMETIC_ENABLE_LOCAL_CODEX_TUI=1 mimetic run --sims 1
```

Provider spend, E2B, GitHub mutation, and external network calls remain off
unless separately and explicitly requested.

## Lifecycle Events

The actor should append deterministic events to `events.ndjson`:

| Event | Required fields |
| --- | --- |
| `actor.spawned` | `simId`, `streamId`, command name, cwd, startedAt |
| `actor.prompt.submitted` | prompt digest, prompt class, no raw prompt if unsafe |
| `actor.observation` | sanitized transcript tail, byte count, redaction status |
| `actor.artifact` | relative artifact path, kind, digest |
| `actor.verdict` | `passed`, `failed`, `blocked`, or `timed_out`; reason |
| `actor.exited` | exit code, signal, durationMs |
| `actor.timeout` | timeoutMs, last safe observation |
| `actor.cancelled` | signal and operator reason |

The Observer should be able to render a live terminal stream from those events
while the actor is active, then render the final transcript and artifacts after
exit.

## Runtime State

All generated state stays under ignored `.mimetic/`:

```text
.mimetic/runs/<run-id>/
  run.json
  review.json
  review.md
  events.ndjson
  transcripts/<stream-id>.txt
  observer/
    index.html
    observer-data.json
```

No raw terminal output is public by default. The transcript artifact must be
sanitized before it is linked from the bundle.

## Redaction Rules

Before any transcript tail or event payload is written:

- redact OpenAI, E2B, GitHub, npm, and generic private-key patterns;
- redact absolute local home/workspace paths when they are not necessary for
  proof;
- block the run if redaction cannot prove `status: passed`;
- record env var names only, never values.

## Initial Prompt Class

The first actor prompt should be bounded to public-safe dogfood work:

- inspect `mimetic/` dogfood config;
- run `pnpm mimetic -- doctor`;
- run or explain the strongest safe Mimetic proof command available;
- do not commit, push, publish, file issues, or print secrets;
- summarize blockers using public-safe evidence paths.

The raw prompt can live in source only if it contains no private context and no
credential values.

## Stop Conditions

The actor must stop and mark the lane `blocked` or `failed` if:

- Codex CLI is not installed or not authenticated;
- a command requests approval in a non-interactive run;
- redaction fails;
- output contains a likely secret after redaction;
- the actor touches files outside allowed runtime paths without explicit scope;
- timeout is reached.

## Acceptance For First Slice

The implementation slice for this spec should prove:

```bash
pnpm mimetic:doctor
MIMETIC_ENABLE_LOCAL_CODEX_TUI=1 pnpm mimetic -- run --sims 1 --json
pnpm mimetic -- watch --run latest --json --no-open
pnpm mimetic -- verify --run latest --json
pnpm check
```

If the 1x actor works, split or follow with a 4x fanout issue. Do not start with
4x fanout before the single actor lifecycle is deterministic.
