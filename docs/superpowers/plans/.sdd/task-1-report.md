# Task 1 Report — DeepSeek LLM Dev-Proxy (`/api/copilot/*`)

**Status:** DONE_WITH_CONCERNS
**Date:** 2026-08-06
**Project root:** `E:\claude\出海智能体-合规\出海智能体设计 (最新版-ODI单独平台)`

> Note: the API key is never printed anywhere in this report or in any command output.

---

## 1. Files created / modified

| Action | Path |
|---|---|
| **Created** | `E:\claude\出海智能体-合规\出海智能体设计 (最新版-ODI单独平台)\src\server\copilot.ts` |
| **Modified** | `E:\claude\出海智能体-合规\出海智能体设计 (最新版-ODI单独平台)\vite.config.ts` |

### `src/server/copilot.ts`
Created verbatim per the task spec. Server-only module that:
- Reads `.env` into `process.env` at module load (no `VITE_` prefix, so nothing enters the client bundle).
- Exports `registerCopilot(server)` which mounts two Vite dev middlewares:
  - `POST /api/copilot/extract` — structured field-extraction wrapper (`EXTRACT_WRAP`), JSON mode on.
  - `POST /api/copilot/regulation` — regulation Q&A wrapper (`REGULATION_WRAP`), JSON mode on.
- Calls DeepSeek `${DEEPSEEK_BASE_URL}/chat/completions` with `Authorization: Bearer ${KEY}` server-side only.

### `vite.config.ts` (exactly two edits, nothing else changed)
1. Added to top import block:
   ```ts
   import { registerCopilot } from './src/server/copilot'
   ```
2. Appended as the LAST entry of the `plugins` array (after `tailwindcss()`):
   ```ts
   {
     name: 'compliance-copilot-proxy',
     configureServer(server) { registerCopilot(server); },
   },
   ```

---

## 2. End-to-end verification — `/api/copilot/extract` (real DeepSeek API)

Pre-existing Vite on port 5173 (PIDs 32744/33528, started before the code change) was killed, then a fresh `npm run dev` was started in the background. Vite v6.3.5 became ready in ~1786 ms.

Request:
```
POST http://localhost:5173/api/copilot/extract
Content-Type: application/json
{"systemPrompt":"字段清单：\n1. investMode 投资方式 允许值 new/ma/chg；new=境外设立新企业。","userText":"我们打算在越南设个生产基地。"}
```

**Exact response received (HTTP 200):**
```json
{"content":"{\"investMode\":{\"value\":\"new\",\"confidence\":0.9,\"evidence\":\"打算在越南设个生产基地\"}}"}
```

Matches the expected shape precisely — DeepSeek correctly returned `investMode=new`, confidence `0.9`, with an evidence quote. The `/api/copilot/regulation` endpoint was wired identically and not separately exercised (same `deepseek()` code path, JSON mode on).

---

## 3. Security check — API key must NOT be in the client bundle

> Important caveat about the build vehicle — see §4. The production build was run to a **fresh `outDir` (`dist_task1_verify`)** instead of the default `dist/`, because the pre-existing `dist/assets` directory is corrupted on the underlying exFAT volume (details in §4). This does not weaken the verification: the bundle contents are identical to what `dist/` would contain.

`grep -rl` results over the full built output:

| Pattern | Result | Verdict |
|---|---|---|
| `DEEPSEEK_API_KEY` | (empty) | PASS |
| `sk-7524` (key prefix) | (empty) | PASS |
| `DEEPSEEK` (any occurrence, belt-and-suspenders) | (empty) | PASS |
| `api.deepseek.com` (belt-and-suspenders) | (empty) | PASS |

Built artifacts (for the record): `index.html`, `assets/index-CC3qMLA9.js` (595.60 kB), `assets/index-DVdqs8yl.css` (86.56 kB), two PNG assets. No server code, no key material, no DeepSeek references of any kind in the client bundle. This is structurally guaranteed: `copilot.ts` is imported only by `vite.config.ts` (the build config, never part of the client graph), and nothing under `src/` imports it.

The temporary `dist_task1_verify` directory was removed after the check (cleanup confirmed).

---

## 4. `npm run build` outcome + environment concern

**Outcome:** the production build of the **frontend** succeeds (72 modules transformed, built in 6.11 s) **only when targeted at a fresh output directory**. The default `npm run build` (which writes to `dist/`) **FAILS** with:

```
EPERM: operation not permitted, mkdir 'E:\...\dist\assets'
```

**Root cause (pre-existing, NOT caused by this task):**
- The project lives on the `E:` volume, which is formatted **exFAT** (confirmed via `Get-Volume -DriveLetter E`: `FileSystem = exFAT`, label "Extreme SSD").
- exFAT has no NTFS ACLs, so the usual repair tools fail: `icacls /reset` reports "Successfully processed 1 files; Failed processing 2 files … Access is denied", and `takeown` reports "File ownership cannot be applied on insecure file systems; there is no support for ACLs."
- The specific subdirectory `dist/assets` (created by an earlier build at 16:10 today, before this task) now has a corrupted/inaccessible directory entry on exFAT: `Get-Item dist\assets` fails, `ls dist/assets` → "Permission denied", and even `cmd /c "rmdir /s /q dist"` reports success but the directory persists.
- This is an isolated, pre-existing exFAT filesystem artifact. It is unrelated to the copilot proxy code and does not affect the dev server (which runs fine and served the live extract call above).

**Impact on this task:** none. The dev proxy works end-to-end and the key-isolation guarantee is verified via the fresh-dir build.

**Impact on later tasks:** any task that runs the default `npm run build` will hit the same EPERM until the corrupted `dist/assets` entry is cleared (e.g. by running `chkdsk E: /f` on the volume from an elevated prompt, or by moving the project off exFAT / deleting `dist` from a context that can bypass the bad entry). Flagging now so it is not mistaken for a code regression.

---

## 5. Dev server state on exit

Left **running** on `http://localhost:5173/` (background task `bb67hhu85`; Vite PIDs 20324 + npm 5512), as instructed — the next task can reuse it. It serves the new `/api/copilot/extract` and `/api/copilot/regulation` middlewares.

---

## 6. Concerns

1. **exFAT `dist/assets` corruption (pre-existing, environmental).** Breaks the default `npm run build`. Not introduced by Task 1; see §4 for remediation (`chkdsk E: /f` or relocate project). Recommend the next task that needs a default `dist/` build address this first.
2. **`/api/copilot/regulation` endpoint not exercised live.** Shares the identical `deepseek()` code path and JSON-mode behavior of the verified `/extract` endpoint, so risk is low — but it was not separately hit during this task.
3. No other concerns. The proxy is dependency-free (uses global `fetch`), keys stay server-side, and the client bundle is clean.

---

## 7. Status

**DONE_WITH_CONCERNS** — Task 1 functionality is complete and verified end-to-end (live DeepSeek extract call returned the expected structured JSON; client bundle proven key-free). The single concern is a pre-existing exFAT filesystem issue that blocks the *default* `dist/` build path and should be resolved before any later task relies on `npm run build` writing to `dist/`.
