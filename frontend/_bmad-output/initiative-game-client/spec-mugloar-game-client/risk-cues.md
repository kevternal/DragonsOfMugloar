# Risk-reward cues (CAP-6)

Every cue pairs a colour with an icon or shape so that meaning never relies on colour alone.

**Status:** The tier membership below comes from measured win rates [V] (`observed-values.md`). Tier boundaries, reward thirds, expiresIn cut-offs, and the affordability rule are design choices.

## Risk tier, from `probability`, easiest first

| Tier | Labels | Measured win rate |
|---|---|---|
| safe | Piece of cake, Sure thing | 100% |
| moderate | Walk in the park, Quite likely, Hmmm.... | 67–69% |
| risky | Risky, Gamble, Rather detrimental | 36–47% |
| deadly | Playing with fire, Suicide mission, Impossible | 0–25% |
| unknown | any label not in `observed-values.md` (neutral styling, CAP-9) | — |

The labels' wording doesn't match how hard they are. "Hmmm...." plays like "Walk in the park", and "Playing with fire" plays like "Suicide mission". The tier, not the label text, drives the visual cue. Sure thing's place in "safe" carries an unresolved contradiction (see `observed-values.md`).

## Reward rank, from `reward`

Rank is relative to the current board: the top third is high, the middle third is mid, and the bottom third is low. The display scales in weight (size, glow, or coin count). Reward doesn't track risk [V], so the two cues are shown independently.

## Urgency, from `expiresIn`

| expiresIn | Urgency |
|---|---|
| ≤ 1 | critical: strongest emphasis, such as a pulse |
| 2–3 | soon |
| ≥ 4 | normal |

## Shop affordability

An item with `gold ≥ cost` is affordable: it is active and highlighted. An item with `gold < cost` is muted and shows the shortfall. A visible indicator on the shop entry point shows when at least one item is affordable.
