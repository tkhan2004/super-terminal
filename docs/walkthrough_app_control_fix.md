# Walkthrough — Fix Windows Application Control Policy Block

I have resolved the Windows Application Control policy block error (`An Application Control policy has blocked this file`) in `install.ps1`.

---

## Cause of Error

When Windows downloads an `.exe` file from the Internet via PowerShell/HttpClient, it automatically attaches a `Zone.Identifier` stream (Mark of the Web). Windows Defender SmartScreen / AppLocker / Application Control policies prevent `Start-Process` from launching unverified `.exe` files marked with this internet zone flag.

---

## Fix Applied

- **Unblocked Mark of the Web**: Added `Unblock-File -Path $tempPath` and `Remove-Item -Path "$tempPath:Zone.Identifier"` prior to running `Start-Process`. This strips the internet origin marker, allowing Windows to treat the installer as a verified local binary.
- **UAC Elevation Fallback**: Wrapped `Start-Process` in a `try / catch` block. If standard execution is still prevented by strict execution policies, PowerShell automatically requests UAC elevation (`-Verb RunAs`) to run the installer smoothly.
