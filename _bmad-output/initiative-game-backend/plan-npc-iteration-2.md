---
title: 'NPC iteration 2: no request cap, Enter to pause, live status panel, most-levels item'
type: 'feature'
ticket: ''
created: '2026-10-04'
status: 'built'
baseline_revision: 'ab2811d8513c7e31f8a788090760d4d9cd73b562'
route: 'full'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-backend/plan-autonomous-game-bot.md'
  - '{project-root}/_bmad-output/shared-mugloar-game/api-contract.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The NPC stops at 300 requests to ask y/N, so an unattended game can't run to the end. Its one-line log entries make lives, level and gold hard to follow as they change. On a hard board it buys the cheapest level item even when it has lives to spare.

**Approach:** Remove the request budget, so one game plays until it ends, and let the user pause and resume at any time by pressing Enter. Replace the per-line status suffix with a live status panel at the bottom of the terminal, redrawn in place, while the turn entries (action, flavour text, changes) scroll above it. When lives are above 2, a hard board buys the item that gives the most levels.

## Decisions

- **No cap:** one game, no request budget, no checkpoint prompt. The run still ends at game over, no playable move, expiry or an error, with the summary. Pacing (≥ 500 ms between request starts) and the messages-only retries stay.
- **Pause:** Enter toggles pause and resume, which needs no raw terminal mode. A pause takes effect between turns, after the current action finishes; no requests are sent while paused. EOF on stdin turns the control off, and play continues.
- **Status panel:** pinned below the log and redrawn in place with ANSI codes. It shows turn, lives, level, gold and score in fixed positions, plus a state line: `▶ running · Enter = pause`, or `⏸ paused · Enter = resume`. While paused, it adds a warning that an idle game may expire after a few minutes [U].
- **Turn entry:** mark, kind and action on the first line, then the flavour text indented below it (solves only), then the non-zero gold and lives changes indented on their own line.
- **Level item:** a hard board means every ad with a known label is Risky or Deadly, i.e. win rate 40% or lower. On a hard board with lives above 2, buy the affordable level item with the most levels (ties: cheaper first, then shop order). At lives ≤ 2, it stays the cheapest.

## Boundaries & Constraints

**Always:**
- Keep iteration 1's layers and rules (see that plan's Boundaries): `game/` stays Spring-free, `api/` is the only HTTP caller, and tests never hit the live API or sleep for real.
- Use ANSI only when stdout is a terminal (`System.console()` is non-null and `isTerminal()`). Otherwise print plain text: each turn entry followed by one plain status line. The output must never contain escape codes when redirected.
- Each Enter the user presses echoes a newline that moves the cursor. The panel redraw must account for it, so the panel never drifts or duplicates.
- Pause handling never blocks the current request, and never drops or repeats a turn.

**Never:** No raw or single-key terminal mode, no new dependencies, no automatic restart of new games, and no request budget in any form.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Turn in a terminal | ANSI mode, a solve | the old panel is erased, the entry is printed, the panel is redrawn with the new numbers | — |
| Redirected output | not a terminal | the entry plus one plain status line; no escape codes | — |
| Pause | Enter mid-request | the request finishes and is logged; no further request is sent; the panel shows paused | — |
| Resume | Enter while paused | the next turn starts; the panel shows running | resume after a long pause gives a 404 → "game expired" summary |
| Stdin closed | EOF | pausing is unavailable; play continues | — |
| Hard board, healthy | lives 3, affordable +1 (100) and +2 (300) items | buy the +2 item | — |
| Hard board, careful | lives 2, safe ad absent, potion unaffordable, +1 and +2 affordable | buy the cheapest level item | — |
| Long game | > 300 requests | no prompt; play continues to the end | — |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java` -- remove `INITIAL_BUDGET`, `budget`, `grant()` and the budget check in `send()`. Keep `used()` for the summary. Pacing and retries are unchanged.
- `npc/api/BudgetExhaustedException.java` -- delete it.
- `npc/NpcRunner.java` -- remove `GRANT`, the `step()` budget loop and the "budget exhausted" reason. Call the client directly. Before each turn's messages fetch, wait while paused. Start the pause control at the beginning of the run.
- `npc/console/Terminal.java` -- replace `confirmMore()` and the one-line `formatLine()` with turn-entry formatting and a panel renderer (ANSI or plain, chosen by the constructor). Keep `formatDeltas()`/`formatDelta()` (U+2212 minus) and `summary()`.
- `npc/game/Strategy.java` `decide()` rule 3 -- pick by `levelsGained` descending, then cost, then shelf order when `lives > CAREFUL_LIVES`; otherwise keep the current cheapest pick.
- Tests to update: `MugloarClientTest` (drop the budget test), `NpcRunnerTest` (drop the checkpoint test), `TerminalTest`, `StrategyTest`.

## Tasks & Acceptance

**Execution:**
- [x] `npc/api/MugloarClient.java`, delete `BudgetExhaustedException.java` -- remove the budget -- the user wants no cap.
- [x] `npc/console/PauseControl.java` -- a daemon thread reads lines from an injected `InputStream`. Each line toggles `paused` and notifies a listener (the Terminal redraw). `awaitRunning()` blocks while paused. EOF ends the thread and leaves the game running -- the Enter-key pause.
- [x] `npc/console/Terminal.java` -- turn entries, the panel (ANSI erase-and-redraw, counting echoed Enter lines), plain-mode fallback, and the summary. A constructor flag picks ANSI; production uses the `System.console()` check.
- [x] `npc/NpcRunner.java` -- no budget; `awaitRunning()` before each turn; panel updates after each turn and on pause toggles.
- [x] `npc/game/Strategy.java` -- the lives-dependent level-item pick.
- [x] Tests -- `PauseControlTest` (toggle, await, EOF, using piped streams with no real sleeps), `TerminalTest` (ANSI frame sequence, plain mode has no `\u001B`, echoed-line compensation), `StrategyTest` (both level-item rows), `NpcRunnerTest` (> 300 requests with no prompt; a pause between turns sends nothing until resumed), `MugloarClientTest` (budget test removed).

**Acceptance Criteria:**
- Given a game in a terminal, when turns are played, then the panel stays at the bottom, its labels never move, and only the numbers change.
- Given `./mvnw test`, then the suite passes with no network access to dragonsofmugloar.com.

## Review Triage Log

**Pass 1 (quick):** high 0 · medium 1 · low 3 · false 0 · maybe-false 0

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | Pause is checked only before `GET messages`. An Enter during the fetch or its retry sleeps still lets the solve or buy go out while the panel shows paused. | medium | patch | Confirmed in NpcRunner.play: `awaitRunning()` runs once per turn, before the fetch. This breaks "no requests are sent while paused". Patch: also await before acting, plus a test with Enter pressed during the fetch. |
| 2 | Echoed-Enter race: the terminal echoes before the reader thread raises `echoedLines`, so a redraw in that gap leaves a stray border and later clears one log line | low | rejected | Real, and the implementer flagged it. The window is the microseconds between the echo and `toggled()` taking the lock, so it rarely shows up in practice. A real fix needs echo off or raw mode, which the plan's Never rules out (no raw terminal mode), so it would mean renegotiating the intent. |
| 3 | Panel lines are 67 columns; a narrower terminal wraps them and the redraw drifts | low | rejected | Confirmed (`PANEL_WIDTH + 4`). Default terminals are 80 columns or wider, so this is unlikely day to day. Narrowing the box only moves the threshold, and handling width properly would need a terminal-size query. |
| 4 | Labels shift once a value outgrows its field (turn ≥ 100000, score ≥ 100M) | low | rejected | Confirmed in `statsLine()` padding. The record game ended at turn 82 with score 5330 [V], so these sizes don't occur in practice. A fix would add truncation logic. |

## Design Notes

Panel frame (ANSI mode); the log scrolls above it:
```
 ✓ Solve  Help defend the village (Piece of cake, 82)
   You successfully solved the mission!
   +82 gold
┌──────────────────────────────────────────────────┐
│ Turn 13   Lives 3   Level 4   Gold 161   Score 900 │
│ ▶ running · Enter = pause                          │
└──────────────────────────────────────────────────┘
```
Redraw: move the cursor up by (panel height + echoed lines since the last draw), clear to the end of the screen (`ESC[J`), print the new entry, then reprint the panel.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.

**Manual checks:**
- After the user approves a live run, start it with `./mvnw package -q && java -jar target/*.jar`. Whether `spring-boot:run` passes stdin through is [U]. Press Enter to pause, check that no new turns appear, then press Enter to resume. The panel should stay pinned.
