---
title: 'Backend structure refactor: separation of concerns and DI'
type: 'refactor'
ticket: ''
created: '2026-10-04'
status: 'built'
baseline_revision: 'b9a120fa5ce17891aa1515851e85be2a51cfd5c6'
route: 'full'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Game` mixes state, HTTP calls, DTO mapping and console output. `Terminal` fans out to two sinks. `NpcRunner` is a singleton holding a mutable `game` and reads raw HTTP statuses. Infrastructure (HTTP client, stdout, clock, settings) is hand-built instead of wired by Spring.

**Approach:** Six agreed proposals in one change: (6) pom hygiene; (4) `Kind.GONE` for a 404 on solve/buy; (3) thin `NpcRunner` plus a `GamePlayer` returning `RunResult`; (2) a `GameEvents` port with `ConsoleView` and `HistoryLog` implementations; (1) a pure `GameState`; (5) Boot's `RestClient.Builder`, `@ConfigurationProperties`, and a `Clock` bean.

## Boundaries & Constraints

**Always:** Console output, history files, request counts, retry timing and summary reasons stay byte-identical. Existing test assertions keep their expected values; only object construction changes, plus the one intended `GONE` assertion. Every file stays under `backend/`. Constructor injection only.

**Never:** Touch `Strategy`, `Risk`, `AdKind`, `AdDecoder`, `Stats`, `TurnRecord`, `Decision`, `Ad`, `ShopItem`, or the DTO records. Replace the hand-written retry loop. Add an interface for `MugloarClient`. Add Spring events or field injection. Touch the frontend.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Solve or buy 404 | 404 on `/solve` or `/shop/buy` | `MugloarApiException` with `Kind.GONE` and status 404; the loop forgets the ad or item and re-reads the board | Not retried |
| History dir unwritable | `npc.history-dir` points at a file | One warning on the console; play continues | `HistoryLog` warns through the console |
| Failure before start | `start` throws | Summary without stats, with the request count | `ended(reason, null, used)` |

</frozen-after-approval>

## Code Map

- `pom.xml` -- `spring-boot-starter-webmvc(-test)` becomes `spring-boot-starter-restclient(-test)` (both verified to resolve in 4.1.1). Drop the Lombok dependency, the Lombok compiler-plugin executions, and `spring-boot-docker-compose`.
- `compose.yaml`, and `spring.docker` in `application.yaml` -- delete.
- `npc/Game.java` -- split. State goes to the new `game/GameState.java`; I/O and DTO mapping go to `npc/GamePlayer.java`.
- `npc/NpcRunner.java` -- the loop body (`play`, `playTurns`, `rereadBoard`, `describe`, the reason constants) moves to `GamePlayer`. `isGone` becomes `kind() == GONE`.
- `npc/NpcConfig.java` -- the single wiring point. It defines `NpcRunner` as a `@Bean`, which removes `@Component` and the duplicate `@ConditionalOnProperty` from the class.
- `api/MugloarClient.java` -- add `onStatus` 404→`GONE` on `solve`/`buy`, following the pattern of `messages`' `EXPIRED`. Constructor becomes `(RestClient.Builder, MugloarProperties, Sleeper)`. Remove `create()` and the constants. Add a `Sleeper.REAL` constant.
- `api/MugloarApiException.java` -- add `GONE`.
- `console/Terminal.java` -- becomes `console/ConsoleView.java`, without the history logic.
- `console/HistoryFile.java` -- merged into the new `console/HistoryLog.java`.
- `console/PauseControl.java` -- the listener moves into the constructor; `start()` takes no argument.
- `console/StatusPanel.java`, `console/ConsoleFormat.java` -- unchanged.
- Tests: `NpcRunnerTest`, `MugloarClientTest`, `PauseControlTest` (construction only); `TerminalTest` becomes `ConsoleViewTest` plus `HistoryLogTest`.
- Boot 4.1.1 properties (verified in the jar metadata): `spring.http.clients.connect-timeout`, `spring.http.clients.read-timeout`, `spring.http.clients.imperative.factory` (`simple` keeps today's factory).

## Tasks & Acceptance

**Execution:**
- [x] `pom.xml`, `compose.yaml`, `application.yaml` -- dependency hygiene. Add `spring.http.clients.{connect-timeout: 5s, read-timeout: 10s, imperative.factory: simple}`, a `mugloar.{base-url, user-agent, retry-delays: [2s, 5s]}` block, and `npc.history-dir: games-history`.
- [x] `api/MugloarProperties.java` -- `@ConfigurationProperties("mugloar") record(String baseUrl, String userAgent, List<Duration> retryDelays)`.
- [x] `api/MugloarApiException.java`, `api/MugloarClient.java` -- `GONE`, properties-driven configuration, `Sleeper.REAL`.
- [x] `game/GameEvents.java` -- interface: `started(String gameId, Stats)`, `turn(TurnRecord)`, `bait(long, int)`, `ended(String reason, Stats nullable, int requestsUsed)`.
- [x] `game/GameState.java` -- pure state: id, stats, shop, purchases, dead ad ids, state estimate. Methods: `stock`, `live(board)`, `decide`, `solved(ad, success, after, flavour)` and `bought(item, success, after)` (each returns a `TurnRecord` and applies it), `forget`.
- [x] `npc/GamePlayer.java` -- `(MugloarClient, PauseControl, List<GameEvents>)`. `RunResult play()` starts the pause reader, plays, emits `ended`, and returns `record RunResult(String reason, Stats stats)`.
- [x] `npc/NpcRunner.java` -- `run` calls `player.play()`. No other state.
- [x] `npc/NpcProperties.java`, `npc/NpcConfig.java` -- `@EnableConfigurationProperties`. Beans: client (with the injected builder), `Clock`, `ConsoleView(System.out, ConsoleView.stdoutIsTerminal())`, `HistoryLog(dir, clock, console::warn)`, `PauseControl(System.in, console)`, `GamePlayer` (events in console-first order), `NpcRunner`.
- [x] `console/ConsoleView.java`, `console/HistoryLog.java`, `console/PauseControl.java` -- as mapped above. Delete `Terminal.java` and `HistoryFile.java`.
- [x] Tests -- update construction. Rename `solve404IsAnHttpErrorNotExpiry` to assert `GONE`, and add a buy-404 `GONE` case. Split `TerminalTest`. Add `GameStateTest`: estimate moves only on a successful solve; `forget` drops the ad or item; `live` filters dead ads.

**Acceptance Criteria:**
- Given the refactor, when `./mvnw test` runs, then every pre-existing assertion passes unchanged (except the intended `GONE` rename) and the new tests pass.
- Given `npc.enabled=false`, when the context loads, then no NPC bean exists.
- Given `NpcRunner`, when it is inspected, then it has no mutable fields, and no `game` class imports `api` or `console`.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pass 1 (quick lens; the first launch stalled and was relaunched):** high 0, medium 0, low 2, false 0, maybe-false 1, plus 1 rejected because its fix is a plan edit.

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| `ConsoleViewTest.consoleAloneWritesNoFile` asserts nothing | low | patch | `@TempDir dir` is never passed to `ConsoleView`, so "dir is empty" always holds. Fixed by deleting the test. |
| No test loads `NpcConfig` with `npc.enabled=true`, so the timeouts and `simple` factory reaching the request factory are untested | maybe-false (would be medium) | defer | The property names are verified in the 4.1.1 metadata, and a jar run proved binding and wiring (see the deferred-work entry). Settled by a context test that asserts the builder's request factory type and timeouts without running the `ApplicationRunner`. |
| Missing `mugloar.*` keys cause an NPE at startup | low | reject | Not reachable with the shipped `application.yaml`; the fix would add defaults or validation, which is added complexity. |
| `StatusPanel` Javadoc edited although the Code Map says unchanged | low | reject | The fix is a plan edit. The Javadoc edit is required because `Terminal` was deleted and the link would dangle. |

## Design Notes

`GameEvents` lives in `game` (as a port), so `console` depends on `game` and `npc` depends on all three packages, with no cycle. Event order is console first, then history, which preserves today's ordering: the status line prints before any history warning, and on summary the panel is erased before the history file closes. `ConsoleView` methods stay `synchronized` because the pause reader thread calls into it. `HistoryLog` is only called from the game thread.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS, at least 103 tests, 0 failures.
- `cd backend && ./mvnw -q dependency:tree | grep -ci "tomcat\|lombok\|docker-compose"` -- expected: 0.
