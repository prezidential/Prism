# Idem — Claude Code Quickstart

## Setup (one time)

1. Copy this entire config directory into your idem repo root:
   ```bash
   cp CLAUDE.md /path/to/idem/
   cp PLAN.md /path/to/idem/
   cp AGENT-GOALS.md /path/to/idem/
   cp -r .claude/ /path/to/idem/.claude/
   cp -r phases/ /path/to/idem/phases/
   ```

2. Set the project root env var (add to your shell profile):
   ```bash
   export IDEM_PROJECT_ROOT=/path/to/idem
   ```

3. Make hooks executable:
   ```bash
   chmod +x .claude/hooks/pre-tool-use.js
   chmod +x .claude/hooks/stop-hook.js
   ```

4. Verify Claude Code version (need v2.1.139+ for agent view + /goal):
   ```bash
   claude --version
   ```

---

## Starting a Sprint (Your Workflow)

### Option A — Fully Autonomous (walk away)
```bash
cd /path/to/idem
claude -p "[paste /goal condition from AGENT-GOALS.md]"
```
Claude runs until the goal condition passes. Check back later.

### Option B — Review First, Then Autonomous
```bash
cd /path/to/idem
claude
# Inside Claude Code:
/project:sprint
# Review the sprint plan Claude produces
# If it looks good, approve and run:
/goal [condition from AGENT-GOALS.md for this phase]
```

### Option C — Agent Team (for Phase 1 or Phase 3)
```bash
cd /path/to/idem
claude --session-name "idem-phase-1-identograph"
# Inside Claude Code:
# Paste the Lead Agent prompt from phases/phase-1-identograph/CLAUDE.md
```

---

## Checking Status
```bash
# See what's running
claude agents

# Resume a named session
claude --resume idem-phase-1-identograph

# Quick status check
claude -p "/project:status"
```

---

## Your Intervention Points

| Trigger | Your Action |
|---|---|
| Desktop notification: "Agent blocked" | Check `claude agents`, review what it's blocked on, unblock or redirect |
| PR opened by Claude | Review on GitHub, merge or leave comments |
| Agent reports "open questions" | Answer the specific question and `/continue` |
| Phase complete notification | Review PR, approve, kick off next phase |

**Everything else is autonomous.** The hooks, /goal conditions, and subagent scoping
handle the guardrails without your involvement.

---

## If Something Goes Wrong

1. **TypeScript errors:** The Stop hook will keep Claude iterating. If it loops >8 times, it'll ask you.
2. **Demo provisioner touched:** The PreToolUse hook blocks this. Check the hook log.
3. **Wrong branch:** The hook blocks pushes to main. Claude will create a feature branch.
4. **Token budget hit:** Sessions end naturally. Resume with `claude --resume [session-name]`.
5. **Architecture question:** Claude will stop and ask rather than guess (per CLAUDE.md rule).
