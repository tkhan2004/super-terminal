---
name: git-commit
description: Create high-quality Git commits following the project's commit conventions.
---

# Git Commit Skill

When asked to commit changes, follow these rules.

## 1. Inspect changes first

Before creating a commit:

- Review `git diff`
- Review `git status`
- Understand WHY each file changed
- Never guess the purpose

---

## 2. Keep commits focused

One commit should represent one logical change.

Good:

- Add verification pipeline
- Fix retry bug
- Refactor plugin loader

Bad:

- Fix bugs + Refactor + Documentation

---

## 3. Use Conventional Commits

Format:

<type>(optional-scope): <summary>

Examples:

feat(verifier): add L2 tools validation

fix(agent): handle Claude CLI timeout

refactor(plugin): simplify FastAPI analyzer

docs(readme): update installation guide

test(verifier): add retry unit tests

chore(ci): update GitHub workflow

Supported types:

- feat
- fix
- refactor
- docs
- test
- chore
- perf
- build
- ci

---

## 4. Write meaningful summaries

Summary rules:

- imperative mood
- lowercase
- under 72 characters
- no period
- describe intent, not implementation

Good:

feat(checkpoint): support pipeline resume

Bad:

feat: updated files

---

## 5. Optional body

Add a body only when useful.

Explain:

- why
- important design decisions
- breaking changes

Do not repeat the summary.

---

## 6. Before committing

Verify:

- No debug code
- No commented-out code
- No temporary logs
- No secrets or API keys
- No unrelated files

---

## 7. If uncertain

Do NOT commit immediately.

Instead:

- summarize the changes
- propose a commit message
- ask for confirmation

---

## 8. Never

Never:

- commit generated build artifacts unless required
- commit secrets
- create meaningless commit messages
- combine unrelated changes into one commit
