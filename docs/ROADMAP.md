# AI Terminal Studio — Technical Roadmap

This document turns the product vision in [overview.md](../overview.md) into an actionable, phased engineering plan. It is written for a coding agent (e.g. Claude Code) to follow across many sessions. The repository is currently empty except for `overview.md` — everything below starts from scratch.

---

## 1. Desktop Framework Decision: Electron vs Tauri

`overview.md` states a preference for Electron with a note to evaluate Tauri later. This section makes that decision explicit.

| Dimension | Electron | Tauri |
|---|---|---|
| PTY support | `node-pty` is a native Node addon; Electron bundles Node, so integration is direct and battle-tested (VS Code, Hyper, Theia all use exactly this). | No native Node addon support. Needs a Rust PTY crate (e.g. `portable-pty`) with Windows ConPTY bindings, or a Node sidecar talking to Rust over IPC — more custom glue, far less precedent for "wrap arbitrary CLI in a real PTY." |
| xterm.js integration | Drop-in; designed against Node/Electron pty streams. | Fine on the frontend (it's just a web component) — the pty data source is the hard part, not xterm.js. |
| Bundle/installer size | ~120–200MB (bundles Chromium + Node). | ~3–10MB (uses OS webview, WebView2 on Windows). |
| Native menu/window chrome | Mature, well documented. | Mature, comparable. |
| Auto-update | `electron-updater` / `electron-builder` — very mature, strong Windows NSIS story. | Tauri's own updater plugin — functional but younger, smaller track record. |
| Windows-specific concerns | Consistent Chromium rendering/DnD/clipboard/IME across Windows versions. | Depends on installed WebView2 runtime version; embedded-webview DnD/file-drop/IME historically rougher than Chromium. |
| Dev velocity (solo/small team) | Single JS/TS codebase end-to-end; no Rust required for PTY, fs watch, or git logic. | Requires Rust for any backend logic unless you add a Node sidecar — which erodes the bundle-size advantage. |

**Decision: Electron for v1.** The single highest-risk technical dependency in this whole product is reliable, real PTY semantics (resize, ConPTY on Windows, backpressure, clean process teardown). Electron + `node-pty` is the only option with a proven track record for exactly that job. Tauri's size/footprint advantages are real but not decisive for a developer tool whose users already run multi-hundred-MB CLIs and IDEs.

Re-evaluate Tauri only as a **post-MVP spike** (see Phase 6) — e.g. if installer size or idle memory becomes a real complaint once the UX has proven out. Do not spend roadmap time on it before MVP ships.

---

## 2. High-Level Architecture

### Process boundaries (Electron)

- **Main process** (full Node/OS access, no UI): owns everything stateful and privileged — PTY manager, workspace/session persistence, file watcher, git integration, window/app lifecycle, native dialogs, auto-updater. The only place that spawns processes or touches the filesystem outside of IPC-validated paths.
- **Preload script**: the sole bridge. `contextBridge.exposeInMainWorld` exposes a narrow, typed `window.api`. Renderer runs with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- **Renderer process**: React + TypeScript + Tailwind + shadcn/ui + Zustand + xterm.js. Talks to main only through `window.api.*` (invoke/response) and subscription callbacks (streamed events). Never touches `child_process`, `fs`, or `node-pty` directly — hard security boundary (see §6).

### PTY Manager (main process)

- One `PtySession` object per terminal/agent session, keyed by `sessionId`, spawned via `node-pty`.
- **Buffering/backpressure**: `node-pty`'s `onData` fires per OS chunk with no built-in flow control over IPC. Main self-throttles: accumulate into a small buffer and flush to renderer on a short timer (~16ms), capped in size, so a slow/detached renderer can't cause unbounded memory growth.
- **Resize**: renderer's xterm `FitAddon` computes cols/rows on container resize → IPC `session:resize(sessionId, cols, rows)` → main calls `pty.resize(cols, rows)`.
- **Reconnect-on-restore**: the OS process is gone once the app quits — you cannot reattach a killed PTY. "Restore" means respawning a fresh process with the same `cwd`/`command`, optionally replaying a bounded scrollback snapshot as inert history. Keep this distinction (metadata restore vs. process restore) explicit in the data model from Phase 2 onward.

### Workspace persistence model

- **What's saved**: workspace `{id, name, rootPath, createdAt}`; sessions `[{id, workspaceId, agentType, command, cwd, title, order, status, scrollbackRef, createdAt, lastActiveAt}]`; window layout (bounds + split-pane tree + active session); later — tasks, pinned files, prompt history/templates, timeline events.
- **Where**: JSON files behind a `WorkspaceRepository` interface, in `app.getPath('userData')`. Large scrollback text lives in separate flat files referenced by path from the session row — never inline in the main store.
- **Why JSON first, not SQLite immediately**: keeps Phase 0–1 dependency-light (avoids stacking a second native-module rebuild risk on top of `node-pty`). Because access goes through `WorkspaceRepository`, swapping in `better-sqlite3` later (Phase 5, once prompt history/timeline/task data is genuinely relational and append-heavy) is a contained, single-module change.
- **Restore flow**: app start → main loads workspace list → user opens one → main re-hydrates sessions (spawn fresh shells/agents in saved cwds, or mark "click to resume" if auto-resume is off) → renderer rebuilds the saved split-pane layout and reattaches xterm instances.

### IPC contract

- Domain-namespaced channels defined once in `src/shared/types/ipc.ts`, imported by main, preload, and renderer so payload shapes can't drift: `workspace:list/create/open/close`, `session:create/write/resize/kill`, `session:data` / `session:exit` (main→renderer streamed), `fs:readDir`, `fs:watch:subscribe/event`, `git:status/diff/log` (Phase 5+).
- Request/response → `ipcMain.handle` + `ipcRenderer.invoke` (promises). Streaming (pty output, file-watch events) → `webContents.send` + a subscribe/unsubscribe pattern exposed through preload — never raw `ipcRenderer` in renderer code.

### Zustand state shape

- `useWorkspaceStore`: `{ workspaces, activeWorkspaceId }`.
- `useSessionStore`: `{ sessionsByWorkspace, activeSessionId, statusBySessionId }` — **metadata and status only**. The actual terminal buffer lives inside each xterm.js `Terminal` instance (a plain non-reactive registry), not in Zustand — pty output is too high-frequency/large for a reactive store.
- `useLayoutStore`: split-pane tree, panel sizes/visibility, focused pane.
- Later: `useTaskStore` (Phase 4), `usePromptStore` (Phase 5), `useGitStore` (Phase 5/6).

### File watcher & git integration

- **File watcher**: `chokidar`, scoped to the active workspace root, ignoring `node_modules`, `.git`, `dist`. Powers the Explorer (Phase 3) and later modified-file/timeline correlation (Phase 5). Keep it toggleable given perf risk on very large repos.
- **Git**: `simple-git` (typed Promise wrapper over the real `git` binary), confined to main-process handlers. Shelling out to the same git binary the user's terminal already uses guarantees identical behavior/hooks/credentials — matching the product's own "read-only augmentation, not a git CLI replacement" principle.

---

## 3. Project Scaffolding

- **Package manager**: pnpm.
- **Repo shape**: single package, not a monorepo — one deliverable (one desktop app); internal boundaries enforced by folder structure, not workspace tooling.
- **Build tooling**: **electron-vite** (main/preload/renderer bundling, fast Vite HMR for renderer) **+ electron-builder** (packaging, Windows NSIS installer, `electron-updater` auto-update). electron-vite alone doesn't handle installer/auto-update; electron-forge's bundler is heavier and its Windows updater (Squirrel) is less mature than electron-builder's for this target platform.

### Folder structure

```
super-terminal/
  overview.md
  docs/ROADMAP.md
  electron.vite.config.ts
  electron-builder.yml
  src/
    main/
      index.ts, app-lifecycle.ts
      windows/mainWindow.ts
      pty/ptyManager.ts, ptySession.ts, agentDetector.ts, eventDetector.ts (phase5)
      workspace/workspaceRepositoryJson.ts, workspaceRepositorySqlite.ts (phase5), restoreService.ts
      fs/fileWatcher.ts, fsHandlers.ts
      git/gitService.ts, gitHandlers.ts
      ipc/registerIpcHandlers.ts
    preload/index.ts, api.ts
    renderer/
      main.tsx, App.tsx
      components/layout/, terminal/, explorer/, agentManager/, promptBuilder/, timeline/, gitPanel/, context/
      stores/workspaceStore.ts, sessionStore.ts, layoutStore.ts, taskStore.ts, promptStore.ts
    shared/types/workspace.ts, session.ts, task.ts, ipc.ts
  tests/unit/ (Vitest), tests/e2e/ (Playwright, from Phase 2)
```

### Testing approach

- **Unit** (Vitest): workspace repository logic, pty buffering/throttling (mocked pty), Zustand selectors/reducers, IPC payload shape checks, agent-detection heuristics.
- **E2e** (Playwright `_electron` driver): small smoke suite from Phase 2 onward — app launches, spawns a shell session, types/sees output, resizes. Keep it small given PTY e2e flakiness; rely on manual "done when" checks as the first line of verification per phase.

---

## 4. MVP-First Phased Roadmap

### Phase 0 — Scaffold & Hello Window
- **Deliverables**: electron-vite scaffold with main/preload/renderer split, Tailwind + shadcn/ui configured, Zustand installed (empty store), electron-builder producing a local Windows installer, strict TS/eslint baseline.
- **Key files**: `package.json`, `electron.vite.config.ts`, `electron-builder.yml`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`.
- **Done when**: `pnpm dev` opens a window with placeholder UI, no console errors; `pnpm build && pnpm package` produces a runnable Windows exe.

### Phase 1 — True MVP: Real PTY Terminal
- **Deliverables**: `node-pty` wired into main (rebuilt for Electron's ABI via `@electron/rebuild`), single workspace = one folder chosen via native dialog, multiple terminal tabs bound to that cwd, xterm.js per tab with `FitAddon`, full keystroke/output round-trip, resize propagation, arbitrary command spawn per tab (shell or e.g. `claude`), tab close kills the OS process. The typed IPC contract (`src/shared/types/ipc.ts`) is established here since every later phase depends on its shape.
- **Key files**: `src/main/pty/ptyManager.ts`, `ptySession.ts`, `src/main/ipc/registerIpcHandlers.ts`, `src/shared/types/ipc.ts`, `src/preload/api.ts`, `src/renderer/components/terminal/TerminalPane.tsx`, `useXtermSession.ts`.
- **Done when**: open a folder, run `dir`/`ls` in one tab, run `claude` in a second and interact with it, resize the window and confirm the pty reports updated cols/rows, close a tab and confirm its OS process is gone from Task Manager.

### Phase 2 — Agent Manager, Persistence, Three-Column Shell
- **Deliverables**: three-column layout per the wireframe in `overview.md`, Agent Manager panel listing all sessions with status/running-time/cwd and instant switching (backgrounded sessions keep running), JSON-backed workspace persistence (root path, sessions, window bounds, active session), relaunch restore (re-spawn shells/agents in saved cwds, rebuild layout).
- **Key files**: `ThreeColumnLayout.tsx`, `AgentManagerPanel.tsx`, `src/main/workspace/workspaceRepositoryJson.ts`, `restoreService.ts`, `src/renderer/stores/workspaceStore.ts`, `layoutStore.ts`.
- **Done when**: open 3 sessions, switch between them without losing live state, quit/relaunch, confirm the same 3 sessions and layout come back.

### Phase 3 — Explorer, Drag-to-Prompt, Split Views
- **Deliverables**: chokidar-backed live file tree in the left column; dragging a file onto the focused terminal pane inserts its relative `@path` text into that pane (no separate Prompt Builder input exists yet, so it targets whichever pane has focus); resizable split views (side-by-side/vertical/grid/focus), persisted via the layout tree from Phase 2.
- **Key files**: `src/main/fs/fileWatcher.ts`, `fsHandlers.ts`, `ExplorerTree.tsx`, `SplitView.tsx` (e.g. via `react-resizable-panels`).
- **Done when**: explorer reflects external file changes live; dragging a file inserts its path text into the focused pane; a 2x2 grid arrangement persists across relaunch.

### Phase 4 — Task Organization + Context Panel
- **Deliverables**: Tasks entity grouping sessions (create/rename/assign), Agent Manager grouped by task with collapsible groups; Context Panel for pinning files (README.md/CLAUDE.md/AGENTS.md/ARCHITECTURE.md/CONTRIBUTING.md) with a per-session indicator of which pinned files that session has referenced (heuristic from Phase 3's drag-insert log, not static analysis).
- **Key files**: `src/shared/types/task.ts`, `src/renderer/stores/taskStore.ts`, `TaskGroup.tsx`, `ContextPanel.tsx`.
- **Done when**: two tasks with assigned sessions render as collapsible groups; pinning files shows correctly in the Context Panel and per-session usage badges; state survives relaunch.

### Phase 5 — Prompt Builder, Session Timeline, Git Awareness
- **Deliverables**:
  - Prompt Builder bar: multi-file attach chips, prompt text, Send writes composed text into the focused pane's pty stdin, prompt history + reusable templates. Migrate persistence from JSON to `better-sqlite3` here (history/templates/timeline events outgrow flat JSON).
  - Session Timeline: hybrid — explicit app-generated events (Send is always a hard event) plus best-effort heuristic detection off the raw pty stream (shell-prompt patterns, common test-runner banners, commit output patterns). Per-agent-CLI-specific parsing is a stretch goal, not a v1 requirement — CLIs are treated as black boxes.
  - Git Awareness panel via `gitService` (simple-git): branch, modified files, diff preview, commit history; branch switching requires explicit confirmation if there are uncommitted changes (the one exception to "read-only," since switching branches is state-changing).
- **Key files**: `PromptBuilderBar.tsx`, `src/main/pty/eventDetector.ts`, `TimelinePanel.tsx`, `src/main/git/gitService.ts`, `GitPanel.tsx`, `src/main/workspace/workspaceRepositorySqlite.ts`, `migrateJsonToSqlite.ts`.
- **Done when**: Send produces the exact composed text in the focused terminal's stdin; Timeline shows a "prompt sent" event per Send plus best-effort command events; Git panel's branch/modified-file count matches manual `git status` in the same folder.

### Phase 6 — Polish, Packaging, Multi-Platform, Auto-Update
- **Deliverables**: theming/animation polish, full keyboard-first navigation (command palette), production Windows packaging (NSIS) as primary target with macOS/Linux config evaluated, `electron-updater` wired to a distribution channel (GitHub Releases is a reasonable default), local-file error logging (no telemetry, per "no cloud dependency"), scrollback persistence performance pass (capped size, lazy load), final pass against the full `overview.md` feature list. This is also the point to spike a Tauri evaluation if bundle size/memory has become a real concern.
- **Key files**: `electron-builder.yml` (multi-target), `src/main/updater/autoUpdater.ts`, `CommandPalette.tsx`, `src/main/logging/logger.ts`.
- **Done when**: installer auto-detects and applies a newer release; full keyboard shortcut list works end to end; UI stays responsive with ~50k lines of scrollback in a session.

---

## 5. Key Risks / Open Unknowns

- **`node-pty` native module rebuilds per Electron version**: Electron's Node ABI differs from system Node; `node-pty` must be rebuilt (`@electron/rebuild`) against it and re-verified on every Electron upgrade. On Windows, confirm `node-pty` uses ConPTY (not legacy winpty) for correct ANSI passthrough on Win11.
- **ANSI/passthrough edge cases in xterm.js**: TUI-heavy tools (vim, htop, alt-screen apps, OSC 8 hyperlinks, truecolor, bracketed paste) each stress xterm.js differently — treat compatibility with each target CLI (Claude Code, Codex CLI, Gemini CLI, etc.) as an ongoing per-agent checklist, not a one-time task.
- **Detecting "which CLI agent is this" for timeline heuristics**: no reliable OS-level signal beyond the spawn command string. Agent identity is only known when a session was started through the app's own "new agent" flow; a manually-typed command inside a plain shell tab is "unknown/manual," not forced through agent-specific heuristics.
- **Scrollback persistence performance**: full-buffer disk writes on every update are prohibitively expensive at scale — persist as debounced, size-capped snapshots per session in separate flat files (referenced by path from the DB/JSON row), explicitly framed as best-effort restore convenience, not guaranteed full history.
- **Security of running arbitrary shell commands from the renderer**: must never be possible directly — `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, all pty/fs/git access routed through the preload's narrow typed API into main-process `ipcMain.handle` handlers, with path/cwd validation in main so a compromised or buggy renderer can't spawn processes outside the intended workspace root.
- **Native module risk stacking**: `better-sqlite3` (introduced in Phase 5) is also a native addon requiring the same Electron-ABI rebuild treatment as `node-pty`. Optionally pull SQLite forward to Phase 2 to consolidate both native-module risks into one earlier point, at the cost of more upfront setup.
- **Windows-specific path handling**: spaces, drive letters, UNC paths across fs/git/pty modules; OS-level drag-and-drop (dropping a file from Windows Explorer) uses a different code path than in-app Explorer-panel drag — lower priority since the product doc emphasizes the in-app explorer.

---

## 6. Critical Files (build these first, in order)

1. `src/main/pty/ptyManager.ts` — highest-risk module (PTY spawn/buffer/resize/backpressure); everything else depends on it working correctly first.
2. `src/shared/types/ipc.ts` — the typed IPC contract shared by main/preload/renderer; established in Phase 1, load-bearing for every later phase.
3. `src/preload/api.ts` — the sole security boundary between renderer and privileged main-process capabilities.
4. `src/main/workspace/workspaceRepositoryJson.ts` — persistence interface designed to be swapped for SQLite later without touching call sites.
5. `electron.vite.config.ts` and `electron-builder.yml` — build/packaging foundation every phase's "done when" packaging check relies on.
