# Walkthrough — Release Version 1.0.7

I have successfully resolved the onboarding wizard popup duplicate trigger bug, fixed copy-paste text duplication, enabled window zoom-out (`Ctrl + -`), added the close-split shortcut (`Ctrl + Shift + W`), and deployed the package as version `1.0.7`!

---

## Action Accomplished

1. **Fixed Onboarding Setup Wizard Duplicate Triggers**:
   - **File**: [WorkspacePane.tsx](file:///C:/KhangNT-New/super-terminal/src/renderer/components/layout/WorkspacePane.tsx)
   - **Reason for Failure**: Because the app renders multiple `<WorkspacePane>` instances concurrently for open workspaces (keeping the active one visible and others hidden), they all mounted and triggered the onboarding wizard at the exact same moment on startup.
   - **Fix**: Added a check `if (!isActive) return` in the onboarding `useEffect`, ensuring only the active/focused workspace pane registers and triggers the wizard popup.
2. **Fixed Duplicate Paste**:
   - **File**: [useXtermSession.ts](file:///C:/KhangNT-New/super-terminal/src/renderer/components/terminal/useXtermSession.ts)
   - **Fix**: Removed the manual clipboard read-and-write handler for `Ctrl+V` and let `xterm.js` natively handle clipboard paste events. This eliminates duplicate pasted text.
3. **Fixed Window Zoom-out & Key Swallowing**:
   - **Files**: [WorkspacePane.tsx](file:///C:/KhangNT-New/super-terminal/src/renderer/components/layout/WorkspacePane.tsx), [useXtermSession.ts](file:///C:/KhangNT-New/super-terminal/src/renderer/components/terminal/useXtermSession.ts)
   - **Fix**:
     - Released the `Ctrl + -` key combination by re-mapping the horizontal split shortcut to `Ctrl + Shift + -` (or `Ctrl + Shift + _`).
     - Configured the custom terminal key handler to let zoom keys (`+`, `-`, `=`, `0`) bubble up to the browser/Electron process instead of being swallowed.
     - Updated tooltips to show the correct new shortcut `Ctrl+Shift+-` (`⌘Shift-` on macOS).
4. **Added Close Split Shortcut**:
   - **Files**: [WorkspacePane.tsx](file:///C:/KhangNT-New/super-terminal/src/renderer/components/layout/WorkspacePane.tsx), [useXtermSession.ts](file:///C:/KhangNT-New/super-terminal/src/renderer/components/terminal/useXtermSession.ts)
   - **Fix**: Gained support for `Ctrl + Shift + W` and `Ctrl + Shift + Q` (`⌘ + Shift + W / Q` on macOS) to instantly close the active split pane.
5. **Git Deploy**:
   - Pushed `main` branch to remote origin.
   - Tagged as `v1.0.7` and pushed to remote origin, triggering the GitHub Actions CI/CD auto-publish run.
