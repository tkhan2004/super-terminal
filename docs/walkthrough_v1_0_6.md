# Walkthrough — Release Version 1.0.6

I have resolved the `pnpm install` workspace error, created the macOS remote installer script, updated the README documentation, and successfully deployed version `1.0.6`!

---

## Action Accomplished

1. **Fixed `pnpm` Workspace Error**:
   - **File**: [pnpm-workspace.yaml](file:///C:/KhangNT-New/super-terminal/pnpm-workspace.yaml)
   - **Reason for Failure**: The file was missing the mandatory `packages` array configuration, which caused newer versions of `pnpm` (like the one used in the GitHub Actions runner) to fail with `packages field missing or empty`.
   - **Fix**: Added the `packages` list pointing to the root directory (`.`) so that it is parsed as a valid workspace while retaining the `allowBuilds` security settings.
2. **Created macOS Installer**:
   - **File**: [install.sh](file:///C:/KhangNT-New/super-terminal/install.sh)
   - **Features**: Automatically detects the macOS architecture (`arm64` vs `x64`), downloads the corresponding `.dmg` file from the latest public GitHub release, mounts it, copies `Super Terminal.app` to `/Applications`, and cleans up temp files.
3. **Updated Documentation**:
   - **File**: [README.md](file:///C:/KhangNT-New/super-terminal/README.md)
   - **Features**: Split the installation instructions into explicit **Windows (PowerShell)** and **macOS (Terminal)** command sections.
4. **Git Deploy**:
   - Committed and pushed `main` branch to the remote repository.
   - Tagged as `v1.0.6` and pushed to `origin`, triggering the CI/CD pipeline on GitHub Actions.
