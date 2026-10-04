---
title: 'NPC: decision tree v3.2'
type: 'feature'
ticket: ''
created: '2026-10-04'
status: 'built'
baseline_revision: 'f43c401eefb47f6dbfbd11a6b22a7e1219ac6fc8'
route: 'full'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/shared-mugloar-game/strategy-findings.md'
  - '{project-root}/_bmad-output/shared-mugloar-game/api-contract.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The NPC still plays the iteration-2 rules, which top out around 3–4k points. The decision tree from `strategy-findings.md` reached 50M in a live game (v3.1). v3.2 refines its early game: heal only at 1 life, buy levels instead of potions at 2 lives, play safe while broke, refreshed win rates, and a loss that costs a turn.

**Approach:** Replace `Strategy.decide` with tree v3.2. Track the state reputation locally (no reputation calls), log bait sightings, and treat a 404 on solve or buy as "ad gone, read the board again". This plan supersedes `plan-npc-iteration-3-spread-levels.md`, which stays blocked.

## Decisions

**Tree.** First match wins, every turn:
1. Drop bait: any ad whose message contains `super awesome diamond`.
2. **Reputation guard:** if one more steal would push the state reputation estimate below −8 (`stateEstimate − 2 < −8`), or bait is already on the board, also drop ads whose message starts with `Steal`, unless nothing else is left. Why: each steal lowers state by 2, and bait appears once state falls to about −10 [V].
3. If lives = 1 and the healing potion is affordable → buy the potion. **Heal only at 1 life.**
4. If lives = 2 and no playable ad is safe: gold ≥ 350 → the least-bought +2 item; else gold ≥ 150 → the least-bought +1 item. A level beats a potion here. Otherwise fall through.
5. If lives ≥ 2, gold ≥ 400, and at least one playable ad is not safe → buy the least-bought +2 item (ties: shop order).
6. If every playable ad is deadly and lives ≥ 2: gold ≥ 350 → the least-bought +2 item; else gold ≥ 150 → the least-bought +1 item.
7. If gold < potion cost (any lives) → solve the safest ad: lowest tier, then highest reward, then lowest `expiresIn`.
7b. Otherwise → solve the ad with the highest `winPct × reward − (100 − winPct) × lossCost`, where `lossCost = 50 + the highest reward among safe playable ads` (0 if none): a loss costs a potion **and** a turn. Ties go to the higher `winPct`, then the lower `expiresIn`. Integer maths.
8. With no playable ad → empty (no playable move).

**Win rates** (percent, per label; pooled from about 6,000 non-bait live solves, 2026-10-04 [V]): Sure thing 100, Piece of cake 95, Walk in the park 87, Quite likely 72, Hmmm.... 63, Gamble 55, Risky 41, Rather detrimental 37, Playing with fire 31, Suicide mission 6, Impossible 0. An unknown label scores 0 and has tier unknown.

**Item tiers** come from `ShopItem.levelsGained()`: 1 or 2. Purchase counts include only successful buys.

**State estimate** is a sum over successful solves, by message prefix: `Steal` −2, `Infiltrate` +2, `Investigate` +1.

**Bait sighting:** one line per board that holds bait, with the count and the state estimate.

**404 on solve or buy:** the ad or item is gone. Remember the adId so it is never picked again, read the board once more, and decide again on that board. If that read also returns 404, or the tree finds nothing to play on it, end the game locally with the summary (reason: "board unavailable"). A 404 on the regular per-turn `GET messages` still ends the game as expired.

**No rate limiting:** remove the request spacing from `MugloarClient` (`MIN_SPACING_NANOS` and `pace()`), so requests go out as fast as the server answers. Retries on board reads (2 s, then 5 s, on network errors, 5xx or 429) stay. Pause, the status panel and the history file are unchanged.

## Boundaries & Constraints

**Always:**
- `game/` stays pure, and new pure logic goes there: the tree, win rates, the state delta.
- `NpcRunner` owns state: stats, purchase counts, state estimate, dead adIds.
- [V] comments cite `strategy-findings.md`.
- Tests never hit the live API.

**Never:** Hard-code the shop list. Retry a solve or buy. Call the reputation endpoint.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Bait | a safe bait ad with the top value | not chosen |
| Steal blocked | estimate −7, a steal is the best value | another ad is chosen (at −6 the steal is allowed: −6 − 2 = −8 is not below −8) |
| Only steals | estimate −8, only steals remain | the best steal is chosen |
| Heal | lives 1, gold 60 | buy the potion |
| No heal at 2 | lives 2, no safe ad, gold 120 | no potion; solve by value |
| Weapon at 2 | lives 2, no safe ad, gold 360 | buy a +2 item |
| Weapon at 2, poorer | lives 2, no safe ad, gold 200 | buy a +1 item |
| Broke | lives 3, gold 30 | solve the safest ad |
| Level at 2 lives | lives 2, gold 450, a moderate ad present | buy a +2 item |
| All safe | lives 3, gold 5,000, all ads safe | solve, no buy |
| Deadly, 350 | all deadly, lives 2, gold 360 | buy a +2 item |
| Deadly, 200 | all deadly, lives 3, gold 200 | buy a +1 item |
| Broke at 1 life | lives 1, gold 20 | solve the safest ad |
| Value | no safe ad; a 31% ad for 200 versus a 63% ad for 70 | the 31% ad (2,750 against 2,560) |
| Turn cost | safe ad worth 100 present; a 72% ad for 150 versus that safe ad | the safe ad (72×150 − 28×150 < 100×100) |
| Rotation | `ch` bought once, the others 0 | a +2 other than `ch` |
| Solve 404 | solve returns 404, the re-read has a playable ad | ad remembered, decide on the re-read board, game goes on |
| Solve 404, no board | solve returns 404, the re-read returns 404 or nothing playable | game ends locally, summary "board unavailable" |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/Strategy.java` -- replace `decide`; remove `SortMode`, `sortJobs` and the hybrid comparators if they become unused. `shelfOrder` stays if used.
- `npc/game/Risk.java` -- add `winPct(label)` from the table above. Keep `riskTier` and `riskLevel`, which the tree uses for safe and deadly.
- `npc/game/` -- new small pure helper for the state delta and bait/steal checks (e.g. `AdKind`). Keep `ShopItem` as is.
- `npc/api/MugloarClient.java` -- remove the request spacing (`MIN_SPACING_NANOS`, `pace()`, and the nano clock if it becomes unused; the `Sleeper` stays for retries).
- `npc/NpcRunner.java` -- the state listed in Boundaries; 404 handling for solve and buy; calls the new Terminal method.
- `npc/console/Terminal.java` -- a `bait(...)` line, to both terminal and history.
- Tests: rewrite `StrategyTest` from the matrix; in `MugloarClientTest` remove the spacing test; extend `NpcRunnerTest` (solve 404 continues, bait line); `TerminalTest` for the bait line.

## Tasks & Acceptance

**Execution:**
- [ ] `game/Risk.java`, the new game helper, `game/Strategy.java` -- the tree and win rates.
- [ ] `api/MugloarClient.java` -- no spacing.
- [ ] `NpcRunner.java` -- state and 404 handling.
- [ ] `console/Terminal.java` -- the bait line.
- [ ] Tests, as in the Code Map.

**Acceptance Criteria:**
- Given `./mvnw test`, then all tests pass without network access.
- Given a live run (user-approved), then the tree's purchases follow the rules and bait sightings are logged.

## Implementation Notes

- Implemented by a subagent. 102 tests pass (`./mvnw test`), with no network access.
- **Two rows in the frozen test table were planner arithmetic errors.** The code follows the Decisions formulas, which match the probe that played the live v3.2 games:
  - **Value row:** with the refreshed rates, a 31% ad for 200 beats a 63% ad for 70 (2,750 against 2,560). The test uses a 31% ad for 150 instead, and also pins down the 200 case.
  - **Steal row:** the rule `estimate − 2 < −8` allows a steal at −6 (−6 − 2 = −8 is not below −8) and blocks it at −7. The test pins down both.
- Gaps the plan left, and how they were filled:
  - Purchase steps need at least one playable ad.
  - With no potion in the shop, the "broke" step is skipped.
  - A 404 during a re-read loops safely, because each 404 removes an ad or item.
- Live result of the same rules in the probe: 1 of 6 games reached 1M (v3.1: 3 of 6). The user chose to ship v3.2 and tune in v3.3.

## Plan Change Log

- 2026-10-04: the user renegotiated two frozen matrix rows (Steal blocked, Value) so they match the Decisions formulas. These were planner arithmetic errors; the formulas match the live v3.2 probe.

## Review Triage Log

**Pass 1 (quick):** low 2 · intent_gap 2 (awaiting the user)

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | The frozen "Steal blocked" row (−6 → blocked) is not met | low | intent_gap → resolved | The user decided on 2026-10-04 that the formula wins. Row corrected to −7 blocked, −6 allowed. |
| 2 | The frozen "Value" row (63%/70 over 31%/200) is not met | low | intent_gap → resolved | The user decided on 2026-10-04 that the formula wins for shipping. Row corrected. The user would prefer the 63% job; a higher loss penalty (the flip point is about 56) is a candidate for v3.3. |
| 3 | The `Risk.java` win-rate comment cites a source that lacked the values | low | patch | Added the refreshed table to strategy-findings.md ("Win rate per label, refreshed", 5,257 solves) and pointed the comment at it. |
| 4 | Two `[V]` comments in `Strategy.java` named no source | low | patch | Both now cite strategy-findings.md sections. Comments only. |

No functional bugs were found in the tree, the 404 path, state tracking, logging or the client.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.
