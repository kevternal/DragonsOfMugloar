---
title: 'NPC iteration 3: skip bait and steals, rotate +2 level items across themes'
type: 'feature'
ticket: ''
created: '2026-10-04'
status: 'blocked'
blocked_reason: 'On hold by user (2026-10-04): the spread-vs-claws evidence weakened after the leave-one-out test (strict even rotation scored like claws-only). Waiting for a larger experiment (6 games per arm) before porting.'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/shared-mugloar-game/strategy-findings.md'
  - '{project-root}/_bmad-output/initiative-game-backend/plan-npc-iteration-2.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The NPC takes bait ads that always trap it, takes steals that lower its state reputation, hoards gold, and levels only one theme (claws). In live probes this scored about 3.2–3.7k, while the measured best policy averaged 6.3k (`strategy-findings.md`).

**Approach:** Port the best measured probe policy into `Strategy.decide`. Skip bait ads entirely, skip ordinary steals when anything else is solvable, and spend spare gold on +2 level items, rotating across them so every theme levels evenly. Healing and the hybrid sort stay as they are.

## Decisions

- **Bait:** an ad whose message contains `super awesome diamond` is never solved. Every one of 21 attempts trapped [V].
- **Steals:** an ad whose message starts with `Steal` is skipped whenever any other playable ad exists. Steals won 17/17 but lowered state reputation, and the bait appeared after state fell [V].
- Both filters apply before every board check: the safe-ad test, the hard board and the sort.
- **Level items:** the +2 items (`levelsGained == 2`, today `ch`, `wingpotmax`, `rf`, `iron`, `mtrix`) are bought in rotation. The pick is the affordable +2 item bought least so far this game; ties go to shop order. No theme table: the +2 tier already holds exactly one item per theme [V, shop list].
- **When to buy** (rule order: heal rules 1–2 stay first):
  - 3a. **Proactive:** lives ≥ 3 and gold − cost ≥ 100. This keeps 2 potions' worth of gold in reserve.
  - 3b. **Hard board:** every playable ad with a known label is Risky or Deadly. Buy the rotation pick if affordable, at any lives.
  - The old rule's +1 and cheapest picks are removed. The probes that measured this policy bought only +2 items.
- **Purchase counts** live in `NpcRunner`, per item id, and count only successful buys. `Strategy` stays pure: the counts are passed in.

## Boundaries & Constraints

**Always:** `game/` stays Spring-free and pure, with the same layers as iteration 2. The pattern text and thresholds carry a [V] source comment that cites `strategy-findings.md`.

**Never:** Hard-code the shop list. Use any theme mapping or place logic; the semantic hypothesis is [U] and still being tested. Change the healing rules or the sort keys.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Bait on board | a safe bait ad with the top reward, plus a moderate ad | solve the moderate ad | — |
| Only bait | every solvable ad is bait | no playable move | — |
| Steal versus other | a safe steal and a moderate escort | solve the escort | — |
| Only steals | every playable ad is a steal | solve the top steal per the sort | — |
| Proactive buy | lives 3, gold 450, one `ch` bought already | buy the least-bought +2 item (not `ch`) | — |
| Reserve kept | lives 3, gold 350 | no proactive buy (350 − 300 < 100); solve | — |
| Hard board, lives 2 | all known ads risky or deadly, gold 300, no heal match | buy the rotation pick | — |
| Failed buy | `shoppingSuccess: false` | the count isn't raised | — |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/Strategy.java` `decide()` -- add a parameter for purchase counts (`Map<String, Integer>`), filter the board once at the top (bait, then steals), and replace rule 3 with 3a/3b. `sortJobs()` and `shelfOrder()` stay unchanged.
- `npc/game/ShopItem.java` -- `levelsGained()` already identifies the +2 tier; no change.
- `npc/NpcRunner.java` -- keep a `Map<String, Integer>` of successful buys per id, raise it in `buy()` when `shoppingSuccess` is true, and pass it to `decide`.
- Tests: `StrategyTest` (every matrix row, and update the existing hard-board tests to the rotation), and `NpcRunnerTest` (a failed buy doesn't count; callers pass the counts).

## Tasks & Acceptance

**Execution:**
- [ ] `npc/game/Strategy.java` -- the filters, plus rule 3a/3b with the rotation pick, plus Javadoc for the new rule list.
- [ ] `npc/NpcRunner.java` -- purchase counts, passed to `decide`.
- [ ] `src/test/.../game/StrategyTest.java`, `src/test/.../NpcRunnerTest.java` -- matrix rows; adjust existing tests broken by the rule change, keeping the old intent where it still applies.

**Acceptance Criteria:**
- Given `./mvnw test`, then the suite passes with no network access.
- Given a live game (with the user's go-ahead), then no bait is solved, and level purchases cycle through all five +2 items.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.
