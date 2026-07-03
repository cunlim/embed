# Move Run-All-Checks to Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `run-all-checks.sh` and its `test-results` from `.claude/hooks/` to `./scripts/`, avoiding absolute paths, and update Claude Code and agy configurations accordingly.

**Architecture:** Use relative path execution. Claude Code and `agy` will call `scripts/run-all-checks.sh` which works relatively to the project root.

**Tech Stack:** Bash, JSON config

## Global Constraints

- No absolute paths for project-relative locations in hooks or commands.
- Retain exact execution patterns for hooks on both platforms.

---

### Task 1: Move Files
**Files:**
- Move: `.claude/hooks/run-all-checks.sh` -> `scripts/run-all-checks.sh`
- Move: `.claude/hooks/test-results/` -> `scripts/test-results/`

- [ ] **Step 1: Move `run-all-checks.sh` using git mv**
  Run: `git mv .claude/hooks/run-all-checks.sh scripts/run-all-checks.sh`
- [ ] **Step 2: Move `test-results` directory**
  Run: `git mv .claude/hooks/test-results scripts/test-results`
- [ ] **Step 3: Verify the file relocation**
  Run: `git status`
  Expected: Rename changes are staged for both files/directories.

### Task 2: Update Claude Code configuration
**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1: Modify hook path in `.claude/settings.json`**
  Modify `.claude/settings.json` to change the hook path to `scripts/run-all-checks.sh`.
- [ ] **Step 2: Verify Claude settings change**
  Run: `git diff .claude/settings.json`
  Expected: `"command": ".claude/hooks/run-all-checks.sh"` becomes `"command": "scripts/run-all-checks.sh"`.

### Task 3: Configure Antigravity (`agy`) hooks
**Files:**
- Create: `.agents/hooks.json`

- [ ] **Step 1: Create `.agents/hooks.json` with relative path**
  Write relative path execution rule for `Stop` hook invoking `scripts/run-all-checks.sh`.
- [ ] **Step 2: Verify that hooks.json has no absolute paths**
  Review `.agents/hooks.json` content.

### Task 4: Clean up and Verify
**Files:**
- Verify execution of scripts/run-all-checks.sh

- [ ] **Step 1: Run the checks script to verify it outputs correctly**
  Run: `bash scripts/run-all-checks.sh --terminal`
  Expected: Verification checks run successfully and log output goes to `scripts/test-results/`
- [ ] **Step 2: Check status of untracked test-results files**
  Run: `git status`
- [ ] **Step 3: Commit changes**
  Run: `git add .` and commit the modifications.
