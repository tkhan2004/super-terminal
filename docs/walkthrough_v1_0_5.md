# Walkthrough — Release Version 1.0.5

I have successfully prepared, compiled, and deployed the latest codebase as version `1.0.5`!

---

## Action Accomplished

1. **Integrated New Code**: Merged and confirmed the presence of the newest commits (`fix(pty): wrap write/resize` and `feat(mac): macOS support`) on the active `main` branch.
2. **Version Bump**: Bumped the application version in [package.json](file:///C:/KhangNT-New/super-terminal/package.json) to `1.0.5`.
3. **Verification**: Checked TypeScript compiling using `npx tsc --noEmit` and Vite production bundling using `npx electron-vite build`. Both passed without any errors.
4. **Git Deploy**:
   - Committed the changes on `main`.
   - Pushed the `main` branch to the remote GitHub repository.
   - Tagged the commit as `v1.0.5` and pushed the tag to `origin`.

---

## What Happens Next

- **CI/CD Execution**: The tag push has automatically triggered the `Build and Release` workflow under the GitHub Actions runner.
- **Auto-Publish**: Once the build completes on GitHub (in about 2-4 minutes), it will be automatically published as a **public release** under version `1.0.5` (due to the `releaseType: release` configuration we set up previously).
- **Auto-Update**: Existing users running the application will automatically receive an update prompt in the background once the build is published, allowing them to upgrade with one click.
- **One-Command Installation**: Remote users can run the PowerShell installation command to get the newest `1.0.5` version instantly.
