# Walkthrough: backend structure refactor (56c3315)

Target: commit `56c3315` — refactor(backend): separation of concerns and Spring DI. Plan: [plan-backend-structure-refactor.md](../plan-backend-structure-refactor.md). Log: [walkthrough-backend-di-refactor-log.md](walkthrough-backend-di-refactor-log.md).

**Current block:** 3

## Blocks

- [x] 1. Intent — done (finding raised; working-tree edit to GamePlayer during review)
- [x] 2. Broad strokes — done (unchanged)
- [ ] 3. Pure state vs. the game loop — in progress
- [ ] 4. GameEvents port: console and history — unvisited
- [ ] 5. Spring wiring and configuration — unvisited
- [ ] 6. 404 on solve/buy becomes GONE — unvisited
- [ ] 7. Tests — unvisited
- [ ] 8. Periphery — unvisited

## 1. Intent

Source: pasted verbatim from the plan's Intent section ([plan](../plan-backend-structure-refactor.md)).

**Problem:** `Game` mixes state, HTTP calls, DTO mapping and console output. `Terminal` fans out to two sinks. `NpcRunner` is a singleton holding a mutable `game` and reads raw HTTP statuses. Infrastructure (HTTP client, stdout, clock, settings) is hand-built instead of wired by Spring.

**Approach:** Six agreed proposals in one change: (6) pom hygiene; (4) `Kind.GONE` for a 404 on solve/buy; (3) thin `NpcRunner` plus a `GamePlayer` returning `RunResult`; (2) a `GameEvents` port with `ConsoleView` and `HistoryLog` implementations; (1) a pure `GameState`; (5) Boot's `RestClient.Builder`, `@ConfigurationProperties`, and a `Clock` bean.

Hard constraint from the plan: console output, history files, request counts, retry timing and summary reasons stay byte-identical; existing test assertions keep their values except the intended `GONE` one.

## 2. Broad strokes

A behaviour-preserving restructure of the NPC backend: the old god-object `Game` and the `Terminal` fan-out are split along I/O lines, and all construction moves into one Spring configuration class. Open in this order:

1. [NpcConfig.java:22](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/NpcConfig.java#L22) — the single wiring point; shows every collaborator and the console-first event order.
2. [GamePlayer.java:48](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/GamePlayer.java#L48) — the game loop service: `play()` drives start → shop → turns, then reports the end to every view.
3. [GameState.java:15](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/GameState.java#L15) — pure, I/O-free game state the loop mutates.
4. [GameEvents.java:7](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/GameEvents.java#L7) — the output port that `ConsoleView` and `HistoryLog` implement.
5. [MugloarClient.java:42](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java#L42) — HTTP client now built from Boot's builder plus `MugloarProperties`.

## 3. Pure state vs. the game loop

The old `Game` is split in two. `GameState` holds id, stats, shop, purchases, dead ad ids and the reputation estimate, and turns a solve/buy result into a `TurnRecord` it applies to itself; it imports nothing from `api` or `console`. `GamePlayer` owns the I/O: it calls the client, maps DTOs into domain objects, decides via the state, and reports to every `GameEvents`. The loop body that used to live in `NpcRunner` (`playTurns`, `rereadBoard`, `describe`, reason constants) moved here.

- [GameState.solved / bought](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/GameState.java#L57) — estimate moves only on a successful solve; purchases counted only on a successful buy.
- [GameState.forget](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/GameState.java#L76) and [live](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/GameState.java#L48) — gone ads/items are remembered and filtered.
- [GamePlayer.play](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/GamePlayer.java#L48) — catches and maps failures to a reason; `ended` gets null stats if start failed.
- [GamePlayer.playTurns](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/GamePlayer.java#L86) — pause gate, board read or re-read, decide, take, report.
- [GamePlayer.take](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/GamePlayer.java#L128) — DTO → `Stats.merge` → `GameState.solved/bought`.

Ordering detail: the old `Game.solve` moved the estimate before `stats.merge`; now `merge` runs first in `take`. Same result unless `merge` throws, which ends the game anyway.

## 4. GameEvents port: console and history

`Terminal` used to write both to stdout and to the history file. Now `GameEvents` (in `game`, so dependencies flow `console → game`, `npc → all`, no cycle) has two implementations, called in list order by `GamePlayer`. `ConsoleView` is the only stdout writer and stays `synchronized` because the pause reader thread also calls it. `HistoryLog` (merged from `HistoryFile`) writes one plain-text file per game and reports an unwritable directory through a `warn` callback that `NpcConfig` points at `ConsoleView::warn`. `PauseControl` now receives its listener in the constructor.

- [ConsoleView.java:17](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/console/ConsoleView.java#L17) — implements both `GameEvents` and `PauseControl.Listener`.
- [HistoryLog.started](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/console/HistoryLog.java#L49) — file creation and the single warning on failure.
- [HistoryLog.ended](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/console/HistoryLog.java#L78) — writes the summary and closes.
- [PauseControl constructor / start](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/console/PauseControl.java#L30) — listener moved to the constructor.
- [NpcConfig.gamePlayer](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/NpcConfig.java#L53) — console first, then history, to keep the original output order.

## 5. Spring wiring and configuration

All production construction now happens in `NpcConfig`, gated by `npc.enabled=true`; classes no longer carry `@Component`. The hard-coded base URL, user agent, retry delays and timeouts became `mugloar.*` properties, `spring.http.clients.*` (timeouts, `simple` factory) and `npc.history-dir`. `MugloarClient.create()` is gone; the client takes Boot's `RestClient.Builder`. `NpcRunner` is now a stateless one-liner over `GamePlayer`.

- [NpcConfig.java:19](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/NpcConfig.java#L19) — conditional, enables both property records.
- [NpcRunner.java:7](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/NpcRunner.java#L7) — no mutable fields left.
- [MugloarProperties.java](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarProperties.java) and [NpcProperties.java](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/NpcProperties.java) — the two property records.
- [MugloarClient constructor](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java#L42) and [Sleeper.REAL](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java#L24).
- [application.yaml](../../../backend/src/main/resources/application.yaml) — the new settings.

## 6. 404 on solve/buy becomes GONE

Previously `NpcRunner` inspected the raw HTTP status to detect a vanished ad or item. Now `MugloarClient` maps a 404 on `solve` and `buy` to `MugloarApiException.Kind.GONE`, in the same `onStatus` style as the existing 404→`EXPIRED` on `messages`. `GamePlayer` checks the kind, forgets the ad/item, re-reads the board once, and decides again; GONE is never retried.

- [MugloarApiException.java:10](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarApiException.java#L10) — the new kind.
- [MugloarClient.solve](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java#L89) and [buy](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClient.java#L98).
- [GamePlayer.playTurns catch](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/GamePlayer.java#L108) — handling in the loop.

## 7. Tests

Existing tests changed construction only, except the intended rename of the solve-404 test to assert `GONE`. New: a buy-404 case, `GameStateTest`, `HistoryLogTest` (split out of the old `TerminalTest`), a failed-start test, and a context test that no NPC bean exists when disabled.

- [MugloarClientTest.java:148](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/npc/api/MugloarClientTest.java#L148) — solve and buy 404 → GONE, no sleeps.
- [GameStateTest.java](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/npc/game/GameStateTest.java) — estimate, buy, live filter, forget.
- [ConsoleViewTest.java](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/npc/console/ConsoleViewTest.java) and [HistoryLogTest.java](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/npc/console/HistoryLogTest.java) — the split of `TerminalTest`.
- [NpcRunnerTest.java](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/npc/NpcRunnerTest.java) — end-to-end over a mock server; adds `failedStartEndsTheRunWithoutStats`.
- [DragonsOfMugloarApplicationTests.java:28](../../../backend/src/test/java/io/github/kevternal/dragonsofmugloar/DragonsOfMugloarApplicationTests.java#L28) — `npc.enabled=false` creates no NPC beans.

## 8. Periphery

- [pom.xml](../../../backend/pom.xml) — webmvc → restclient starter; Lombok and docker-compose removed.
- `backend/compose.yaml` — deleted.
- [StatusPanel.java](../../../backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/console/StatusPanel.java) — Javadoc link `Terminal` → `ConsoleView`.
- [deferred-work.md](../deferred-work.md) — deferred: context test proving `spring.http.clients.*` reach the request factory.
- [plan-backend-structure-refactor.md](../plan-backend-structure-refactor.md) — the plan itself.
