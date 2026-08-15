# Task 4 — 合规伴填面板 (Panel Shell + Fill Tab)

## Status
DONE

## Files Touched
- `src/app/compliance/components/ComplianceCopilotPanel.tsx` (new, verbatim per spec)
- `src/app/compliance/components/ComplianceCopilotPanel.smoke.test.tsx` (new smoke-import test)

## Test Summary
`npx vitest run` → 3 files / 13 tests passing (12 prior + 1 new smoke); TSX compiles cleanly.

## Concerns
- None. Component is not yet wired into `ComplianceDetailPage` (Task 6) — expected per spec; smoke test is the proof of compilation.
- All imports verified to exist: `C` from `../complianceTheme`, `WizardApi` from `./fields`, `Mode` from `../logic/weights`, `getFieldsForStep`/`buildExtractSystemPrompt`/`parseExtractResponse`/`ParsedCandidate` from `../copilot/fieldCatalog`, `copilotApi` from `../copilot/api`.
- Red line honored: extraction (`parseExtractResponse`) only produces candidates; the only write to the wizard happens in `FillTab.confirm` (确认 button) via `c.field.write(api, ...)`.
