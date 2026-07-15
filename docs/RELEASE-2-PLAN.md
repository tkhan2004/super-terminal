# Release 2 — Fix & Feature Plan

This document turns the Release 2 feedback batch into an actionable engineering plan: root cause for each bug (already diagnosed against the current codebase), the fix approach, and a build-out plan for the two larger asks (terminal customization MVP, CI/CD release automation). Written for a coding agent to implement item by item.

---

## 1. Explorer only flags folders as git-modified, not individual files

**Root cause**: `handleGitStatus` in `src/main/ipc/registerIpcHandlers.ts` (~line 223) runs `git status --porcelain` **without** `-uall`/`--untracked-files=all`. By default git collapses a wholly-new/untracked directory into a single entry (`?? newFolder/`) instead of listing every file inside it. The renderer's per-file matching in `ExplorerTree.tsx` (`getGitStatusColor`, ~line 197–217) does exact-path comparison (`p === rel`) and is actually correct — it just never receives individual file paths for new folders, only the folder path itself, so files inside new folders never get colored/badged. Modified *tracked* files already work correctly since git always lists those individually.

**Fix**:
- Change the porcelain call to `git status --porcelain -uall` in `handleGitStatus`.
- No renderer change needed — `getGitStatusColor`/`getGitBadge` already do correct exact-path matching once per-file paths are present.
- Watch for perf: `-uall` can be slower on huge untracked directories (e.g. accidentally untracked `node_modules`) — keep existing `.gitignore` reliance as the mitigation (git already excludes ignored paths regardless of `-uall`).

---

## 2. Sidebar collapsed/narrow layout shifts icon & text position

**Root cause**: there's no dedicated icon-only collapsed mode — the sidebar toggle (`leftVisible` in `WorkspacePane.tsx`) is a full show/hide, not a compact rail. The reported shift happens when the resizable panel is dragged narrow: each row in `ExplorerTree.tsx` (`renderNode`, ~line 237–296) has inconsistent reserved width — the git badge (`M`/`A`/`U`) is only rendered conditionally, and the outer row `div` lacks `min-w-0`, so rows without a badge lay out differently than rows with one, making icon/name start position appear to "jump" between rows, especially with long filenames competing for the same shrinking space.

**Fix**:
- Add `min-w-0` to the outer row flex container so the row can actually shrink and `truncate` on the name `<span>` takes effect consistently.
- Reserve a fixed-width slot for the git badge regardless of whether a file has one (e.g. wrap it in a `w-4 shrink-0 text-center` container that renders empty when there's no badge), so every row keeps the same icon/name start x-position.
- Keep the icon itself in a `shrink-0` fixed-width wrapper (verify it already is; add if not).

---

## 3. Footer quota bar breaks (wraps) on narrow window widths

**Root cause**: `QuotaFooter.tsx` (~line 170–189, 428–433) is a single fixed-height (`h-7`) flex row with no `flex-wrap` control, no overflow handling, and no `min-w-0`/`truncate` on any text span. All quota entries render unconditionally via `Object.entries(quotas).map(...)`. When the window narrows below the content's natural width, text wraps inside the fixed 28px row instead of compacting, producing the misaligned look.

**Fix** (priority-based compacting, not just clipping):
- Wrap the footer content in `overflow-x-auto whitespace-nowrap` with a hidden scrollbar as the baseline safety net (never worse than today).
- Add a `ResizeObserver` on the footer container that sets a `compact` boolean in local state once available width drops below a threshold; when `compact`, hide the lowest-priority static labels first (`CLI Agent Sync: Active`, `Secure Storage: AES-256`) and shrink per-CLI quota labels to icon+percentage only (drop the CLI name text), keeping the actual quota numbers visible longest since they're the highest-value info.
- Apply `min-w-0`/`shrink` to all flex children so the browser can't force reflow before JS gets a chance to compact.

---

## 4. Terminal appearance customization (MVP feature — "super terminal" should live up to its name)

**Current state**: xterm.js `Terminal(...)` options in `src/renderer/components/terminal/useXtermSession.ts` (~line 23–34) are fully hardcoded — fixed font family/size, `cursorBlink: true` with no `cursorStyle`, and a theme `useEffect` (~line 110–162) that only toggles between two fixed dark/light 16-color palettes. `settingsStore.ts` currently only persists `themeMode` and CLI quota data — no appearance fields exist. There's no reusable settings-modal component; `QuotaFooter.tsx` has one bespoke inline modal we can use as the UI pattern to follow.

**Plan**:
1. **Data model**: add a `terminalAppearance` slice to `settingsStore.ts` — `{ fontFamily, fontSize, cursorStyle: 'block'|'bar'|'underline', cursorBlink, themePreset: string, customTheme?: Partial<ITheme>, backgroundOpacity }`. Persisted via the existing zustand `persist` middleware, no new storage mechanism needed.
2. **Presets**: ship 4–5 built-in xterm color themes (e.g. Dracula, Nord, Solarized Dark, Monokai, plus current default) as plain palette objects — cheap MVP win, no color-picker UI required for v1.
3. **Custom colors**: a simple color-picker grid (background/foreground/cursor/ANSI 16 colors) for users who want to go beyond presets — v1.1, not blocking.
4. **Wiring**: extend the existing theme `useEffect` in `useXtermSession.ts` to read from `terminalAppearance` instead of the hardcoded light/dark branch, and pass `fontFamily`/`fontSize`/`cursorStyle`/`cursorBlink` into the `Terminal(...)` constructor options.
5. **Settings UI**: new `TerminalAppearanceModal.tsx` following `QuotaFooter`'s existing modal pattern (`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm`), with a live mini xterm preview pane so changes are visible before applying. Add an entry point (gear icon) near the footer/settings area.
6. **Visual effects (stretch, phase 2)**: background opacity/blur via CSS on the terminal container is cheap; true OS-level window vibrancy/transparency needs `BrowserWindow({ transparent: true, vibrancy: ... })` in the main process — bigger change (affects window chrome, click-through regions, Windows Acrylic support), scope separately after the core theming ships.

**Done when**: user can pick a preset theme, adjust font/cursor, see a live preview, and have it apply to all open terminal panes immediately and persist across restarts.

---

## 5. Session Timeline never records activity

**Root cause**: the plumbing is intact end-to-end (`TerminalPane.tsx` calls `processStreamData` on every pty `onData` → `timelineStore.ts` → rendered in `AgentManagerPanel.tsx`) — this is not dead/unwired code. The actual detection logic in `processStreamData` uses regexes anchored to an exact `$`-terminated end-of-buffer match for shell-prompt-idle detection, and plain substring checks for git-commit/test-pass banners. Real conpty/node-pty output on Windows is saturated with ANSI/VT escape sequences (cursor positioning, OSC, color codes) around prompt text and colorized CLI output, so these un-stripped regex/substring checks very likely never match against real streams — explaining "no events recorded" without anything being structurally broken.

**Fix**:
1. Strip ANSI/VT escape sequences from the rolling buffer before running any detection regex (small `ansi-regex`-style strip utility applied once per chunk in `processStreamData`).
2. Re-validate the prompt-idle regex and git/test banner checks against real ANSI-stripped output captured from actual sessions (Claude Code, Codex CLI, a plain shell) — adjust patterns to match what's actually printed once stripped.
3. Add fixture-based unit tests for `processStreamData` using literal ANSI-laden sample strings (captured from a real session) so this doesn't silently regress again.
4. Keep the existing structural "prompt sent" event (already reliable, not heuristic-dependent) as the anchor; treat heuristic command/test detection as best-effort, matching the original roadmap intent.

---

## 6. Git checkout fails hard on untracked-file conflicts, no recovery path

**Root cause**: `handleGitCheckout` in `src/main/ipc/registerIpcHandlers.ts` (~line 370) runs a plain `git checkout <branchName>` via `execFile` with no pre-flight check and no stash/force option — it just surfaces git's raw stderr as `err.message` verbatim. The renderer's `handleBranchSwitch` in `AgentManagerPanel.tsx` (~line 160–181) only pre-checks `gitStatus.modified`/`gitStatus.staged` before warning the user — it never looks at `gitStatus.untracked`, so the exact scenario reported (untracked files blocking checkout) isn't caught client-side either, and the user just gets git's raw error via `alert()`.

**Fix**:
1. **Main process**: on checkout failure, pattern-match the specific git error (`"following untracked working tree files would be overwritten"`) and parse the listed file paths out of stderr. Return a structured result: `{ success: false, reason: 'untracked-conflict', conflictingFiles: string[] }` instead of just a raw message string, keeping the generic-error path unchanged for everything else.
2. **Recovery action**: offer the user a "Move conflicting files aside and retry" option — main process moves each conflicting file into a backup dir (e.g. `.super-terminal-backup/<timestamp>/`) inside the workspace, then retries the checkout automatically.
3. **Renderer**: extend `handleBranchSwitch`'s pre-flight warning to also include `gitStatus.untracked`, and replace the raw `alert()` failure path with a small dialog that surfaces `conflictingFiles` and offers the move-aside retry when `reason === 'untracked-conflict'`, falling back to the current raw-message alert for other error types.

**Done when**: switching branches with an untracked conflicting file (like the reported `.commandcode/taste/taste.md` case) shows a clear list of conflicting files with a one-click "move aside & retry," instead of a raw terminal-style error string.

---

## 7. CI/CD: automated build & release via GitHub Actions

**Current state**: no `.github/workflows` directory exists — nothing is automated today. There are two **conflicting** electron-builder configs (`package.json`'s `build` field vs. the root `electron-builder.yml`, mismatched appId/productName/owner), neither wired to any publish step. Install today is fully manual: build locally, upload the NSIS/portable `.exe` to a shared Drive folder, users download and run it by hand (per `HUONG-DAN-CAI-DAT.md`). No versioning automation exists — version is a hand-edited string in `package.json`.

**Plan**:
1. **Reconcile build config first**: pick one source of truth (recommend keeping `package.json`'s `build` field, since it's the one actually referenced by current scripts) and delete the stale root `electron-builder.yml`, or merge its fields in and delete the duplicate — do not ship CI against two disagreeing configs.
2. **Add `publish` config**: `provider: github`, pointed at this repo's actual `owner`/`repo` (not the stale placeholder values currently in `electron-builder.yml`).
3. **Workflow** (`.github/workflows/release.yml`): triggered on push of a tag matching `v*.*.*`. Steps: checkout → setup Node + pnpm → `pnpm install` → `electron-vite build` → `electron-builder --win --publish always`. Needs `permissions: contents: write` so the default `GITHUB_TOKEN` can publish a GitHub Release with the built installer attached — no extra PAT/secret needed for a same-repo release.
4. **Versioning**: keep it simple for now — manual `npm version <patch|minor|major> && git push --tags` triggers the release workflow. This alone removes "run build/release scripts by hand" (the ask), without introducing semantic-release/changesets complexity that isn't needed yet.
5. **Auto-update for existing users**: wire `electron-updater` into the main process (check-on-startup + prompt-to-restart) now that `publish` config exists, so users who already have the app get new releases without re-downloading manually.
6. **"Install with one command" for new users**: a plain Electron desktop app with native deps (`node-pty`) can't realistically be `npm install -g`'d like a CLI tool. Closest equivalent on Windows is a package-manager manifest — plan a **winget** manifest (`winget install SuperTerminal`) as a phase-2 follow-up once releases are automated and (ideally) code-signed; note that both winget and SmartScreen strongly prefer a signed installer, so code-signing is a prerequisite worth flagging even though it's out of scope for this immediate CI/CD pass.

**Done when**: pushing a `vX.Y.Z` tag alone produces a published GitHub Release with the built Windows installer attached, with zero manual build steps.

---

## Suggested implementation order

1. Explorer git-status flag (#1) and sidebar row layout (#2) — small, isolated, no risk of regressions elsewhere.
2. Footer responsiveness (#3) — isolated component.
3. Git checkout conflict handling (#6) — safety-relevant, should ship before more people hit it.
4. Timeline ANSI-stripping fix (#5) — isolated to `processStreamData`.
5. CI/CD reconciliation + release workflow (#7) — unblocks easier distribution of everything above.
6. Terminal appearance MVP (#4) — largest scope, benefits from shipping after the smaller fixes land so it isn't entangled with unrelated changes.
