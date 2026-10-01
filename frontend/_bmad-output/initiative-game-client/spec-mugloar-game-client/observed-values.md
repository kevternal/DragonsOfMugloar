# Observed values

This is a registry of undocumented or enum-like API fields. Add a row only for a value actually seen, with source and date.

**Tags:** **[V]** means verified by a probe against the live API. **[D]** means stated in the docs but not observed. **[U]** means unverified or contradicted.

When the client hits a value that isn't listed here, it renders it neutrally and warns in dev (CAP-9). That warning is the cue to add a row here.

**Main source:** the budgeted measurement on 2026-10-01: 400 requests at 1 request per 2 s, 8 games, 162 solve attempts spread evenly across the labels. Board counts come from 1630 ad sightings in the same run. Earlier ad-hoc probes on the same day are cited where they're used.

## `Ad.probability`, sorted from easiest to hardest by measured win rate [V]

| # | Value | Win/Attempts | Win rate | Reward median (range) |
|---|---|---|---|---|
| 1 | Piece of cake | 15/15 | 100% | 33 (1–143) |
| 1 | Sure thing | 13/13 | 100% | 61 (2–109) |
| 3 | Walk in the park | 11/16 | 69% | 34 (2–182) |
| 4 | Quite likely | 10/15 | 67% | 38 (4–181) |
| 4 | Hmmm.... | 10/15 | 67% | 56 (3–149) |
| 6 | Risky | 7/15 | 47% | 54 (13–172) |
| 7 | Gamble | 6/15 | 40% | 39 (14–145) |
| 8 | Rather detrimental | 5/14 | 36% | 77 (26–178) |
| 9 | Playing with fire | 4/16 | 25% | 56 (27–154) |
| 10 | Suicide mission | 2/14 | 14% | 63 (23–182) |
| 11 | Impossible | 0/14 | 0% | 62 (37–154) |

- Every failed solve cost exactly 1 life in this sample. [V]
- The samples are small, about 15 attempts per label, and most attempts were at dragon level 0. Neighbouring ranks such as 3–5 and 6–8 can't be told apart statistically. The broad bands are solid: 100%, about 67%, about 40%, and 25% or less.
- Reward doesn't reliably track risk. Several hard labels have medians similar to Hmmm.... (56), and Rather detrimental has the highest median, 77. [V]
- How dragon level affects win rate is [U]: there's too little data above level 0.
- **Contradiction [U]:** an earlier unthrottled probe on 2026-10-01 recorded Sure thing as 10 wins and 32 losses under a "safest label first" policy. The balanced run got 13/13. The cause is unknown; the earlier probe didn't log lives lost and may have retried ads that were no longer valid. Re-test before relying on Sure thing.

## `Ad.encrypted` [V]

| Value | Meaning | Share of ads seen |
|---|---|---|
| `null` | plain text | 93% (1523) |
| `1` | base64 of `adId`, `message`, `probability`; solve accepts the decoded adId | 6% (96) |
| `2` | ROT13 of `adId`, `message`, `probability`; solve accepts the decoded adId | 1% (11) |

## `Ad.expiresIn`

Values from 1 to 7 were seen for every label. [V] That it means "turns until unavailable" is [D].

## Dragon `level`

- Start level is 0. [V]
- These items each raised level by exactly +1 per purchase [V]: `cs` Claw Sharpening, `wingpot` Potion of Stronger Wings, `gas` Gasoline.
- `hpot` Healing potion never changed level across 60 purchases. [V]
- Every item's level effect is in the shop table below: 100-gold items +1, 300-gold items +2. [V]
- **Solving ads doesn't raise level.** [V] In one game, level was still 0 after about 40 successful solves (score 1525), as read from the buy responses in between.

## Reputation [V]

These are the `investigate/reputation` values from the long game:

| Turn | people | state | underworld |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 17 | 4.9 | -4 | 0 |
| 34 | 9 | -8 | 0 |

Values can be negative and fractional. All 17 solves before turn 34 were Piece of cake or Sure thing ads. What drives each axis, and whether reputation affects anything else, is [U].

## Long game, 2026-10-01 [V]

- **Policy:** only solve Piece of cake or Sure thing ads, taking the highest reward. Buy `cs` whenever gold ≥ 150. Buy `hpot` at 1 life.
- **Result:** score **2511** at turn 49 with 3 lives, 211 gold, and level 23. The run stopped at its 100-request budget, not at game over.
- All 22 solves succeeded and no lives were lost.

**Continuation of the same game:** 49 requests. The policy was the same except that it rotated through untested items, preferring the 300-gold tier.
- **Result:** game over at turn 82 with a **final score of 5330**, level 45.
- No Piece of cake or Sure thing ad was picked after turn 49. Since the policy always prefers them, none can have been on the board at those times; the boards themselves weren't logged. Whether safe ads become rarer later in a game is [U].
- At levels 24–45, moderate labels went 11/14: Walk in the park 6/6, Quite likely 4/6, Hmmm.... 1/2. Rather detrimental went 0/1 and Suicide mission 0/1. The sample is too small to show a level effect [U].
- Piece of cake rewards rose over the game, from 8–98 at levels 0–3 to 178–286 at levels 11–22. Whether that's driven by level or by turn is [U].

## Solve `message` [V]

These values were seen: "You successfully solved the mission!", "You failed on the mission!", "You were defeated on your last mission!" (the solve that takes lives to 0), and "You fell into a trap set up, by people who did not appreciat…" (truncated in the log). The text is free-form; the `success` flag drives the logic.

## `highScore` [V]

This field was 0 in every response from every probe game, including games that reached 847, 1525, and 5330. Its meaning is unknown and it isn't used.

## Shop items [V]

This list was identical at the start of every probe game. In the long game (2026-10-01) it was also identical after each of 23 level-ups (level 0 → 23) and after 3 reputation checks (people 0 → 9, state 0 → −8). Prices didn't change. Whether it changes beyond level 23 or at more extreme reputation values is [U].

| id | name | cost | level effect | buys |
|---|---|---|---|---|
| hpot | Healing potion | 50 | none; +1 life [V] | 62 |
| cs | Claw Sharpening | 100 | +1 [V] | 25 |
| gas | Gasoline | 100 | +1 [V] | 3 |
| wax | Copper Plating | 100 | +1 [V] | 2 |
| tricks | Book of Tricks | 100 | +1 [V] | 2 |
| wingpot | Potion of Stronger Wings | 100 | +1 [V] | 3 |
| ch | Claw Honing | 300 | +2 [V] | 2 |
| rf | Rocket Fuel | 300 | +2 [V] | 2 |
| iron | Iron Plating | 300 | +2 [V] | 1 |
| mtrix | Book of Megatricks | 300 | +2 [V] | 1 |
| wingpotmax | Potion of Awesome Wings | 300 | +2 [V] | 1 |

Pattern [V]: 100-gold items give +1 level and 300-gold items give +2. No item other than `hpot` changed lives. Every purchase with gold ≥ cost succeeded. Differences between items in the same tier, beyond level, are [U].

The client renders whatever list the shop returns. This table is for reference only, not hard-coded.

## Healing potion effect

Each `hpot` purchase restored exactly +1 life, in all 60 purchases. [V] Whether lives have a cap is [U]: potions were bought only when lives were below 2.

## Item economics (derived from the [V] facts above; the conclusion is [U])

| Option | Gold | Levels | Turns |
|---|---|---|---|
| Two 100-gold items | 200 | +2 | 2 |
| One 300-gold item | 300 | +2 | 1 |

The 300-gold tier charges 100 gold to save one turn. A turn spent shopping is a turn not spent solving. In the long game a solve paid 8–98 gold early and 230–440 late, so the 300-gold tier would pay off once a turn is worth more than 100 gold. This whole argument holds only if level matters, which is [U] (see the spec's Open Questions). The idea comes from the user's analysis, 2026-10-01.

## Board difficulty over turns [V at level 0]

Source: 163 boards logged in the budgeted measurement, 2026-10-01. Every board held 10 ads. Tiers are from `risk-cues.md`.

| Turns | Boards | Safe | Moderate | Risky | Deadly | Safe reward median |
|---|---|---|---|---|---|---|
| 0–9 | 56 | 37% | 44% | 15% | 4% | 17 |
| 10–19 | 37 | 35% | 40% | 19% | 6% | 34 |
| 20–29 | 25 | 32% | 26% | 24% | 18% | 89 |
| 30–39 | 17 | 21% | 41% | 26% | 12% | 93 |
| 40–49 | 9 | 7% | 46% | 27% | 21% | 82 |
| 50–59 | 6 | 0% | 25% | 18% | 57% | — |
| 60–69 | 5 | 0% | 4% | 14% | 82% | — |
| 70–89 | 8 | 0% | 0% | 0% | 100% | — |

- The board shifts toward deadly ads as the game goes on, and rewards rise even at level 0. Rising rewards are therefore at least partly driven by turns, not level. [V]
- Whether the cause is the turn count itself or safe ads being used up is [U]. The probe policies favoured safe ads.
- The sample after turn 50 is small: 19 boards, mostly from one game.

## Level A/B test, 2026-10-01 (100 requests)

The policy was the same in both games: solve the best-paying moderate-tier ad, and buy `hpot` at 1 life.

- **A, no items:** 2019 points by turn 39, still at level 0. Moderate ads won 27/33 (82%). The board's median reward rose from 13 (turn 0) to 134 (turn 34) with level fixed at 0. **Rewards grow with turns regardless of level.** [V]
- **B, buying 100-gold items at gold ≥ 150:** died at turn 13, at level 1, after 4 straight moderate losses. It never reached a high level, so the comparison failed.
- **Level vs success: inconclusive [U].** There's weak evidence that level does little. Moderate ads won 82% at level 0 (A) and 79% at levels 24–45 (long game, 11/14), but the turn ranges differ and the samples are small.
