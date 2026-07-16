# Implementation Plan — Release Version 1.0.5

This plan details the steps to publish the latest changes (including macOS support and pty crash fixes) as a new release `v1.0.5` on GitHub.

---

## Goal Description
We want to deploy the latest code updates (`fix(pty): wrap write/resize` and `feat(mac): macOS support`) to the public release repository. Since tag `v1.0.4` has already been pushed, we will bump the project version to `1.0.5` and tag it to trigger the automated CI/CD workflow.

---

## Proposed Changes

### Version Bump

#### [MODIFY] [package.json](file:///C:/KhangNT-New/super-terminal/package.json)
Bump version from `1.0.4` to `1.0.5`:
```json
  "name": "super-terminal",
  "version": "1.0.5",
```

---

## Verification Plan

### Manual Verification
1. Bump version and check syntax using `pnpm typecheck`.
2. Commit the bump.
3. Push branch `main` to `origin`.
4. Create and push tag `v1.0.5`.
5. Verify on GitHub Actions that a new workflow run is successfully triggered for `v1.0.5`.
