# Implementation Plan — Fix Copy-Paste, Zoom, and Split Shortcuts

This plan addresses the 3 issues reported by the user:
1. **Duplicate Paste**: Pasted text gets duplicated in the terminal when pressing `Ctrl+V` or `Ctrl+Shift+V`.
2. **Zoom Out Conflict**: Zooming out (`Ctrl+-`) does not work. This is caused by `Ctrl+-` being intercepted by the app's split-pane shortcut, and `xterm.js` intercepting control characters.
3. **Close Split Shortcut**: There is no keyboard shortcut to close the currently active split pane.

---

## Proposed Changes

### 1. Fix xterm.js Keyboard Interception & Duplicate Paste

#### [MODIFY] [useXtermSession.ts](file:///C:/KhangNT-New/super-terminal/src/renderer/components/terminal/useXtermSession.ts)
Update the custom key event handler in `attachCustomKeyEventHandler`:
- Let `xterm.js` natively handle paste events to prevent duplicate writes to the stream.
- Intercept zoom shortcuts (`Ctrl` + `+`/`=`/`-`/`0`) and return `false` so they bubble up to the Electron window instead of being captured as terminal characters.
- Intercept pane split and pane close shortcuts (`Ctrl+\`, `Ctrl+Shift+-`, `Ctrl+Shift+W`, `Ctrl+Shift+Q`, `Ctrl+P`) and return `false` to bubble them up to the global layout handler.

```diff
-      // Paste: Ctrl+V or Ctrl+Shift+V
-      if ((isCtrl && key === 'v') || (isCtrl && isShift && key === 'v')) {
-        navigator.clipboard.readText().then((text) => {
-          terminal.paste(text)
-        })
-        return false
-      }
+      // Paste: Ctrl+V or Ctrl+Shift+V (let xterm.js natively handle it to avoid duplication)
+      if ((isCtrl && key === 'v') || (isCtrl && isShift && key === 'v')) {
+        return true
+      }
+
+      // Bubble zoom shortcuts up to Electron/browser (don't let xterm swallow them)
+      if (isCtrl && (key === '+' || key === '-' || key === '=' || key === '_' || key === '0')) {
+        return false
+      }
+
+      // Bubble split shortcuts up to WorkspacePane (don't let xterm swallow them)
+      if (isCtrl && (key === '\\' || (isShift && (key === '-' || key === '_')))) {
+        return false
+      }
+
+      // Bubble close pane/tab shortcuts up to WorkspacePane
+      if (isCtrl && isShift && (key === 'w' || key === 'q')) {
+        return false
+      }
+
+      // Bubble Command Palette shortcut up to WorkspacePane
+      if (isCtrl && key === 'p') {
+        return false
+      }
```

---

### 2. Update Layout Shortcuts and Tooltips

#### [MODIFY] [WorkspacePane.tsx](file:///C:/KhangNT-New/super-terminal/src/renderer/components/layout/WorkspacePane.tsx)
- Re-map horizontal split shortcut from `Ctrl + -` to `Ctrl + Shift + -` (or `Ctrl + Shift + _`) to free up `Ctrl + -` for standard zoom-out.
- Add `Ctrl + Shift + W` and `Ctrl + Shift + Q` (along with macOS `Cmd + Shift + W`/`Q` equivalents) to close the active split pane.
- Update tooltip titles to document the new shortcuts.

```diff
-      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
-        e.preventDefault()
-        handleSplit('horizontal')
-      }
+      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '-' || e.key === '_')) {
+        e.preventDefault()
+        handleSplit('horizontal')
+      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'q')) {
+        e.preventDefault()
+        if (activeTabId) {
+          closeTabOrPane(activeTabId, false)
+        }
+      }
```

AndUpdate tooltip in render block:
```diff
-              title={isMac ? "Split pane horizontally (⌘-)" : "Split pane horizontally (Ctrl+-)"}
+              title={isMac ? "Split pane horizontally (⌘Shift-)" : "Split pane horizontally (Ctrl+Shift+-)"}
```

---

## Verification Plan

### Manual Verification
1. Open the terminal and press `Ctrl+V` (or `Cmd+V`) to paste text. Confirm it pastes exactly once without duplication.
2. Press `Ctrl++` (or `Cmd++`) and `Ctrl+-` (or `Cmd+-`). Verify that the window zooms in and zooms out smoothly.
3. Focused inside a terminal split, press `Ctrl+\` (or `Cmd+\`). Verify that it splits vertically.
4. Pressed inside a terminal split, press `Ctrl+Shift+-` (or `Cmd+Shift+-`). Verify that it splits horizontally.
5. Pressed inside a terminal split, press `Ctrl+Shift+W` (or `Cmd+Shift+W`). Verify that it closes the current focused split pane.
