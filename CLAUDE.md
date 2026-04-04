# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Project Overview

**Prism** is a project in its initial/bootstrapping phase. The repository currently contains only a README. All architectural decisions, tooling choices, and conventions are yet to be established.

## Repository State

- **Status:** Empty / pre-implementation
- **Main branch:** `main`
- **Remote:** `prezidential/Prism` (GitHub)

## Development Branch Convention

Feature and task branches follow the pattern:
```
<tool>/<description>-<id>
```
Example: `claude/add-claude-documentation-HYxNJ`

Always develop on the designated branch and push with:
```bash
git push -u origin <branch-name>
```

## Git Workflow

1. Create or switch to the task branch
2. Make changes with focused, descriptive commits
3. Push to the remote branch when complete
4. Open a PR only when explicitly requested

### Commit Message Style

Use concise imperative sentences:
```
Add initial project structure
Fix authentication token refresh logic
Update README with setup instructions
```

Avoid vague messages like "fix stuff" or "WIP".

## Working in This Repo

Since no implementation exists yet, the first meaningful contributions will likely involve:

- Defining the tech stack and project structure
- Adding dependency management (`package.json`, `pyproject.toml`, etc.)
- Setting up linting, formatting, and testing tooling
- Establishing the source directory layout (`src/`, `lib/`, etc.)

When those decisions are made, update this file to document:
- Build commands
- Test commands
- Code style conventions
- Architecture overview
- Environment variable requirements

## Updating This File

Keep CLAUDE.md current as the project evolves. After any significant change to tooling, structure, or conventions, update the relevant section here. This file is the primary reference for AI assistants onboarding to this codebase.
