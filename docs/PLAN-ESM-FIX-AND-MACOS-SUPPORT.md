# Fix: Crash on installed build (ESM/CommonJS) + Plan: macOS support

This document covers two independent items:

1. **[DONE in this session]** Root-cause + fix for the `SyntaxError: Named export 'autoUpdater' not found` crash reported when installing the released build via `install.ps1` on another machine.
2. **[TODO — plan for a dev agent]** A phased plan to bring full macOS support (native app + macOS terminal/shell) to Super Terminal, which today only targets Windows.

Written so a coding agent can pick up either section independently.

---

## 1. Crash on launch: `Named export 'autoUpdater' not found` in `electron-updater`

### Root cause

[package.json](../package.json) declares `"type": "module"`, so everything under `out/main/` is loaded by Node as native ESM — not simulated/transpiled ESM. [electron.vite.config.ts](../electron.vite.config.ts) only forces CommonJS output for the **preload** bundle (`output: { format: 'cjs' }`); the **main** process bundle has no explicit `output.format`, so Rollup emits ESM `import` statements for main too, matching the package's `"type": "module"`.

[src/main/index.ts:2](../src/main/index.ts) had:

```ts
import { autoUpdater } from 'electron-updater'
```

`electron-updater` is a CommonJS package. When Node's ESM loader imports a CJS module, only exports that `cjs-module-lexer` can statically detect become named bindings. `electron-updater`'s CJS output doesn't expose `autoUpdater` in a way the lexer can see, so the named import throws `SyntaxError: Named export 'autoUpdater' not found` at module-instantiation time — before any of your code runs, which is exactly why the user sees an Electron "JavaScript error occurred in the main process" dialog immediately on launch, on every machine, not just theirs. This is a build/packaging bug, not something specific to their machine or the GitHub Actions release — it would reproduce for anyone running the packaged app (or even `pnpm start` against a built `out/`).

### Fix applied

`src/main/index.ts` now imports the CJS default export and destructures from it (the exact workaround Node's own error message suggests):

```ts
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
```

This works because `esModuleInterop`/`allowSyntheticDefaultImports` are already enabled in [tsconfig.json](../tsconfig.json), and Node's CJS/ESM interop always allows a default import of a CJS module's `module.exports` object, regardless of what the lexer can statically see.

Other CJS-only deps imported in `src/main` were checked and are fine:
- `chokidar` — already uses a default import.
- `node-pty` — named import of `spawn` is fine; its CJS output assigns `exports.spawn` in a way `cjs-module-lexer` detects correctly.

### What the dev agent should still do

1. `pnpm install` (this sandbox had no `node_modules`, so the fix was verified by static analysis of the CJS/ESM interop rules, not by an actual build — **run the real build before shipping**).
2. `pnpm run typecheck` — should pass unchanged (`esModuleInterop` already covers the new default-import shape).
3. `pnpm run package` (or `package:dir` for a faster local check) and launch the packaged app from `out`/`release` to confirm the dialog no longer appears.
4. Bump the version and cut a real tag so GitHub Actions produces a fixed release, then re-test the `irm ... | iex` install flow end-to-end on a clean Windows machine/VM.

### Optional hardening (not required, but prevents this class of bug recurring)

Add `output: { format: 'cjs', entryFileNames: '[name].js' }` to the `main` block in `electron.vite.config.ts`, mirroring what's already done for `preload`. Bundling main to CJS means all dependency imports (present and future) go through Node's normal, battle-tested `require()` interop instead of ESM named-import static analysis — the entire bug class disappears. Do this as a follow-up commit, separate from the minimal fix above, and re-run the full package+launch test after.

---

## 2. Plan: macOS support (native app + macOS shell)

### Goal

Ship a signed, notarized macOS build (Intel + Apple Silicon) that installs like a normal Mac app, auto-updates, and runs the user's actual macOS login shell (zsh by default) with correct `PATH`/env — not just "Electron happens to boot on a Mac."

### Current state (already cross-platform-ready — do not redo this)

- [src/main/pty/ptySession.ts](../src/main/pty/ptySession.ts) already branches on `process.platform === 'win32'` vs. Unix and falls back to `process.env.SHELL || '/bin/bash'` on macOS/Linux.
- [src/main/index.ts](../src/main/index.ts) `window-all-closed`/`activate` handlers already implement the standard Mac convention (don't quit when all windows close; recreate window on dock-icon activate).
- [src/main/ipc/registerIpcHandlers.ts](../src/main/ipc/registerIpcHandlers.ts) already branches `which`/`where.exe` and `agy`/`agy.exe` by platform.
- Renderer keyboard shortcuts ([useXtermSession.ts](../src/renderer/components/terminal/useXtermSession.ts), [WorkspacePane.tsx](../src/renderer/components/layout/WorkspacePane.tsx)) already check `e.ctrlKey || e.metaKey`, so Cmd-based shortcuts already work on Mac — only the on-screen tooltip labels still hardcode "Ctrl+".

This means the remaining work is almost entirely **packaging, signing, native module builds, and a couple of real macOS-only gotchas** below — not a rewrite of the terminal core.

### Phase A — electron-builder `mac` target

In `package.json` `build`, add a `mac` block alongside the existing `win` block:

```jsonc
"mac": {
  "target": [
    { "target": "dmg", "arch": ["x64", "arm64"] },
    { "target": "zip", "arch": ["x64", "arm64"] } // zip required for electron-updater on macOS
  ],
  "icon": "build/icons/icon.icns",
  "category": "public.app-category.developer-tools",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

Create `build/entitlements.mac.plist` with the entitlements Electron + `node-pty`'s native addon need under the hardened runtime:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
```

### Phase B — icons

[scripts/make-icon.mjs](../scripts/make-icon.mjs) currently only emits `icon.ico`/`icon.png` and hardcodes a Windows source path (`C:/KhangNT-New/logo-super-terminal.jpg`). Fix both:
- Accept the source image path as a CLI arg (or read from a repo-relative `assets/` path) instead of a hardcoded Windows drive path, so the script runs on macOS CI too.
- Add `.icns` generation — either shell out to macOS's `iconutil` (build a `.iconset` folder with the required sizes: 16/32/64/128/256/512, @2x variants, then `iconutil -c icns`), or use a cross-platform npm package (e.g. `png2icons`) so generation doesn't require running on a Mac.

### Phase C — distribution WITHOUT paid Apple Developer signing (v1 decision — do not add code signing/notarization for v1)

**Decision: skip Apple Developer Program ($99/yr) entirely for v1.** Ship an unsigned build and distribute it through **Homebrew Cask**, not a raw `.dmg`/`.zip` download link. This avoids the cost, and it also avoids the bad UX of unsigned direct downloads (macOS quarantines anything downloaded via a browser/`curl`, so opening it manually triggers "App is damaged"/"unidentified developer" and requires the user to right-click → Open or run `xattr -cr` by hand).

Why Homebrew Cask solves this for free: `brew install --cask` fetches the artifact itself (not through the browser's quarantine-tagging download path in the same way) and Homebrew's cask installer strips the quarantine attribute as a normal part of installing an unsigned app, so the app opens cleanly with no Gatekeeper warning — at zero cost.

Concretely:
- electron-builder `mac` target stays unsigned — do **not** set `CSC_LINK`/`CSC_KEY_PASSWORD` or any Apple notarization env vars. `hardenedRuntime`/`entitlements` from Phase A can stay (harmless either way) but signing identity should be left unset so electron-builder produces an ad-hoc/unsigned build.
- Publish the `.zip` (needed for the cask's `zip` stanza) as a GitHub Release asset like today — this doubles as what a possible future electron-updater path would need, so no wasted work if signing is added later.
- Create a Homebrew Cask formula (in the user's own tap repo, e.g. `tkhan2004/homebrew-super-terminal`, since this app won't qualify for homebrew-cask's official repo without code signing) with a `.rb` file like:

```ruby
cask "super-terminal" do
  version "1.0.5"
  sha256 "..."
  url "https://github.com/tkhan2004/super-terminal/releases/download/v#{version}/SuperTerminal-#{version}-mac-arm64.zip"
  name "Super Terminal"
  desc "Desktop control center for AI coding agents"
  homepage "https://github.com/tkhan2004/super-terminal"
  app "Super Terminal.app"
end
```

  (Add a second cask or an `on_arm`/`on_intel` block if shipping separate arm64/x64 zips — see Phase D.)
- Document install as: `brew tap tkhan2004/super-terminal && brew install --cask super-terminal`, mirroring the Windows `irm ... | iex` one-liner in README/HUONG-DAN-CAI-DAT.md.
- `brew upgrade --cask super-terminal` becomes the update path instead of in-app `electron-updater` auto-update on macOS — **do not wire up `autoUpdater.checkForUpdatesAndNotify()` on `darwin`** (gate it to non-mac, or it'll just fail/no-op against unsigned artifacts); Homebrew already handles "check for a new cask version" via `brew outdated`/`brew upgrade`.
- Revisit paid Developer ID signing + notarization + in-app auto-update **only if/when** the user decides the $99/yr is worth it later — treat that as an explicit future upgrade, not part of this plan.

### Phase D — native module (`node-pty`) builds for both Mac architectures

`node-pty` is a native addon; it must be rebuilt/fetched per-arch. Current `build.npmRebuild: false` in `package.json` assumes prebuilt binaries are already present in `node_modules` at package time — verify `node-pty`'s prebuilds cover both `darwin-x64` and `darwin-arm64` for the pinned Electron version, or the packaged app will crash on PTY spawn on whichever arch wasn't rebuilt.
- Safest approach: build two separate CI jobs (one per arch, or use `arch: ['x64','arm64']` with electron-builder's automatic per-arch rebuild via `--publish` on native `macos-latest` runners — Apple Silicon runners are available on GitHub Actions), each running `electron-builder --mac --publish always` for its arch so electron-builder's own native rebuild step targets the right platform.
- Universal (`universal2`) is possible via electron-builder's `arch: ["universal"]` but adds real complexity (needs both arch's native binaries merged with `lipo`) — start with separate `x64`/`arm64` artifacts, revisit universal only if user demand shows up.

### Phase E — CI/CD: extend `.github/workflows/release.yml`

Currently `runs-on: windows-latest` only, single job. Change to a matrix:

```yaml
strategy:
  matrix:
    os: [windows-latest, macos-latest]
runs-on: ${{ matrix.os }}
```

with an OS-conditional package step (`--win` vs `--mac`), and pass through the signing/notarization secrets from Phase C only on the macOS leg. Keep both jobs publishing to the same GitHub release (`--publish always` already does this correctly as long as both jobs target the same tag).

### Phase F — macOS shell/env correctness (real, well-known Electron-on-Mac gotcha)

**This is the part most likely to bite silently:** GUI apps launched from Finder/Dock on macOS do **not** inherit the user's interactive shell `PATH` (no sourcing of `.zprofile`/`.zshrc`/`nvm`/Homebrew's `/opt/homebrew/bin`, etc. — only the minimal `/etc/paths` gets applied by `launchd`). Since `ptySession.ts` spawns using `process.env` directly, commands the user expects to work (their agent CLIs, `nvm`-installed `node`, Homebrew-installed tools) may silently fail to resolve, even though the same command works fine in Terminal.app.

Fix: on macOS only, before spawning any PTY, resolve the user's real login-shell environment once at app startup and merge it into `process.env` — the same fix VS Code and other Electron dev tools ship. Concretely: run `$SHELL -ilc 'echo -n "___ENV___"; env'` once, parse stdout after the delimiter, merge into `process.env` (a small hand-rolled version, or the `fix-path-env`/`shell-env` pattern is fine — evaluate whether to pull a small dependency or inline the ~15 lines). Do this **only** on `darwin` (Windows and Linux-via-terminal already get correct `PATH` when launched).

Also confirm the default-shell fallback: macOS's actual default since Catalina is `zsh`, not `bash`. `resolveShell()` already does `process.env.SHELL || '/bin/bash'` — `SHELL` will correctly be `/bin/zsh` for virtually all real users, so the `/bin/bash` fallback is only a last-resort default; no change strictly required, but consider changing the hardcoded fallback to `/bin/zsh` to match modern macOS defaults more closely.

### Phase G — menu bar / UX conventions

- Electron's default menu is used implicitly today (no `Menu.setApplicationMenu` call found) — on macOS, ship an explicit app menu with the app name as the first menu (About/Preferences/Services/Hide/Quit — `Cmd+Q`) via `Menu.buildFromTemplate` + `Menu.setApplicationMenu`, gated on `process.platform === 'darwin'` so Windows keeps its current (or a Windows-appropriate) menu.
- Cosmetic: swap hardcoded "Ctrl+\\" / "Ctrl+-" tooltip strings in [WorkspacePane.tsx](../src/renderer/components/layout/WorkspacePane.tsx) for a platform-aware label (`⌘` vs `Ctrl`) — the underlying key handling already supports both, this is display-only polish.
- Optional/stretch: `titleBarStyle: 'hiddenInset'` for a native-feeling inset traffic-light window on Mac instead of the current `frame: true` OS-default titlebar. Not required for functionality — evaluate after core packaging works.

### Phase H — install distribution for macOS: Homebrew Cask (primary, v1)

Per the Phase C decision, **Homebrew Cask is the v1 install path**, not a raw `install.sh` download script:
- Create/maintain a tap repo (`tkhan2004/homebrew-super-terminal`) containing the cask `.rb` from Phase C.
- Bump the cask's `version`/`sha256`/`url` on every release — this can be scripted as a step in `.github/workflows/release.yml` (compute sha256 of the published zip, open/update a PR or push directly to the tap repo) so it isn't manual toil per release.
- README/HUONG-DAN-CAI-DAT.md gets a mac section:
  ```
  brew tap tkhan2004/super-terminal
  brew install --cask super-terminal
  ```
  presented alongside the existing Windows `irm ... | iex` block — see the earlier discussion: these are necessarily two different commands (PowerShell vs. Homebrew), there's no single cross-OS one-liner.
- No `install.sh`/`hdiutil` script needed for v1 — only add one later if the user ever wants a non-Homebrew fallback path.

### Suggested sequencing

1. **A + B** (build config + icons) — needed before anything produces a runnable `.app` at all.
2. **D** (native module per-arch) in parallel with A/B — needed before the app can spawn any terminal.
3. **F** (shell/env fix) — do this early too; it's cheap and otherwise silently breaks the core feature (running commands) in a way that's easy to miss if you only test from a terminal-launched dev build (which *does* inherit `PATH` correctly, masking the bug).
4. **E** (CI matrix, unsigned mac build) — no external lead time now that Phase C doesn't require an Apple Developer account; wire this up right after A/B/D are working.
5. **H** (Homebrew Cask tap) — do once CI is reliably publishing zips with stable checksums; then **G** (menu bar / UX polish) as final polish.

### Testing checklist before calling macOS support done

- [ ] Fresh install via `install.sh` on both an Intel Mac (or Rosetta) and Apple Silicon Mac.
- [ ] App launches without Gatekeeper warnings (confirms signing/notarization worked).
- [ ] Open a terminal session, run a command that depends on `PATH` only available via the user's shell profile (e.g. an `nvm`-installed `node`, or a Homebrew binary) — confirms Phase F.
- [ ] Resize terminal pane — confirms PTY resize still works on macOS's `node-pty` build.
- [ ] Git integration panel and file-watcher (chokidar/fsevents) work on a real repo.
- [ ] Cmd-based shortcuts (`Cmd+P`, `Cmd+\`, `Cmd+-`) work exactly like their Ctrl counterparts on Windows.
- [ ] Auto-update: publish a `vX.Y.Z+1` release, confirm the running Mac app detects and installs it (this alone will catch any remaining signing/zip-target misconfiguration).
