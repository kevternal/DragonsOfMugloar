---
title: 'B2: shop recommendations, compact shelves, buy feedback, item icons'
type: 'feature'
ticket: ''
created: '2026-10-05'
status: 'ready-for-dev'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/recommendations.md'
  - '{project-root}/_bmad-output/initiative-game-client/architecture-mugloar-game-client/architecture-mugloar-game-client.md'
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/design-assets.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- The shop is a column of large text cards with no advice. The player can't see what they are low on, which +2 item to buy next, or that +1 items are a waste.
- After a buy, nothing on screen shows what changed.

**Approach:**
- Port the shop half of tree v3.4: a potion at 1 life, and the least-bought +2 item under the step 4–6 conditions.
- Render the shop as compact rows on cheapest-first shelves. Each row has an item icon, its effect, an owned count, and a Buy next / Low on lives / Not worth it badge.
- Show the result of every buy on the bought row and on the stats, and give the Shop tab the matching hint.

## Boundaries & Constraints

**Always:**
- Implement the shop rules exactly as `recommendations.md` "Shop (CAP-17)" specifies (AD-4):
  - `recommendItem` and `itemAdvice` in `src/game/recommendations.ts`, reusing B1's playable/tier logic;
  - integer maths and named constants that cite the findings;
  - unknown lives or gold means no recommendation.
- The store owns `purchases` (successful buys per item id): reset per game, incremented in the same step as the `TurnRecord`, never persisted. It exposes a computed `recommendedItem` (AD-6, AD-7).
- Shelf order is `shelfOrder` (cost ascending, then API order). A shelf plank is drawn between cost groups.
- The rows are compact: all 11 items are visible at 1440×900 without scrolling.
- Each item is one native `<button>` whose content forms its accessible name, with the decisive cues first:
  - the name;
  - the effect;
  - the cost;
  - any badge;
  - the owned count.

  An unaffordable item stays disabled and its shortfall is linked by `aria-describedby` (AD-8).
- **Buy feedback:** after a successful buy, the bought row shows its effect (e.g. "+2 levels", "+1 life") in an always-present `role="status"` region, until the next action starts. The changed stat in `StatsBar` is emphasised for the same period. Any motion goes inside `prefers-reduced-motion: no-preference`. A failed buy says so in tavern voice.
- **Shop tab hint:**
  - "Low on lives" at 1 life, even when the potion is unaffordable.
  - Otherwise "Level up" when a +2 item is recommended.
  - Text, not colour alone.
- **Icons:** the approved item icons (`design-assets.md`), stored in `src/assets/icons/`, rendered with `GameIcon`. Pick one icon for `wingpotmax` from Lorc, Delapouite or Sbed (e.g. `delapouite/fairy-wings`), and record it in `design-assets.md` as an implementation choice.
- The credits keep naming every author used.
- Tavern-voice copy, all in `copy.ts`, never promising an outcome.
- rem units, tokens, braced ifs.

**Never:**
- Auto-buying.
- Persisting `purchases`.
- New API calls; the shop list is fetched once (AD-13).
- Grouping shelves by effect.
- `v-html`.
- `@lucide/vue`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Low on lives | Lives 1, gold ≥ 50 | The potion gets "Low on lives"; the Shop tab says "Low on lives". | No error expected |
| Broke at 1 life | Lives 1, gold < 50 | Nothing is recommended; the Shop tab still says "Low on lives"; the potion is disabled with its shortfall shown. | No error expected |
| 2 lives, no safe ad | Lives 2, gold 350, no safe playable ad | The least-bought +2 item gets "Buy next"; the tab says "Level up". | No error expected |
| Proactive | Lives 3, gold 400, some playable ad not safe | The least-bought +2 item gets "Buy next". | No error expected |
| All deadly | Lives 2+, gold 350–399, all playable ads deadly | The least-bought +2 item gets "Buy next". | No error expected |
| No reason | Lives 3, gold 400, every playable ad safe | Nothing is recommended. | No error expected |
| Rotation | `ch` bought twice, the rest once | "Buy next" moves to the first other +2 item in shelf order. | No error expected |
| +1 item | Any state | "Not worth it" is shown on cs, gas, wax, tricks and wingpot. | No error expected |
| Unknown stats | `lives` or `gold` is null | No recommendation and no tab hint. | No error expected |
| Successful buy | Buying `rf` succeeds | Owned ×1; the row status says "+2 levels"; the level stat is emphasised; the log entry is appended. | No error expected |
| Failed buy | `shoppingSuccess: false` | The count is unchanged; a failure status is shown on the row. | No error expected |
| New game | `start()`, or `load()` of another id | `purchases` is empty and the counts are hidden. | No error expected |

</frozen-after-approval>

## Code Map

- `src/game/recommendations.ts`:
  - add `recommendItem({ lives, gold, board, shop, purchases, stateEstimate })` and `itemAdvice(itemId)`;
  - add or export `shelfOrder` (AD-4 table);
  - reuse B1's playable set, tiers and `cheapestPotion`;
  - mirror `Strategy.decide` steps 3–6 and `levelItem` in `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/Strategy.java`.
- `src/game/types.ts`: `ItemRecommendation`, `ItemAdvice`.
- `src/stores/game.ts`:
  - a `purchases` ref, reset in `reset()`, incremented in `recordTurn` on a successful buy, through the B1 `effects` options object;
  - a computed `recommendedItem`;
  - expose `purchases` read-only;
  - the buy result for the status is derived from the last `TurnRecord` (`log` already holds kind, success and deltas), so no new state is needed.
- `src/components/ShopItem.vue`: rewrite as a compact row: icon, name, effect, cost, badge, owned count, a status slot, and the shortfall note.
- `src/views/ShopPanel.vue`:
  - render `shelfOrder(game.shop)` with planks between cost groups;
  - one tavern flavour line under the `h1`;
  - pass the recommendation, the advice, the owned count, and the last buy result.
- `src/views/GameView.vue`: Shop nav link hint from `recommendedItem` and lives. `src/components/StatsBar.vue`: an emphasis prop for the stat just changed by a buy.
- `src/assets/icons/`: these SVGs from game-icons/icons master, with the black square path removed:
  - `delapouite/health-potion`, `lorc/claw-slashes`, `delapouite/jerrycan`, `delapouite/metal-plate`, `delapouite/secret-book`, `lorc/standing-potion`;
  - `lorc/crossed-claws`, `lorc/rocket`, `lorc/breastplate`, `delapouite/spell-book`;
  - the chosen `wingpotmax` icon.

  Register them in `GameIcon.vue`.
- `src/copy.ts`: `shop.flavour`, badges (`buyNext`, `lowOnLives`, `notWorth`), `owned(n)`, buy results (`+N levels`, `+1 life`, failure), and the nav hints. Reuse `copy.log.units` plurals.
- `_bmad-output/initiative-game-client/spec-mugloar-game-client/design-assets.md`: record the `wingpotmax` icon.
- Tests:
  - `src/game/__tests__/recommendations.spec.ts`: every matrix row, with literal values and realistic shop ids.
  - store cases;
  - `ShopItem` and `ShopPanel` component tests (role and name queries; badges, counts, shortfall, status);
  - game-flow: the tab hint and buy feedback.
  - Keep the existing shop retry tests.

## Tasks & Acceptance

**Execution:**
- [ ] `src/game/recommendations.ts`, `types.ts`: the pure shop rules (AD-4).
- [ ] `src/stores/game.ts`: `purchases` and `recommendedItem` (AD-6, AD-7).
- [ ] `src/assets/icons/*`, `GameIcon.vue`, `design-assets.md`: the item icons.
- [ ] `src/copy.ts`: shop texts.
- [ ] `src/components/ShopItem.vue`, `src/views/ShopPanel.vue`: compact shelves with buy feedback (CAP-4, CAP-17).
- [ ] `src/views/GameView.vue`, `src/components/StatsBar.vue`: the tab hint and the stat emphasis.
- [ ] Tests: one or more per matrix row, written to fail when the rule breaks.

**Acceptance Criteria:**
- Given 1440×900, the shop shows all 11 items without scrolling the view.
- Given 360×640, every item row shows its icon, name, effect, cost and badge without horizontal scroll.
- Given a screen reader, a buy announces its result once, and each row's name starts with the item name.
- Given forced colors, item icons stay visible.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm test:unit --run`: all pass.
- `pnpm lint`: 0 errors.
- `pnpm build`: succeeds.

**Manual checks:**
- Chrome at 1440×900 and 360×640 with the API mocked (scripts in the session scratchpad `browser/`): item count, badges per scenario, buy feedback, forced colors.
