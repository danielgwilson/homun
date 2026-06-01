# mimetic-cli

Private incubator for a generalizable product simulation CLI and proof harness.

`mimetic-cli` is intended to extract the reusable substrate behind:

- Northstar `ui-sim`
- NoBG `ui-sim`
- Image Skill simulation / self-driving product harness work

The intended shape is adapter-first: core packages provide the durable simulation machinery, while product adapters define app topology, routes, personas, scenarios, milestones, runtime commands, and review vocabulary.

## Local Layout

```text
~/local_git/mimetic-cli-repo/
  mimetic-cli/   # canonical checkout
  worktrees/     # sibling feature worktrees
```

## Initial Scope

- Define the adapter contract.
- Extract shared artifact, manifest, observer, actor, and run-review primitives.
- Port NoBG as the first adapter proof.
- Port Image Skill or Northstar as a second adapter proof before treating the abstraction as stable.

## Status

Repository chassis only. Implementation should start from source comparison and contract design, not a from-scratch rewrite.
