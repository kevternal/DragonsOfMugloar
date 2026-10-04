---
title: 'Autonomous NPC that plays Dragons of Mugloar'
type: 'feature'
ticket: ''
created: '2026-10-03'
status: 'built'
baseline_revision: 'a9d3eb43843d9d7c9eca8b3f8d3c42276c507a19'
route: 'full'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/shared-mugloar-game/api-contract.md'
  - '{project-root}/_bmad-output/shared-mugloar-game/observed-values.md'
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/strategies.md'
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/risk-cues.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The backend is a Spring Boot skeleton. Nothing plays the game server-side, and the console gives no view of lives or level.

**Approach:** Turn the backend into a console application with a non-playable character (NPC). It plays one game against the external Mugloar API on startup, picking moves with the frontend's measured risk model, sends at most 2 requests per second, then exits. Each action that takes a turn prints one activity-log line to stdout, in the frontend CAP-12 shape, followed by a status suffix with lives, level, gold, score and turn.

## Decisions

- **Run mode:** a console app. `./mvnw spring-boot:run` plays one game and exits. `spring.main.web-application-type: none`, and no web endpoints.
- **Decision rule.** The first rule that matches wins:
  1. At 1 life with the life item affordable, buy it, before any ad, safe ads included.
  2. At 2 lives with no safe ad on the board and the life item affordable, buy it.
  3. When every measured ad is risk ≥ 3 and a level item is affordable, buy the cheapest one. When lives are above 2, buying levels beats healing.
  4. Otherwise, solve the top solvable ad. While lives > 2, sort the For Glory! way: deadly ads last, then expected reward descending, then `expiresIn` ascending. At lives ≤ 2, sort the Play it safe way: risk ascending, then the same keys.
  5. With no solvable ad on the board, stop the run with the summary reason "no playable move".
- **Budget checkpoints:** at 300 requests, and every 100 after that, the NPC pauses before sending the next request. It asks on stdout `Continue for 100 more requests? [y/N]` and warns that an idle game may expire. `y` grants 100 more, and the same step re-runs; nothing was sent, so no turn is lost or doubled. Anything else, or EOF on stdin, stops the run with a "budget exhausted" summary.
- **HTTP client:** built by hand with `RestClient.builder()`. Boot 4 webmvc ships no auto-configured `RestClient.Builder` [V, local POM 2026-10-03]. Connect timeout 5 s, read timeout 10 s.
- **Dependencies:** remove `h2`, `spring-boot-h2console` and `spring-boot-devtools`. Devtools' restart-on-recompile would start a new game. Keep `spring-boot-docker-compose`, with `spring.docker.compose.enabled: false` until a service exists.

## Boundaries & Constraints

**Always:**
- Follow the frontend's patterns (architecture AD-1…AD-18) wherever they carry over. YAGNI, KISS and SOLID apply: no interface, abstraction or setting is added until there is a second concrete use.
- **Layers.** `npc/api/` holds the only HTTP caller, the DTOs and `MugloarApiException`. `npc/game/` is a Spring-free core: plain Java with no annotations and no I/O. `npc/console/Terminal` writes stdout and reads the stdin prompt. `NpcRunner` holds the loop and the game state.
- **Single gateway (AD-2).** The base URL `https://dragonsofmugloar.com/api/v2` is a constant. All calls go through one `send()` in this order: pacing (≥ 500 ms between request starts, measured with a monotonic clock), then the budget check, then the request. Send an explicit `User-Agent`: Python's default UA got 403 [V], and Java's default is [U].
- **Decode first (AD-3).** Ads are decoded before the logic sees them: `1` is base64, `2` is ROT13 [V]. An unknown `encrypted` value gives `solvable=false` and tier unknown. The ad is never dropped.
- **Errors (AD-5).** One `MugloarApiException`, with kind `EXPIRED`, `HTTP` or `NETWORK`, mapped with `onStatus`; 404 bodies are HTML [V]. Only a 404 from `GET messages` means the game expired.
- **Retries (AD-18).** Only `GET messages` is retried, at most twice, after 2 s and 5 s, on a network error, read timeout, 5xx or 429. Solve and buy are never retried.
- Level is tracked from the start and buy responses only, since solving doesn't change it [V]. Check `lives == 0` (game over [V]) before refetching the board.
- Tests never hit the live API (AD-16) and never sleep for real. Fact-bearing comments carry [V]/[D]/[U] tags.

**Never:** No frontend↔backend integration, no persistence, no reputation investigation, no hard-coded shop list (it comes from `GET /shop` once per game), no strategy interface or registry, no Resilience4j or Spring Retry, no test `application.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Normal turn | a fresh board | act per the decision rule, then print one log line plus the status suffix | — |
| Last life | lives 1, potion affordable, a safe ad on the board | buy the potion first | — |
| Two lives | lives 2, a safe ad on the board | solve the safe ad, no potion | — |
| Healthy, hard board | lives 3, all ads risk ≥ 3, 100 gold | buy the cheapest level item | — |
| Hard board, broke | all ads risk ≥ 3, nothing affordable | solve the top ad per the sort | — |
| Encrypted / unknown | `encrypted: 1/2`; unknown label | decoded and used; an unknown label sorts last | unknown `encrypted` → not solvable |
| Game over | `lives: 0` | print the summary (score, turn, level, requests used); no refetch | — |
| Budget checkpoint | the next request would exceed the granted budget | prompt; `y` → +100 and re-run the step | otherwise a "budget exhausted" summary |
| Expired / error | a 404 on messages, or another exception | print the summary with the reason, then exit | messages retried first |

</frozen-after-approval>

## Code Map

- `backend/pom.xml` -- Boot 4.1.1, Java 25. webmvc stays (RestClient and Jackson 3; Tomcat isn't started when the web type is none). Remove h2, h2console and devtools.
- `backend/src/main/resources/application.yaml` -- add `web-application-type: none`, `banner-mode: off`, `logging.level.root: warn` (keeps Spring's output out of the activity log), `docker.compose.enabled: false` and `npc.enabled: true`. The 300/100 budget numbers are constants.
- `backend/src/test/.../DragonsOfMugloarApplicationTests.java` -- change it to `@SpringBootTest(properties = "npc.enabled=false")`.
- `frontend/src/game/decode.ts`, `shop.ts`, `apply-turn.ts` -- these exist. Port their behaviour.
- Frontend architecture AD-4 (`riskTier`, `riskLevel`, `winRatePct`, `expectedReward`, `sortJobs`, `shelfOrder`), plus `strategies.md` and `risk-cues.md` -- specced but **not yet implemented** in the frontend. Port them from the spec with the same names and integer percent maths.
- `frontend/src/components/ActivityLog.vue`, `copy.ts` `formatDelta` -- the log shape. Don't modify any frontend file.

## Tasks & Acceptance

Root: `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/`. Tests mirror this under `src/test`.

**Execution:**
- [x] `backend/pom.xml`, `application.yaml`, `DragonsOfMugloarApplicationTests.java` -- the dependency and config changes above.
- [x] `api/MugloarClient.java`, `api/MugloarApiException.java`, `api/BudgetExhaustedException.java`, `api/*Dto.java` -- RestClient calls for start, messages, shop, solve and buy, with bare arrays read as `AdDto[]`/`ShopItemDto[]` and `encrypted` as an `Integer`. Expose `send()` pacing, `grant(int)` and `used()`. A `LongSupplier` nano clock and a `Sleeper` are constructor-injected for tests.
- [x] `game/` (`Ad`, `ShopItem`, `Stats`, `TurnRecord`, `AdDecoder`, `Risk`, `Strategy`, and `Decision` as a sealed interface with `Solve` and `Buy` records) -- the decision rule as a pure function.
- [x] `console/Terminal.java` -- formats log lines and the summary to a `PrintStream`, and reads the checkpoint answer. A test constructor takes the streams.
- [x] `NpcRunner.java` -- an `ApplicationRunner` with `@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")`. It runs start → shop → loop (messages → decide → act → merge stats → log), catches `BudgetExhaustedException` for the prompt, and ends with the summary.
- [x] `src/test/.../npc/**` -- tests for AdDecoder, Risk, Strategy (every matrix row) and Terminal. A MockRestServiceServer test bound to the builder covers spacing (via recorded fake sleeps), the budget, retries on messages only with 2000 and 5000 ms sleeps, no retry of solve or buy on a 5xx, a 404 with an HTML body, and bare-array parsing.

**Acceptance Criteria:**
- Given `npc.enabled=true`, when the app runs, then one game is played until game over, a declined checkpoint, no playable move or an error. Each turn-taking action prints exactly one log line with the status suffix, and the process exits.
- Given the client, then every request start is at least 500 ms after the previous one.
- Given `./mvnw test`, then the suite passes with no network access to dragonsofmugloar.com.

## Review Triage Log

**Pass 1 (quick):** high 0 · medium 0 · low 2 · false 0 · maybe-false 0

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | `MugloarClient.messages` retry plus a budget checkpoint: `BudgetExhaustedException` escapes the retry loop, so on "y" `NpcRunner.step` restarts `messages()` with `attempt=0`. That allows more than 2 retries, plus a 2 s sleep before a prompt for a request never sent. | low | rejected | Confirmed at MugloarClient.java:86-101 and NpcRunner.java:111-122. It only happens when a 5xx or network failure hits exactly the request before a checkpoint. The restart follows a human "y", which matches the frontend's player-triggered retry (AD-5/AD-18). A fix would add state to the retry loop. |
| 2 | `Terminal` status suffix has no turn; the frozen Intent requires lives, level, gold, score **and turn** | low | patch | Confirmed at Terminal.java:75. The frozen Intent beats the non-frozen example. Appended `\| turn N` to the suffix. |

## Design Notes

**Log example:**
```
T12  ✓ Solve  Help defend the village (Piece of cake, 82)  +82 gold        | lives 3 | level 4 | gold 211 | score 900 | turn 12
       You successfully solved the mission!
T13  ✓ Buy    Healing potion                               −50 gold, +1 life | lives 3 | level 4 | gold 161 | score 900 | turn 13
```

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.

**Manual checks:**
- After the user approves, run one live game with `./mvnw spring-boot:run`, answering the checkpoint prompt. Whether the forked JVM gets the terminal's stdin is [U]. If it reads EOF, use `./mvnw package && java -jar target/*.jar`. Every log line should carry the status suffix, and the process should exit after the summary.
