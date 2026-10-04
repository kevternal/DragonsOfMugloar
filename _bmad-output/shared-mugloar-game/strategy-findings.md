# Strategy findings

What live play has shown about winning the game, kept separate from `observed-values.md`, which lists the API's own values.

**Tags:** **[V]** means verified in live games, with the sample size. **[V, n=1]** means one game showed it; the outcome is real but may not repeat. **[U]** means a hypothesis or guess, not something shown. Don't build logic on [U] without testing it first.

**Source:** probe games played on 2026-10-04 against the live API: 34 games (32 played to game over, 1 stopped by hand, 1 lost to a network timeout), about 5,900 requests, at 1 to 4 requests per second. Each game logged every board, every solve and buy, and a reputation reading every 3 to 20 turns. The raw JSONL is stored locally (gitignored) in `backend/games-history/probes-2026-10-04/`.

## Policies played

| Policy | Games | Scores | Died at turn |
|---|---|---|---|
| Baseline: the NPC's current rules (hybrid sort, heal at ≤ 2 lives, cheapest level item only on a hard board) | 2 | 3,244 · 3,697 | 80 · 84 |
| Notorious: always take a safe or moderate steal | 1 | 990 | 76 |
| Proactive claws: buy a +2 item whenever gold stays ≥ 100 after buying (always `ch`, Claw Honing) | 1 | 4,737 | 71 |
| Iteration 1: proactive claws, plus no bait and no steals | 3 | 4,692 · 3,541 · 2,429 | 75 · 82 · 59 |
| Iteration 2: no level items, heal below 4 lives, pick ads by win rate × reward − loss rate × 50 | 3 | 2,993 · 3,365 · 2,672 | 170 · 192 · 156 |
| Iteration 3: proactive +2 items rotating across all five themes, plus no bait and no steals | 1 | **10,978** | 125 |
| Iteration 3: proactive +2 items of one theme only (wings `wingpotmax` / fire `rf`) | 1 + 1 | 4,409 · 5,079 | 72 · 83 |
| Iteration 3: armour only (`iron`) | 1 | stopped at turn 67 | — |

The single-theme games were not clean. The hard-board rule still bought `cs` and `ch` (claw items) in those games, so they also gained claw levels.

## Verified

### Bait ads [V, 1 game, 123 sightings, 21 solves]
- Ads worded **"Steal super awesome diamond <thing> from <person>"** carry the labels Piece of cake (37), Sure thing (85) and Walk in the park (1), with rewards of 125–201.
- All 21 attempts failed with **"You fell into a trap set up, by people who did not appreciate your dealings."**, costing one life each.
- They appeared only in the notorious game. The first one showed at turn 14; the reading before it, at turn 13, had state at −8. None appeared in the other 12 complete games, where state never went below −10.
- What makes them appear is **[U]**: a state threshold, a count of steals, or something else.

### Ordinary steals [V, 17 solves across games]
- "Steal <thing> delivery to <person> and share some of the profits…" won all 17 attempts.
- Over the readings that covered steals, state fell by about 2 per steal. Readings came only every 3–5 turns, so pinning each change to one ad is an inference.

### Reputation [V, 120+ readings across 13 games]
- **people** rose by about 0.8–1.5 over spans of escort, "Help …" and ad-campaign jobs, and topped out near 8.4–9.5.
- **state** fell over spans of steals and rose over spans of infiltrate and investigate jobs.
- **underworld** fell (0 to −4) over spans of infiltrate and investigate jobs.
- No reading changed across 40+ turns of nothing but "Help defending" jobs (2 games).
- Failed solves are not separated out here.
- Whether reputation changes anything other than the bait is **[U]**. Win rates showed no link to reputation outside the bait.

### Job types follow fixed phases [V, 13 of 13 games]
| Turns | Jobs seen |
|---|---|
| 0–19 | "Help …", ad campaigns, escorts, some steals |
| 20–39 | "Help defending", investigate, infiltrate, some escorts |
| 40+ | only "Help defending X in Y from the intruders" (plus bait in the notorious game) |

So far no game has broken this pattern. Whether games differ in ways this data can't show, such as which stat their jobs test, is **[U]**.

### The defended place goes with the label [V, about 6,800 "Help defending" sightings, 10 games]
Average tier per place, where 1 is safe and 4 is deadly:
- **About 2.0–2.4:** field, plains, village, meadow, thrift shoppe, pasture, savannah, steppe, grassland, peninsula.
- **About 3.2–3.6:** island, church, cave, rocky plains, forest, manor, hill, woodland, well, thicket, foggy riverside.
- **About 3.9–4.0:** fort, mountains, swamp, tower, bog, mystery island, stronghold, keep, dungeon, castle, palace.

The late game turns deadly because these places fill the board, not because of the jobs themselves.

### Win rate per label, pooled [V]
Source: `observed-values.md` (2026-10-01) plus the probe games of 2026-10-04, with bait excluded.

| Label | Wins/Attempts | Rate |
|---|---|---|
| Sure thing | 32/32 | 1.00 |
| Piece of cake | 113/118 | 0.96 |
| Walk in the park | 51/59 | 0.86 |
| Quite likely | 48/60 | 0.80 |
| Hmmm.... | 37/56 | 0.66 |
| Gamble | 12/25 | 0.48 |
| Risky | 12/27 | 0.44 |
| Rather detrimental | 9/27 | 0.33 |
| Playing with fire | 4/17 | 0.24 |
| Suicide mission | 2/19 | 0.11 |
| Impossible | 0/16 | 0.00 |

- In iteration 2, the deadly tier won only **5 of 118** attempts (about 4%), all late in the game at level 0. That's much lower than the pooled rates for those labels, so the same label may not mean the same odds at every point in the game.

### Win rate per label, refreshed [V, 2026-10-04]
Source: every non-bait solve in the probe games of 2026-10-04 (5,257 solves, all game phases; the v3.2 and v3.3 test games came later and are not included). This is the table the NPC uses from tree v3.2 on. It replaces the smaller pooled table above, which overrated "Quite likely" (0.80 there, 0.72 here).

| Label | Wins/Attempts | Rate |
|---|---|---|
| Sure thing | 1420/1420 | 1.00 |
| Piece of cake | 1831/1919 | 0.95 |
| Walk in the park | 382/441 | 0.87 |
| Quite likely | 288/398 | 0.72 |
| Hmmm.... | 218/344 | 0.63 |
| Gamble | 69/125 | 0.55 |
| Risky | 55/135 | 0.41 |
| Rather detrimental | 54/145 | 0.37 |
| Playing with fire | 13/42 | 0.31 |
| Suicide mission | 10/158 | 0.06 |
| Impossible | 0/130 | 0.00 |

Rates were stable across game phases (turns 0–19, 20–59, 60–129, 130+), so a label means the same odds at every point in the game.

### Gold and lives [V]
- Every game that died had 9–47 gold left at game over. Gold doesn't add to score: buying lowers gold but leaves score unchanged.
- Lives went above 3: up to 4 were seen when buying potions below a target of 4. Whether lives have a cap is **[U]**.
- Surviving longer without levels didn't raise the score. Iteration 2 lasted about twice as many turns and scored less.

### Levels, claws only [V data, U interpretation]
- In iteration 1, all claws, moderate labels won 23/31 below level 10 and 10/19 at levels 10–29.
- The higher levels also came at later turns, so turn and level can't be separated here.

## One game each [V, n=1]
- **Five-theme spread: 10,978 points, died at turn 125, level 71.** It started buying levels at turn 16 and kept going until turn 122.
  - Fortified places averaged tier 3.48 there (553 sightings), against 3.69–3.90 in the single-theme games at level 10+.
  - Open land stayed at 1.66, against about 2.0–2.3 in the single-theme games.
- **Single theme: wings 4,409 and fire 5,079**, both contaminated by claw buys.

## Experiment: spread versus claws only, at matched spending [V, 3 + 3 games, 2026-10-04]

**Setup:** both arms used the same trigger. They bought a +2 item (300 gold) at 3+ lives whenever gold stayed at 100 or more after buying, with no bait and no steals. The hard-board rule could buy only the arm's own items. Arms alternated S, C, S, C, S, C. One spread game crashed on a network timeout and was replaced with a fresh game. Its boards up to the crash are included in the label table.

| Arm | Scores | Died at turn | Total level |
|---|---|---|---|
| Spread (`ch`, `wingpotmax`, `rf`, `iron`, `mtrix`) | 9,078 · 4,175 · 5,695 (average 6,316) | 113 · 77 · 97 | 56 · 24 · 34 |
| Claws only (`ch`) | 3,887 · 3,296 · 3,825 (average 3,669) | 76 · 84 · 87 | 22 · 16 · 20 |

- Every spread game outscored every claws game. With 3 games per arm, a split like this happens by chance about 1 in 20.
- **Mechanism, at the same total level (10–29), average label tier:**

  | Place group | Spread | Claws |
  |---|---|---|
  | Open land | 1.94 (n=275) | 2.34 (n=70) |
  | Rough terrain | 2.60 (n=702) | 3.16 (n=575) |
  | Fortifications | 3.37 (n=243) | 3.91 (n=445) |

  The same total level gives easier labels when the items are spread out. So the item mix matters, not just the level.
- Fortifications stayed near-deadly (3.71) even at levels 30–59 in the spread arm.
- **Limits:**
  - The spread arm was claw-heavy, because the hard-board rule picks `ch` first: 8–16 `ch` against 2–3 of each other theme. Which of the other themes does the work is **[U]**.
  - Whether games differ in which themes they reward is **[U]**.

## Hypotheses: unverified, don't rely on them
- **[U]** The five level-item themes (claws, wings, fire, armour, cunning; a +1 and a +2 item each) stand for five hidden dragon stats, and `level` is their sum. This comes from Claude's memory of the original 2016 game, not from this API.
- **[U]** Items lower the labels of particular places or jobs. The semantic mapping (wings → heights, armour → forts …) was **not supported** by the leave-one-out test.
- **[U]** Spreading purchases across themes beats concentrating them. It looked supported in the first 3-vs-3 experiment, then the strict even rotation scored the same as claws-only. Unresolved; score variance between games is large.
- **[U]** Bait appears once state crosses a threshold.
- **[U]** Different games demand different themes. The job phases matched in 13 of 13 games, but theme demand hasn't been measured.

## Pre-registered hypothesis: which theme helps which place [U, written 2026-10-04 before the leave-one-out results]

This mapping is reasoned from item and place names only, so it is **[U]**. It is written down before the leave-one-out experiment (3 even-rotation games, plus 2 games for each arm that leaves one theme out) so the data can test it rather than be fitted to it.

| Theme | Items | Predicted to lower the labels of |
|---|---|---|
| Wings | `wingpot`, `wingpotmax` | mountains, island, mystery island, tower, hill, swamp, bog, foggy riverside |
| Fire | `gas`, `rf` | forest, woodland, thicket, castle, palace, manor |
| Armour | `wax`, `iron` | fort, stronghold, keep, tower, castle |
| Cunning | `tricks`, `mtrix` | dungeon, cave, well, church, plus infiltrate and investigate jobs |
| Claws | `cs`, `ch` | field, plains, meadow, pasture, steppe, grassland, village |

- **Confirmed if:** leaving a theme out raises the average label tier of *its* places against the even arm, at the same level band, clearly more than it raises other places.
- **Refuted if:** leaving a theme out raises all places about equally (only total level counts), or raises places that don't match the theme.

### Result of the pre-registered test [V, 13 games, 2026-10-04]

**Setup:** strict rotation with no claw bias; the hard-board rule rotates too. Leave-one-out arms. Same buy trigger as the experiment above.

| Arm | Scores (died at turn, final level) |
|---|---|
| Even, all five | 3,609 (92, L18) · 3,787 (87, L20) · 3,679 (79, L20) |
| No claws | 3,411 (82, L18) · 8,945 (120, L54) |
| No wings | 6,447 (102, L38) · 5,140 (103, L28) |
| No fire | 69 (8, L0) · 47 (13, L0): **both died before any purchase; tells us nothing about fire** |
| No armour | 7,670 (117, L46) · 3,616 (102, L16) |
| No cunning | 4,505 (89, L26) · 5,162 (92, L30) |

**Theme→place prediction.** The test compared each theme's predicted places with all other places, at levels 10–39, against the even arm. If leaving a theme out mattered, its predicted places should get harder relative to the rest.

| Theme left out | Predicted places harder by | Prediction |
|---|---|---|
| Wings | −0.07 | not supported (wrong sign) |
| Armour | −0.08 | not supported (wrong sign) |
| Cunning | −0.17 | not supported (wrong sign) |
| Claws | +0.24 | weak support (n = 26 / 46) |
| Fire | — | untested |

**Conclusion:** the semantic theme→place mapping is **not supported**. Don't build logic on it.

**Effect on "spread beats claws-only".** That earlier result is now **weakened**:
- The strict even rotation scored 3.6–3.8k in all 3 games, about the same as claws-only (3.3–3.9k).
- The claw-heavy spread (average 6.3k) and the leave-one-out arms (3.4–8.9k) varied widely.
- With 2–3 games per arm and this much variance, **no item mix has been shown to beat another on score**.
- High scores track how long the game survives and the final level. Both of those are partly consequences of early luck, so they can't serve as causes.

**Early-game risk [V, 2 of 13 games]:** with 0 gold, the For Glory sort took a Gamble job on turn 1 at 3 lives. Moderate jobs then failed in a row before a potion was affordable. Playing safe until a potion is affordable might prevent these deaths. That idea is **[U]**.

## The decision tree (designed with the user, 2026-10-04)

```
track: state estimate = Σ successful solves: steal −2, infiltrate +2, investigate +1   (no reputation queries for decisions)

each turn:
  1. drop bait ads (always)
  2. drop steals if state − 2 < −8, or any bait is on the board (keep them if nothing else is left)
  3. lives = 1, or 2 with no safe ad, and potion affordable → buy potion
  4. lives ≥ 3 and gold ≥ 400                               → buy a +2 item, least bought of the five
  5. lives = 1 and no potion money                          → safest ad (lowest tier, highest reward, soonest expiry)
  6. otherwise                                               → best value (v1: p × reward; v2: p × reward − (1 − p) × 50)
reputation is read every 25 turns for trend data only; every bait sighting is logged with the state estimate
```

### Why the tree looks like this [V]
- **Labels are recomputed live from the dragon's stats.**
  - After a level item, 20–31% of the ads already on the board changed label. Every change was easier: 839 easier, 0 harder.
  - Across solves and potions, labels changed 0 times in 19,635 comparisons.
  - +1 items eased about 3% of ads, against about 25% for +2 items, so only +2 items are worth buying.
- **Reputation is exact arithmetic over successful solves**, from 183 intervals between readings:
  - **state:** steal −2, infiltrate +2, investigate +1 (R² = 1.00).
  - **underworld:** infiltrate −1 (R² = 1.00).
  - **people:** about +1 per steal or ad campaign, and smaller amounts for other jobs (R² = 0.97).
  - Failed solves change nothing.
  - In tree v1, the estimate matched 25 of 26 readings exactly. The one miss was off by 1.
- Bait has only been seen at state −10 (1 of 3 games that reached −10). The constraint keeps state at −8 or higher.

### Tree v1 [V, 6 games, 4 req/s]
- **Scores:** 4,892 · 5,214 · 4,327 · 6,860 · 6,309 · **12,524**. Mean 6,688, median 5,762. The worst game still beat the old baseline of 3.2–3.7k.
- **Leaks:**
  - 60 deadly attempts won only 6. The pooled rates overstate deadly odds late in the game.
  - Each game bought 12–26 potions.
  - Levels lagged: only level 2–8 by turn 40.

### Tree v2: most successful run before the v3 optimisation [V, n=1, game `WbRlwSbP`, 2026-10-04]
v2 is v1 plus a lost-life penalty in step 6: p × reward − (1 − p) × 50.

- **Stopped by hand at 1,039,198 points on turn 3,597**, still alive at level 6,584 with 3 lives. It was stopped on request; it did not die.
- **Milestones (turn, level):**

  | Score | Turn | Level |
  |---|---|---|
  | 10k | 95 | 64 |
  | 100k | 464 | 656 |
  | 500k | 1,880 | 3,308 |
  | 1M | 3,597 | 6,578 |

- **The break-out:** from turn 324, every ad on every board was "Sure thing", including fortifications. The dragon out-levelled turn-driven difficulty, and rewards kept growing with turns (about 52k per job at the end).
- **Inefficiency:** step 4 kept firing, so 3,298 of 3,456 actions were level purchases and only 158 were solves (152 won). Once the board was all safe, those purchases changed nothing.
- **Cost:** about 7,060 requests at 4 req/s.
- **Reference:** the public high-score table seen 2026-10-04 lists 1,019,978,705 · 31,627,908 · 26,869,060 · 21,785,750 · 8,277,173.
- The other 5 planned v2 games were not played; this one game ran on request instead.

### Tree v3 [V, n=1]
v3 is v2, plus: skip the step 4 level purchase while every playable ad is safe.

- **Died at 8,700, turn 127, level 52.** The all-safe rule never fired.
- **Cause 1: stuck at 2 lives from turn 9 to 31 with up to 1,374 gold.** Step 4 needed 3 lives, and step 3 heals at 2 lives only when no safe ad is on the board. So no levels until turn 33.
- **Cause 2: an all-deadly board at turn 110, with 350 gold.** That's below step 4's 400 threshold, so the game took 12 deadly jobs in a row, buying a potion after each loss, until gold ran out.

### Tree v3.1: best run [V, n=1, game `SkQd9rKp`, 2026-10-04, 10 req/s]
v3.1 is v3, plus two changes:
- **Step 4 levels at lives ≥ 2** (was ≥ 3).
- **New step 4b:** on an all-deadly board with lives ≥ 2, buy a +2 item at 350+ gold, else a +1 item at 150+ gold. That keeps 50 gold for a potion.

**Result:**
- **Stopped on request at 50,033,962 points on turn 5,893**, at level 7,352, still alive with 2 lives. That's 2nd on the public table seen 2026-10-04, behind 1,019,978,705.
- **Milestones (turn, level):**

  | Score | Turn | Level |
  |---|---|---|
  | 10k | 85 | 62 |
  | 100k | 348 | 424 |
  | 1M | 887 | 1,094 |
  | 10M | 2,645 | 3,292 |
  | 30M | 4,565 | 5,698 |
  | 50M | 5,893 | 7,350 |

  1M took about 6 minutes; v2 took 3,597 turns to get there.
- **Actions:** 1,939 solves (1,895 won), 3,719 purchases, 236 reputation reads.
- **Cost:** about 11,550 requests at 10 req/s, with **0** 429 or 5xx responses.
- **Why it was faster:** the all-safe rule turned most late turns into solves, while v2 spent about 95% of its late turns on purchases. Unspent gold piled up (48.9M at the end). It's harmless, but it shows the rule could buy less often still.
- **Limits:** one game. The rule that heals back to 3 lives was discussed and dropped in favour of levelling at 2 lives.

### Tree v3.1: consistency [V, 6 games, 10 req/s, 2026-10-04]

| Game | Result |
|---|---|
| `SkQd9rKp` | 50,033,962 (stopped while alive) |
| — | died at 11,747 (turn 129) |
| — | died at 6,710 (turn 97) |
| — | **1,000,302** (stopped at the target, turn 868) |
| — | **1,007,688** (stopped at the target, turn 898) |
| — | died at 4,137 (turn 88) |

- **3 of 6 reached 1M.** The bar of 5 consecutive runs is **not met**.
- Every game that survived past about turn 130 broke out: the board went all-safe and the score grew without limit. Every loss happened in the early race, between turns 88 and 129. The weakness is entirely early-game survival.
- **The typical losing path (game at 11,747):**
  - A losing streak on moderate and risky jobs, around turns 95–120, turned gold into potions instead of levels.
  - The board then went 100% deadly at about level 72.
  - Two +1 items (about 3% of ads eased each) spent the last 200 gold.
- **Seen once in probe code:** a solve returned 404 for an ad with `expiresIn: 1`. That's the only one in about 65,000 logged events. Handling: re-read the board once.
- ~~Ads with `expiresIn` 1 lose more often.~~ **Corrected:** within the same tier they win as often as any (safe 99% against 97%, moderate 80% against 75%). The raw 38% loss rate came from the label mix, not from expiry [V].

### Loss penalty and +1 items [V, 2026-10-04, few games each]
All runs used the v3.2 rules and varied only the base of the loss cost (`75` means 75 plus the best safe reward on the board). Success counts reaching 100k.

| Variant | Games | Reached 100k | Losses |
|---|---|---|---|
| Base 50 (v3.2 as shipped) | 6 | 1 | 9,610–13,409 |
| Base 65 | 2 | 0 | 8,376 · 7,472 |
| Base 75 | 3 | 1 (stopped at 492k while alive) | 6,499 · 7,472 |
| **Base 75, no +1 items (v3.4)** | 3 | 1 | **12,315 · 20,975** |
| Base 100, no +1 items | 1 | 0 | 7,533 |

- **+1 items were the clearest leak.** Every losing v3.2-family game bought 7–22 +1 items, at 100 gold and a turn each, for about a 3% easing. The 1M game bought none, and the 492k game bought 7. Removing them pushed v3.4's losses later: 12k and 21k, with one survival to turn 186.
- **Base 100 was too conservative:** level 46 at turn 104. Like the v3.3 risk floor, it slowed income more than it saved lives.
- Samples are small, so the ranking between bases is **[U]**. The +1 finding is consistent across all 11 games.

### Tree v3.4: shipped after v3.2 [V, 3 games at base 75 with no +1 items; leak seen in 1 game]
v3.4 is v3.2 with a loss base of 75 and no +1 items.
- At 2 lives with no safe ad, and on an all-deadly board, it buys only a +2 item at 350+ gold; otherwise it solves.
- **Known remaining leak [V, n=1], seen in the 20,975 game:** on an all-deadly board with under 350 gold, it keeps taking 31% jobs and buying a potion after each loss, until it is broke.

### Tree v3.2 [V, 6 games, 10 req/s, 2026-10-04]
v3.2 is v3.1 plus four changes:
- heal only at 1 life;
- at 2 lives with no safe ad, buy a level item instead of a potion (+2 at 350+ gold, else +1 at 150+);
- with no potion money, play safe at any number of lives;
- refreshed win rates, and a loss priced at 50 plus the best safe reward on the board.

| Arm | Reached 1M | Scores |
|---|---|---|
| v3.2 | **1 of 6** | 1,006,674 · died at 9,610 · 9,699 · 13,409 · 13,091 · 10,919 |
| v3.1 | 3 of 6 | — |

- **v3.2 is worse at reaching 1M.** Its losses come later (9.6–13.4k against v3.1's 4.1–11.7k), so the stricter rules slow dying more than they help winning. Why is **[U]**.
- **Level-to-turn ratio [V, 3 games examined]:**

  | | Level at turn 100 | Level at turn ~115 | Gold |
  |---|---|---|---|
  | The 1M game | 86 | 104 | — |
  | The two losers | 57–60 | 63–65 | always under about 500 |

  The losers weren't hoarding: they earned less, because early losses paid no reward. Holding level at roughly 0.75 × turn or more seems to separate break-outs from deaths **[U, 3 games]**.

## Next questions
- Which themes lower which places' labels? Test a strictly even rotation (no `ch` bias) against leave-one-theme-out arms.
- Does any purchase pattern make fortifications (fort, castle, swamp …) winnable?
- Do games differ in which themes they reward?
