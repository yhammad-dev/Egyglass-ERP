#!/usr/bin/env python3
"""
EgyGlass ERP - governance enforcement hook (PreToolUse).

This is the ONLY HARD control in the setup.

Rules written in CLAUDE.md, AGENTS.md or .claude/rules/ are INSTRUCTIONS - a model can
misread them, rationalise around them, or simply not load them. This file is a CONTROL -
it physically blocks the tool call.

Why it matters: subagents spawned inside a dynamic workflow always run in `acceptEdits`
mode, so their file edits are auto-approved regardless of your session's permission mode.
A PreToolUse hook that exits 2 fires BEFORE the permission-mode check and blocks the call
even under bypassPermissions. Hooks can tighten. They cannot be loosened.

Exit codes:
  0 = no objection (the normal permission flow still applies)
  2 = BLOCK. stderr is returned to the agent as feedback.

Prove the control before trusting it:
  python .claude/hooks/protect.py --selftest
"""

import json
import sys

# ---------------------------------------------------------------------------
# CONFIG - verify these paths against your real repo before trusting them.
# ---------------------------------------------------------------------------

# Files no agent may ever create, edit or overwrite.
PROTECTED_PATHS = [
    "prisma/schema.prisma",
    "prisma/migrations/",
    ".env",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".claude/settings.json",
    ".claude/hooks/",
    ".claude/security-patterns.yaml",
    ".claude/claude-security-guidance.md",
    ".claude/rules/",
]

# Shell commands reserved to the human operator.
BLOCKED_COMMANDS = [
    "git commit",
    "git push",
    "git tag",
    "git reset --hard",
    "prisma migrate",
    "prisma db push",
    "docker compose down -v",
    "docker-compose down -v",
    "docker volume rm",
    "docker volume prune",
]

# Write-SQL executed outside a server action = Law L-04 violation.
WRITE_SQL = ["insert ", "update ", "delete ", "drop ", "alter ", "truncate ", "grant "]

WRITE_TOOLS = ("Edit", "Write", "NotebookEdit", "MultiEdit")

# ---------------------------------------------------------------------------

SCHEMA_MSG = (
    "BLOCKED by governance hook: '{path}'.\n"
    "The Prisma schema, migrations, secrets and agent configuration are changed by the "
    "human operator ONLY (Law L-02 / L-03).\n"
    "Required action: write a Schema Change Request (SCR) into BACKLOG.md - model, field, "
    "type, nullability, reason, blast radius, migration safety - and STOP.\n"
    "Do NOT attempt an alternative route to the same change."
)

CMD_MSG = (
    "BLOCKED by governance hook: '{cmd}'.\n"
    "Commits, tags, pushes, migrations and volume deletion are reserved to the human "
    "operator (Law L-03).\n"
    "Required action: stage nothing, report what you changed with evidence, and STOP."
)

SQL_MSG = (
    "BLOCKED by governance hook: direct write-SQL.\n"
    "Law L-04: no direct database writes. Every mutation goes through a server action "
    "that enforces role, scope and audit.\n"
    "'Just to unblock myself' is exactly the case this law exists to prevent."
)

FAILSAFE_MSG = (
    "BLOCKED by governance hook (fail-safe).\n"
    "The hook could not parse the tool event, but the raw payload references a protected "
    "resource: '{hit}'.\n"
    "A governance control does not fail open. Report this to the human operator."
)


def norm(text) -> str:
    """Lowercase and normalise separators so Windows paths match too."""
    return (text or "").replace("\\", "/").lower()


def decide(data):
    """Return (exit_code, message) for a parsed hook event."""
    tool = data.get("tool_name", "")
    tool_input = data.get("tool_input") or {}

    # --- File writes -------------------------------------------------------
    if tool in WRITE_TOOLS:
        path = norm(tool_input.get("file_path", ""))
        for pattern in PROTECTED_PATHS:
            if norm(pattern) in path:
                return 2, SCHEMA_MSG.format(path=path)

    # --- Shell commands ----------------------------------------------------
    if tool == "Bash":
        cmd = norm(tool_input.get("command", ""))

        for blocked in BLOCKED_COMMANDS:
            if norm(blocked) in cmd:
                return 2, CMD_MSG.format(cmd=blocked)

        # Write-SQL through any client (psql, prisma db execute, ...)
        if ("psql" in cmd or "db execute" in cmd) and any(s in cmd for s in WRITE_SQL):
            return 2, SQL_MSG

        # A shell redirect into a protected file bypasses the Edit tool entirely.
        if ">" in cmd:
            for pattern in PROTECTED_PATHS:
                if norm(pattern) in cmd:
                    return 2, SCHEMA_MSG.format(path=pattern)

    return 0, ""


def main():
    raw = sys.stdin.read()

    try:
        data = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        # FAIL-SAFE, not fail-open. The event cannot be parsed, so it cannot be decided
        # precisely - but the raw payload is still scanned for protected resources.
        blob = norm(raw)
        for pattern in PROTECTED_PATHS + BLOCKED_COMMANDS:
            if norm(pattern) in blob:
                print(FAILSAFE_MSG.format(hit=pattern), file=sys.stderr)
                return 2
        print("[protect.py] WARNING: unparseable hook input (%s). "
              "No protected resource referenced; allowing." % exc, file=sys.stderr)
        return 0

    code, message = decide(data)
    if code == 2:
        print(message, file=sys.stderr)
    return code


# ---------------------------------------------------------------------------
# Self-test - prove the control works:  python protect.py --selftest
# ---------------------------------------------------------------------------

SELFTEST_CASES = [
    ("edit prisma/schema.prisma (Windows path)",
     {"tool_name": "Edit", "tool_input": {"file_path": "E:\\Projects\\EgyGlass\\prisma\\schema.prisma"}}, 2),
    ("write a migration file",
     {"tool_name": "Write", "tool_input": {"file_path": "prisma/migrations/021_x/migration.sql"}}, 2),
    ("edit .env",
     {"tool_name": "Edit", "tool_input": {"file_path": "./.env"}}, 2),
    ("edit docker-compose.yml",
     {"tool_name": "Edit", "tool_input": {"file_path": "docker-compose.yml"}}, 2),
    ("edit the hook itself",
     {"tool_name": "Edit", "tool_input": {"file_path": ".claude/hooks/protect.py"}}, 2),
    ("edit the laws",
     {"tool_name": "Edit", "tool_input": {"file_path": ".claude/rules/00-laws.md"}}, 2),
    ("git commit",
     {"tool_name": "Bash", "tool_input": {"command": "git commit -m 'fix'"}}, 2),
    ("git push",
     {"tool_name": "Bash", "tool_input": {"command": "git push origin master"}}, 2),
    ("prisma migrate dev",
     {"tool_name": "Bash", "tool_input": {"command": "npx prisma migrate dev --name x"}}, 2),
    ("docker compose down -v",
     {"tool_name": "Bash", "tool_input": {"command": "docker compose down -v"}}, 2),
    ("psql UPDATE",
     {"tool_name": "Bash", "tool_input": {"command": "docker compose exec db psql -c \"UPDATE users SET role='ADMIN'\""}}, 2),
    ("shell redirect into schema",
     {"tool_name": "Bash", "tool_input": {"command": "cat tmp > prisma/schema.prisma"}}, 2),
    ("edit a server action           [ALLOW]",
     {"tool_name": "Edit", "tool_input": {"file_path": "src/lib/actions/discount.ts"}}, 0),
    ("read-only psql SELECT          [ALLOW]",
     {"tool_name": "Bash", "tool_input": {"command": "docker compose exec db psql -c \"SELECT count(*) FROM users\""}}, 0),
    ("production build               [ALLOW]",
     {"tool_name": "Bash", "tool_input": {"command": "docker compose exec -e NODE_ENV=production app npm run build"}}, 0),
    ("git status                     [ALLOW]",
     {"tool_name": "Bash", "tool_input": {"command": "git status --porcelain"}}, 0),
]


def selftest():
    failures = 0
    print("protect.py self-test")
    print("-" * 62)
    for label, event, expected in SELFTEST_CASES:
        actual, _ = decide(event)
        ok = actual == expected
        if not ok:
            failures += 1
        print("[%s] %-5s  %s" % ("PASS" if ok else "FAIL",
                                 "BLOCK" if expected == 2 else "allow",
                                 label))
    print("-" * 62)
    if failures:
        print("%d FAILURE(S). The control is NOT trustworthy. Do not proceed." % failures)
        return 1
    print("All %d cases passed. The control is enforcing." % len(SELFTEST_CASES))
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    sys.exit(main())
