# Txx — <Title>

**Phase:** <n> · **Depends on:** <Txx, …> · **Risk:** <low|med|high> · **Decisions:** <D#, …>
**Audit refs:** <SEC-xx, BUG-xx, DUP-xx, ARCH-xx>

## Goal
One paragraph: the outcome, and why it matters.

## Context
The facts the implementer needs, with `file:line` references into the current code. No guessing.

## Files
- Create: …
- Modify: …
- Delete: …
(Touching any file not listed needs a justification in the commit message.)

## Steps
1. Numbered, concrete, verifiable steps. Include exact versions, names and shapes where they matter.

## Must NOT change
- Binding list of behaviours, data shapes, names, UI or text that must stay identical.

## Acceptance
```bash
# Exact commands. All must pass.
```
Plus any manual or grep checks.

## Rollback
How to undo it: git revert, and any data or deploy implications.

## Stop and ask Paul if…
- Situations where the implementer must not decide alone.
