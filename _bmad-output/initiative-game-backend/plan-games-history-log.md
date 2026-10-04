---
title: 'Per-game log file in games-history/'
type: 'feature'
ticket: ''
created: '2026-10-04'
status: 'built'
baseline_revision: '25bda093b4ddb58d221df9cbd9fa4705066ea6d9'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-backend/plan-npc-iteration-2.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A game's log exists only in the terminal, so a finished game can't be analysed later, for example to see which ads end in traps.

**Approach:** Besides the terminal (live panel unchanged), the NPC writes each game's log to a plain-text file in a gitignored `games-history/` directory, relative to the working directory, i.e. `backend/games-history/` when run from `backend/`. There is one file per game, named `<start time yyyy-MM-dd_HH-mm-ss>-<gameId>.txt` in local time. The file duplicates the log in plain form: a header with the game id and start time, the starting status line, every turn entry followed by its plain status line, and the summary at the end. It contains no ANSI codes and no pause-toggle lines. Every write is flushed, so a crash keeps what was written. If the file can't be created, the terminal shows one warning and the game plays on without a file.

</frozen-after-approval>

## Implementation Notes

Oneshot: the change is about 100 lines across `Terminal`, `NpcRunner`, `backend/.gitignore` and tests.

- `Terminal` owns the history file. It gains `startHistory(gameId)`, and production uses `games-history/` plus the system clock; the two-argument test constructor turns history off. Turn entries and the summary are copied to the file. Toggle-only redraws are not.
- The file's status line is the stats line with ` | ` separators and no pause-state text, so it stays clean for analysis.
- `NpcRunner` calls `startHistory(gameId)` right after the start status, so the header is followed by the starting stats.
- `backend/.gitignore` gains `games-history/`. The working directory is `backend/` when run as documented.
- Tests in `TerminalTest`: the file's exact content under a fixed clock (toggles left out, ANSI still on the terminal), no file when history is off, and a single warning when the directory can't be created.

## Review Triage Log

**Pass 1 (quick):** low 3

- low, patch: `startHistory` built the file path outside the `try`, so an id the OS rejects as a filename threw past the warning and ended the game. The path is now built inside the `try`, and the warning builds its text without `resolve`.
- low, patch: the warning printed `e.getMessage()`, which can be null or just the path. It now prints the exception itself, so the type and reason show.
- low, rejected: `noHistoryDirMeansNoFile` can't catch the two-argument constructor wrongly writing to `games-history/`. Real, but closing that hole needs a filesystem check against the working directory, which goes stale once the app runs from `backend/`. Production wiring is already pinned by `historyFileDuplicatesTheLogInPlainForm`.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.
