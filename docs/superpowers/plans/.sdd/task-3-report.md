# Task 3 — regulationLib + copilot api (合规伴填 法规库 + API client)

## Status
**DONE** — all 12 tests pass (Task 2's 7 + Task 3's 5 new). Both modules transpile cleanly via vitest's esbuild and import without error. No concerns; no deviations from the verbatim source.

## Files touched
- `src/app/compliance/copilot/regulationLib.ts` — NEW. Regulation-clause library keyed by `questionId` (z1/z3/z4/ls/s1a/t4), the `QUESTION_LIST` index, and `buildRegulationContext(questionId)` which renders the grounding prompt ("可引用条款（只能引这些）").
- `src/app/compliance/copilot/api.ts` — NEW. Thin client: `post()` helper over `fetch`, `copilotApi.extract` → `/api/copilot/extract`, `copilotApi.regulation` → `/api/copilot/regulation` (dev proxy from Task 1).
- `src/app/compliance/copilot/regulationLib.test.ts` — NEW. 5 vitest cases.
- `docs/superpowers/plans/.sdd/task-3-report.md` — this report.

No other files modified. `.env`, `package.json`, and Task 1's proxy config were left untouched (no new deps; vitest already installed in Task 2).

## `npm test` result
```
Test Files  2 passed (2)
     Tests  12 passed (12)
  Duration  1.45s
```
New cases (5), all green:
- `QUESTION_LIST` non-empty, ids include `z1/z3/ls/s1a`.
- `buildRegulationContext("z1")` contains `股权架构` and `可引用条款`.
- `buildRegulationContext("nope")` returns `""`.
- Every `QUESTION_LIST` id has a `regulationLib` entry (z1/z3/z4/ls/t4/s1a all defined — covers the `t4`/`z4` ids not asserted by the other cases).
- `copilotApi` exposes `extract` + `regulation` as functions.

## Notes
- Per the task's global constraint, `npm run build` was **not** run (exFAT outDir corruption documented in Task 2's report makes it flaky; `npm test` is the gate). The new modules are pure TS with no side effects on import, and vitest's esbuild confirms they transpile — `regulationLib.ts` has no imports, `api.ts` uses only the platform `fetch`.
- `api.ts` is not yet wired into any UI/build graph (no reachable import from the entry), consistent with Task 2's `fieldCatalog.ts`. Integration into the copilot UI is a later task.
- The `/api/copilot/extract` and `/api/copilot/regulation` endpoints are assumed to be provided by the Task 1 dev proxy; no runtime exercise of the network path is in scope for this unit-test gate.
