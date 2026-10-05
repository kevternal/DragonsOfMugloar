# Recommendations (CAP-16, CAP-17)

Every recommendation is computed in the browser from:
- the board;
- the stats;
- the shop;
- two per-game counters: purchases per item, and the state estimate.

The rules port decision tree v3.4, implemented in `backend/.../npc/game/Strategy.java`, `Risk.java` and `AdKind.java`. Its evidence is in `../../shared-mugloar-game/strategy-findings.md`.

Nothing is hidden or disabled; the player always decides. Hint text in the tavern voice never promises an outcome.

## Win rate per label [V, 5,257 non-bait solves, 2026-10-04]

| Label | Win % | Tier (`risk-cues.md`) |
|---|---|---|
| Sure thing | 100 | safe |
| Piece of cake | 95 | safe |
| Walk in the park | 87 | moderate |
| Quite likely | 72 | moderate |
| Hmmm.... | 63 | moderate |
| Gamble | 55 | risky |
| Risky | 41 | risky |
| Rather detrimental | 37 | risky |
| Playing with fire | 31 | deadly |
| Suicide mission | 6 | deadly |
| Impossible | 0 | deadly |

- An unknown label has no win rate. Its ad shows "unknown odds".
- A label's rate was stable across all game phases [V].

## Ad kinds [V]

| Kind | How to recognise it | Effect |
|---|---|---|
| Bait | Message contains "super awesome diamond" (any case) | Failed 21 of 21 attempts, costing a life each. Shown as a **trap**. |
| Steal | Message starts with "Steal" (and isn't bait) | A successful steal changes state by −2. |
| Infiltrate | Message starts with "Infiltrate" | A successful one changes state by +2. |
| Investigate | Message starts with "Investigate" | A successful one changes state by +1. |

**State estimate:**
- It is the sum of these changes over the successful solves in this game.
- A reputation reading replaces it with the real `state` value.
- Failed solves change nothing.
- It starts at 0 for a new game, and is unknown after a reload or on another device until the next reading. While unknown, it is treated as 0, as the tree does.
- Accuracy: it matched 25 of 26 readings [V].

## Jobs (CAP-16)

1. **Playable ads.** These are the solvable ads that aren't bait. Steals are left out when bait is on the board, or when the state estimate − 2 would fall below −8. If only steals are left, they stay in.
2. **Value.** A playable ad's value is `winPct × reward − (100 − winPct) × lossCost`, where `lossCost = 75 + the highest reward among safe playable ads (0 if none)`.
3. **Sort order:**
   - Playable ads with a known win rate, by value (highest first), then win % (highest first), then `expiresIn` (soonest first), then `adId`.
   - Then left-out steals, in the same order.
   - Then unknown-odds ads.
   - Then traps.
4. **Best pick.** The first ad in that order.
   - Exception: when gold is below the potion's cost, the best pick is the **safest** playable ad instead: lowest tier, then highest reward, then soonest expiry, then `adId`.
   - No playable ad means no best pick.
5. **Flags shown on rows:**
   - **Trap** on bait.
   - **Hurts your standing with the state** on a steal left out by the guard.

## Shop (CAP-17)

Applied in order; the first match decides the **recommended item**:

1. **At 1 life,** with the healing potion (`hpot`, the cheapest item that grants a life) affordable: recommend the potion. Its reason is "low on lives".
2. **At 2 lives,** with no safe playable ad and gold ≥ 350: recommend the least-bought +2 item.
3. **At 2 or more lives,** with some playable ad not safe and gold ≥ 400: recommend the least-bought +2 item.
4. **At 2 or more lives,** with an all-deadly playable board and gold ≥ 350: recommend the least-bought +2 item.

Otherwise no item is recommended.

**Least-bought +2 item:** among the affordable +2 items (`ch`, `rf`, `iron`, `mtrix`, `wingpotmax`), the one with the fewest successful buys this game. Ties go to the first in shelf order (cost ascending, then API order). Steps 2–4 need at least one playable ad.

**+1 items** (`cs`, `gas`, `wax`, `tricks`, `wingpot`) are always marked **not worth buying**. Each eases about 3% of ads for a whole turn, and every losing probe game bought 7–22 of them [V, 11 games].

**Highlights:**
- When an item is recommended, the shop tab shows one hint: "Low on lives" for step 1, otherwise "Level up".
- At 1 life with the potion unaffordable, the shop tab shows "Low on lives" and nothing is recommended.

**After a reload:** the purchase counts restart at 0. They are not persisted (YAGNI; the tree only uses them to rotate items).

## Limits

- **Evidence quality:** v3.4's exact thresholds rest on a few games each. The ranking between loss bases is [U].
- **Why +2 items help:** they visibly ease the board, because labels are recomputed live [V]. Which themes help which places is [U]; the semantic mapping was refuted.
