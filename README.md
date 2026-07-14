<div align="center">

<img src="build/icons/icon.png" alt="Super Terminal logo" width="128" height="128" />

# ⚡ Super Terminal

**The operating system for AI coding agents.**

*Keep the real terminal. Improve everything around it.*

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#-download)
[![Built with Electron](https://img.shields.io/badge/Electron-31-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/license-Private-lightgrey?style=for-the-badge)](#)

[📥 Download](#-download) · [✨ Features](#-features) · [🖥️ Preview](#️-preview) · [🛠️ Tech Stack](#️-tech-stack) · [🚀 Dev Setup](#-dev-setup)

</div>

---

## 🧠 What is this?

**Super Terminal** is a desktop control center for AI coding agents — Claude Code, Codex CLI, Gemini CLI, OpenCode, Amp, and any other terminal-based agent you throw at it.

It doesn't reinvent the terminal. It doesn't wrap your agent in a chat bubble. It doesn't pretend to be an IDE. Every agent still runs in a real, native PTY — exactly as if you typed the command yourself. What Super Terminal adds is everything *around* that: workspaces, multi-agent orchestration, session persistence, git awareness, and a UI built for people who run five agents at once and refuse to lose track of any of them.

> If it works in a terminal today, it works exactly the same inside Super Terminal.

---

## 📥 Download

> **Windows builds are available here:**
>
> ### 👉 [**Download from Google Drive**](https://drive.google.com/drive/folders/1r-fQIdP42z8xPwlzxwoDH2lGLsgTjHuB?usp=drive_link)

The folder contains:
- `Super Terminal Setup x.x.x.exe` — full installer (recommended)
- `SuperTerminal-x.x.x-portable.exe` — no install, just run
- `HUONG-DAN-CAI-DAT.md` — installation & usage guide (incl. Windows SmartScreen / Smart App Control notes)

> ⚠️ The app isn't code-signed yet, so Windows may flag it as "unrecognized" on first run (SmartScreen / Smart App Control). This is expected for an indie/open build — see the guide in the Drive folder for how to proceed safely.

---

## ✨ Features

| | |
|---|---|
| 🧩 **Multi-Agent Workspace** | Run Claude Code, Codex CLI, Gemini CLI, and plain shells side by side, each in its own isolated PTY, all under one workspace. |
| 💻 **Real Terminal, Always** | No output rewriting, no markdown rendering, no fake shell. What you see is `xterm.js` + `node-pty`, unfiltered. |
| 📁 **Integrated Project Explorer** | Drag files straight into your prompt instead of typing `@src/auth/login.ts` by hand. |
| ✍️ **Prompt Builder** | Multi-file attachments, prompt history, and reusable templates for prompts you write 50 times a day. |
| 🕹️ **Agent Manager** | See every running agent's status, uptime, and workspace at a glance — switch instantly, no tab hunting. |
| 💾 **Workspace Persistence** | Close the app, reopen it later, and every session, layout, and pinned file is exactly where you left it. |
| ✅ **Task-Oriented Organization** | Group agents by *what you're building*, not by which tab they happen to live in. |
| 📌 **Context Management** | Pin `README.md`, `CLAUDE.md`, `AGENTS.md` — know exactly what context every agent is working with. |
| 🔲 **Split Terminal Views** | Side-by-side, grid, or focus mode — compare two agents' output without alt-tabbing. |
| 🕓 **Session Timeline** | A structured log of prompts, file edits, commands, and commits — way easier to scan than raw scrollback. |
| 🌿 **Git Awareness** | Branch, diff preview, and commit history, built in — without replacing your existing git workflow. |

---

## 🖥️ Preview

<div align="center">

![Super Terminal screenshot](https://github.com/user-attachments/assets/8b7be313-d993-4a6d-a0d4-84c1393f97c0)

</div>

Minimal by design. Built for long sessions, not demos.

---

## 🛠️ Tech Stack

```
Frontend    React · TypeScript · Tailwind CSS · Zustand
Desktop     Electron
Terminal    xterm.js · node-pty
Backend     Local Node.js process · PTY manager · workspace manager · file watcher · git integration
```

Everything runs **100% locally**. No cloud dependency, no vendor lock-in, no telemetry phoning home.

---

## 🚫 Non-Goals

Super Terminal is deliberately **not**:

- A VS Code replacement
- A code editor
- Another AI chatbot
- A wrapper around LLM APIs
- A cloud IDE

It exists to make the terminal-based agent workflow you already use *better*, not to replace it.

---

## 🚀 Dev Setup

```bash
pnpm install
pnpm dev          # run in development
pnpm build        # production build
pnpm package      # build Windows installer + portable exe
```

Requires Node.js 20+ and pnpm. Native module (`node-pty`) rebuilds automatically for your platform on install.

---

<div align="center">

**Built for developers who run more than one AI agent and refuse to lose track of any of them.**

</div>
