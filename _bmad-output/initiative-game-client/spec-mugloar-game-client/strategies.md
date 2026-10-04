# Strategies (CAP-16, CAP-17)

The player picks a strategy with the "Risk level" button-group switch. They can change it at any time; it takes effect immediately and costs no turn or request. Every new game starts on **Play it safe**. The choice is not saved between games.

All logic runs in the browser, from `risk-cues.md` and each ad's own fields. More advanced recommendations are left to an optional backend (see Non-goals).

## Risk level and expected reward

| Risk level | Tier (`risk-cues.md`) | Win rate used |
|---|---|---|
| 1 | safe | 1.0 |
| 2 | moderate | 0.7 |
| 3 | risky | 0.4 |
| 4 | deadly | 0.1 |
| — | unknown | none |

**Source:** each tier comes from measured win rates [V]. Collapsing each band to one number is a design decision; the user set 0.7 for level 2.

**Expected reward:** `expectedReward = reward × win rate`.

**Unknown labels:**
- They sort last under every strategy and show "unknown odds".
- They are ignored when judging the board.

## Configuration

Each strategy is defined by a single declarative object, and all strategies share one interface. Components read only the results of a strategy (the sorted jobs, critical health, the recommended item, the hint); they never branch on which strategy is active.

| Field | Play it safe | For Glory! |
|---|---|---|
| `sortBy` (applied in order; ties fall through to the next key) | `risk` ascending, `expectedReward` descending, `expiresIn` ascending | `notDeadly` (deadly last), `expectedReward` descending, `expiresIn` ascending |
| `criticalHealth` (lives ≤ this value means critical) | 2 | 1 |
| `increaseLevelAtRisk` (show the level hint when every measured job is at this risk level or higher) | 3, i.e. below 70% | 4, i.e. below 40% |
| `optimizeShopFor` | `'gold'`: recommend the cheapest affordable level item | `'turns'`: recommend the affordable item that gives the most levels (+2) |

## Rules

Jobs are only reordered. No strategy hides or disables a job.

`expiresIn` breaks ties only as a last resort.

**Critical health** (lives ≤ `criticalHealth`):
- the shop entry point is highlighted with "Low health";
- the healing potion is recommended.

**Level hint**, shown when every measured job on the board is at risk level `increaseLevelAtRisk` or higher and some level item is affordable:
- the shop entry point is highlighted;
- the level item chosen by `optimizeShopFor` is recommended;
- the hint text is in the tavern voice, and each level item has its own line, rotated (for example: *"The barkeep swears a sharper blade makes the work easier…"*);
- the hint text must never promise an outcome. Whether a higher level raises the win rate is unverified [U]: it is the user's hypothesis, and the A/B test was inconclusive (see the Open Questions in the spec).

**Assumption:** For Glory! using `'turns'`, and ignoring unknown-odds jobs when judging the board, were proposed by Claude, and the user did not object.
