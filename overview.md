# AI Terminal Studio

## Overview

AI Terminal Studio is a desktop application that reimagines the experience of working with AI coding agents in the terminal. Instead of replacing the terminal or building another IDE, it provides a modern desktop interface inspired by Codex Desktop while preserving the authenticity and power of native CLI tools such as Claude Code, Codex CLI, Gemini CLI, OpenCode, Amp, and other terminal-based AI agents.

The core philosophy is simple:

> **Keep the real terminal. Improve everything around it.**

Developers increasingly rely on multiple AI agents simultaneously, but today's workflow quickly becomes difficult to manage. Multiple terminal tabs, long scrolling histories, manually typing file paths, switching between sessions, and losing track of running agents create unnecessary friction. AI Terminal Studio addresses these problems without changing how the agents work.

The application acts as a **control center for AI CLI workflows**, providing a clean and intuitive interface while every agent continues to run inside its own real pseudo-terminal (PTY). There is no simulation of terminal output, no custom protocol, and no replacement of existing CLIs.

---

# Vision

Build the best desktop experience for AI-native software development.

Imagine the simplicity of Codex Desktop, the flexibility of a terminal, and the organization of a modern workspace manager—all combined into one application.

AI Terminal Studio should feel like the operating system for AI coding agents rather than another code editor.

---

# Core Design Principles

### Real Terminal First

Every AI agent runs inside a real terminal session.

No fake terminal.

No markdown rendering.

No chat bubbles.

No custom wrappers around agent output.

If Claude Code, Codex CLI, or Gemini CLI works in a terminal today, it should work exactly the same inside AI Terminal Studio.

---

### Codex Desktop Inspired UX

The application adopts the clean interaction model of Codex Desktop:

* Minimal interface
* Large content area
* Dark modern theme
* Keyboard-first navigation
* Native desktop feeling
* Smooth animations
* Distraction-free layout

The interface is optimized for long coding sessions rather than general-purpose chatting.

---

### Workspace-Based Workflow

Instead of opening dozens of terminal tabs, users organize their work into Workspaces.

Each workspace contains:

* Project
* Git repository
* Multiple AI agents
* Terminal sessions
* Context files
* Tasks
* Session history

Everything can be restored after reopening the application.

---

# Key Features

## Multi-Agent Workspace

Run multiple AI coding agents simultaneously.

Example:

* Claude Code — Backend Development
* Codex CLI — Frontend
* Gemini CLI — Code Review
* Bash — Manual Commands
* Docker Logs

Each agent has its own isolated terminal session while remaining part of the same project workspace.

---

## Native Terminal Experience

The center of the application is always a real terminal.

Users interact with AI agents exactly as they would in a native shell.

No output transformation.

No markdown interpretation.

No hidden processing.

---

## Integrated Project Explorer

A built-in file explorer provides quick project navigation.

Instead of manually typing file paths:

```
@src/auth/login.ts
```

Users simply drag files into the prompt area.

The application automatically inserts relative paths or attaches file references depending on user preferences.

This significantly reduces prompt preparation time.

---

## Prompt Builder

A dedicated prompt input supports:

* Drag & drop files
* Multiple attached files
* Quick context insertion
* Prompt history
* Reusable prompt templates

The goal is to eliminate repetitive typing while keeping prompts transparent.

---

## Agent Manager

Manage multiple running AI agents from one place.

Each agent displays:

* Current status
* Running time
* Active workspace
* Terminal state
* Process information

Switching between agents is instant without changing terminal tabs.

---

## Workspace Persistence

Entire development sessions can be restored.

Saved state includes:

* Running agents
* Terminal history
* Working directory
* Window layout
* Pinned files
* Active tasks

Developers can continue exactly where they left off.

---

## Task-Oriented Organization

Instead of organizing work by terminal tabs, AI Terminal Studio organizes work around development tasks.

Example:

```
Implement Authentication

    Claude Code
    Gemini Review

----------------------------

Fix OCR Bug

    Codex CLI
    Bash

----------------------------

Refactor PDF Engine

    Claude Code
    Reviewer
```

This reflects how developers actually work.

---

## Context Management

Frequently used files can be pinned.

Examples:

* README.md
* CLAUDE.md
* AGENTS.md
* ARCHITECTURE.md
* CONTRIBUTING.md

A dedicated context panel makes it easy to understand what information each agent is currently using.

---

## Split Terminal Views

View multiple agents simultaneously.

Example layouts:

* Side by side
* Vertical split
* Grid
* Focus mode

Useful for comparing implementations or monitoring long-running tasks.

---

## Session Timeline

Each agent maintains a structured activity timeline.

Examples:

* Prompt sent
* Files modified
* Commands executed
* Git commits
* Tests started
* Tests completed

This makes long development sessions much easier to navigate than scrolling terminal output.

---

## Git Awareness

The application integrates with Git to display:

* Current branch
* Modified files
* Diff preview
* Commit history
* Branch switching

Without replacing existing Git workflows.

---

# User Interface

The interface follows a simple three-column layout.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Project                                      Search        Settings │
├──────────────┬───────────────────────────────┬──────────────────────┤
│              │                               │                      │
│ Explorer     │                               │ Agents              │
│              │                               │                      │
│ Files        │        Real Terminal          │ Running Sessions    │
│              │                               │                      │
│              │                               │                      │
├──────────────┴───────────────────────────────┴──────────────────────┤
│ Prompt Builder                                              Send    │
└──────────────────────────────────────────────────────────────────────┘
```

The UI is intentionally minimal to maximize focus during development.

---

# Technical Architecture

Frontend

* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Zustand

Desktop

* Electron (preferred for mature PTY support)
* Future evaluation of Tauri

Terminal

* xterm.js
* node-pty

Backend

* Local Node.js process
* PTY manager
* Workspace manager
* File watcher
* Git integration

Everything runs locally.

No cloud dependency.

No vendor lock-in.

---

# Non-Goals

AI Terminal Studio is **not**:

* A replacement for VS Code
* A code editor
* Another AI chatbot
* A wrapper around LLM APIs
* A cloud IDE

Its purpose is to provide the best possible desktop experience for developers who already use AI CLI tools.

---

# Long-Term Vision

AI Terminal Studio aims to become the standard operating environment for AI-assisted software development.

As AI coding agents become the primary interface for programming, developers need better ways to manage multiple agents, contexts, and long-running development sessions.

Rather than reinventing the terminal, AI Terminal Studio embraces it—augmenting it with modern workspace management, intuitive navigation, and a polished desktop experience that feels as natural as today's best native applications.
