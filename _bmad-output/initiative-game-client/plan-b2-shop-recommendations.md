---
title: 'B2: shop recommendations, compact shelves, buy feedback, item icons'
type: 'feature'
ticket: ''
created: '2026-10-05'
status: 'built'
baseline_revision: 'c472c5632a82c617328adeab541851ad40b0d484'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['quick', 'conformance', 'test-quality', 'accessibility', 'bugs-efficiency-readability', 'manual-browser']
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
- [x] `src/game/recommendations.ts`, `types.ts`: the pure shop rules (AD-4).
- [x] `src/stores/game.ts`: `purchases` and `recommendedItem` (AD-6, AD-7).
- [x] `src/assets/icons/*`, `GameIcon.vue`, `design-assets.md`: the item icons.
- [x] `src/copy.ts`: shop texts.
- [x] `src/components/ShopItem.vue`, `src/views/ShopPanel.vue`: compact shelves with buy feedback (CAP-4, CAP-17).
- [x] `src/views/GameView.vue`, `src/components/StatsBar.vue`: the tab hint and the stat emphasis.
- [x] Tests: one or more per matrix row, written to fail when the rule breaks.

**Acceptance Criteria:**
- Given 1440×900, the shop shows all 11 items without scrolling the view.
- Given 360×640, every item row shows its icon, name, effect, cost and badge without horizontal scroll.
- Given a screen reader, a buy announces its result once, and each row's name starts with the item name.
- Given forced colors, item icons stay visible.

## Implementation Notes

- **Rules (`recommendations.ts`):** `recommendItem` mirrors `Strategy.decide` steps 3–6 with named constants (`LOW_LIVES`, `GOLD_TWO_LIVES_PLUS2`, `GOLD_PROACTIVE_PLUS2`, `GOLD_DEADLY_PLUS2`, `LEVELS_WORTH_BUYING`) citing the findings. It reuses B1's `playableJobs`, label tiers (via a new `toJobs` helper shared with `rankJobs`) and `cheapestPotion`. Unknown odds count as "not safe" for step 5, as `Risk.Tier.UNKNOWN != SAFE` in the backend. The least-bought tie-break walks `shelfOrder`, as the spec says; the backend uses API order, which is the same for the live shop (all +2 items cost 300 [V]).
- **`shopHint(lives, gold, recommendation)`** is a small extra pure function in `recommendations.ts`, so the tab rule ("Low on lives" at 1 life even when broke; unknown stats mean no hint) is tested in `game/` and `GameView` only renders it. New types: `ItemRecommendation`, `ItemAdvice`, `ShopHint`. `itemAdvice(itemId)` takes the id, per this plan (the spine's table says `itemAdvice(item)`).
- **Store:** `purchases` is incremented in `recordTurn` through a new `boughtItemId` field on the `effects` object, exposed read-only, reset in `reset()`. `recommendedItem` is a computed.
- **Deviation, buy result:** "until the next action starts" cannot be derived from the log alone (a failed next action appends nothing, and the buy's own board refetch runs while `pending` is still true). The store therefore keeps one small ref, `actionStartSeq` (the log `seq` when the latest action started, set by a new `beginAction()` used by every turn and retry), and exposes a computed `lastBuy`: the last `TurnRecord` if it is a buy appended after that point. Not persisted; reset with the game. `ShopPanel` matches it to a row by `itemName` (the AD-7 record has no item id; names are unique in the live shop [V]).
- **Rows (`ShopItem.vue`):** one native button whose content forms the name: "Rocket Fuel, +2 levels, 300 gold, Buy next, owned 1" (visually hidden separators and " gold"; the visible "Owned ×1" is `aria-hidden` and spoken as "owned 1"). Wide rows (container ≥ 64rem = 640px at the 10px root) are one line: icon, name, effect, badge, owned, cost, then a side column holding the `role="status"` result and the shortfall note (outside the button, linked by `aria-describedby`). Narrow rows use two lines. The list is capped at 88rem so the shelves stay readable on wide screens. At most one badge: Low on lives / Buy next for the recommendation, else Not worth it on +1 items.
- **Effects** read "+2 levels" / "+1 life" through `formatDelta`, whose units gained `level` (reusing `copy.log.units`). The success status uses the buy's deltas, falling back to the item effect when stats were unknown.
- **Stat emphasis:** `StatsBar` takes `emphasis` (level for a +2/+1 item, lives for the potion); an outline plus tint (an outline, not a transparent border, so forced colors don't draw it on every stat), with a small pop animation only under `prefers-reduced-motion: no-preference`. The bought row's status fades in under the same query.
- **Icons:** 11 SVGs fetched from game-icons/icons master on 2026-10-05, background square removed; `wingpotmax` uses `delapouite/fairy-wings`, recorded in `design-assets.md`. Credits unchanged (all authors were already named). New tokens: `--color-shelf`, `--color-stat-changed`, `--color-stat-changed-bg`.
- **Test change:** the existing focus test found the buy button by the name "Buy"; rows are now named by the item, so it looks for "Healing potion".
- **Review fixes (triage rows 1–10, 2026-10-05):**
  - Rows have no live region now. Their result text stays visible, and the log speaks the buy once. Buy log entries add the level change, e.g. "Bought Rocket Fuel, +2 levels, −300 gold".
  - Store-owned derivations: a `shopHint` computed (`shopHint(lives, recommendation)`, no gold), and `lastBuy` as a plain ref. `lastBuy` is set in `recordTurn` and cleared in `beginAction()` (every turn and retry) and `reset()`. The buy `TurnRecord` carries `itemId`; rows match by it, and `purchases` counts from it, so the `boughtItemId` effect is gone. `ShopItem` derives `itemAdvice` itself.
  - `raisedStat(deltas)` in `game/shop.ts` drives both the row status and the `StatsBar` `changed` stat. The item effect stands in only when the delta is absent; a delta of 0 shows `copy.shop.boughtNoChange`.
  - Rows show a visible "Buy" next to the cost (`aria-hidden`), and the name ends with ", buy (costs one turn)".
  - Narrow rows let the badge and owned count wrap (`.tags`). Wide columns are `minmax(min, max-content)`. The wide breakpoint is now 72rem, to make room for the cue.
  - Copy: one `LOW_ON_LIVES` string, one top-level `copy.separator` (shop, nav and job rows), and `copy.units`. The badge copy is keyed by reason, plus `notWorth`.
  - Rules: named lives constants (`TWO_LIVES`, `MIN_LIVES_LEVEL_UP`), spec step numbers 1–4, and plain predicates. The `leastBoughtPlus2` docblock names the shelf-order versus API-order difference.
  - Tests: every listed surviving mutation now fails. `LIVE_SHOP` and `liveItem` live in `src/__tests__/stub-api.ts`. The icon test checks that the registered icons and the files match.
  - **Open:** the frozen matrix row "Unknown stats" says unknown gold means no tab hint. Without a gold parameter, 1 life with unknown gold now shows "Low on lives"; the tests pin this. Lives being known makes that true, but a human should confirm the matrix wording.

## Plan Change Log

## Review Triage Log

Review pass 1 (2026-10-05). Fresh lenses: quick, conformance, test-quality (87 mutations on a scratch copy, 13 survived, 6 of them equivalent), accessibility, bugs-efficiency-readability, manual-browser (no defects). Verdict counts: medium 6, low 9, rejected 3.

| # | Finding (lenses) | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | Every buy is announced twice: once by the row's `role=status` and once by the log; the 11 status regions break AD-15 "only live region" (quick, a11y) | medium | patch | Fix: drop the row live regions (the status text stays visible, not live). Buy log entries also show the level change, so a level gain is still spoken once. This amends CAP-12's "gold and lives only" for buys; recorded in the spec. |
| 2 | `GameView` calls `shopHint` itself, breaking AD-6; `ShopPanel` derives `itemAdvice` per row (quick, conformance, bugs) | medium | patch | Fix: the store exposes a computed `shopHint`; `ShopItem` derives `itemAdvice` itself, and the `advice` prop goes. |
| 3 | The buy result is matched by `itemName`; `actionStartSeq` is an indirect trick with a wrong comment (conformance, bugs) | medium | patch | Fix: add `itemId` to the buy `TurnRecord`; replace `actionStartSeq` with a plain `lastBuy` ref set in `recordTurn`, cleared in `beginAction` and `reset`. |
| 4 | "Which stat a buy raised" is written twice (`GameView.changedStat`, `ShopItem.changedText`) and already disagrees; a level delta of 0 shows a false "+2 levels" (quick, conformance, bugs) | medium | patch | Fix: one `raisedStat(deltas)` helper in `game/shop.ts`. Fall back to the item effect only when the delta is absent. |
| 5 | The shop row has no action verb in its name or visibly; there is no visible cue that the row buys (conformance, a11y) | medium | patch | Fix: a visible "Buy" next to the cost, and a hidden trailing "buy (costs one turn)". The name still starts with the item name (AC). |
| 6 | Tests stay green under mutations: potion before the playable-ad check; shelf versus API tie order; the affordable filter; potion detection by effect and the cheapest tie; `stateEstimate` feeding the shop; retries clearing `lastBuy`; status taken from deltas; rows disabled while pending; 1-life cases for steps 5 and 6. Fixtures are unrealistic: a buy costs a life, failed buys report level 0. Titles show `[object Object]`; a leaked `console.warn` spy; class and text queries in `ShopPanel` (quick, test-quality, conformance, bugs) | medium | patch | Mutation evidence listed by the lens. |
| 7 | 320 px: the owned count can overflow into the cost column; text spacing overflows the fixed wide columns (a11y) | low | patch | Estimate, not measured. Fix: let owned and badge wrap; use flexible columns. |
| 8 | Bare lives literals 2 in steps 4–6; Java step numbers versus spec step numbers; the tie-break comment claims to mirror Java (conformance, bugs) | low | patch | Fix: named constants; spec numbering; a docblock clause naming the shelf-order difference [V, every +2 costs 300]. |
| 9 | Duplicate copy: "Low on lives" twice, two `', '` separators; `level` placed in `log.units`; `BadgeKind` translation layer; the `recommended` prop name; `effect` naming; template class logic; ShopPanel per-row template calls; emphasis naming drift; mangled nav markup; brittle icon count assertion; the shop list copied into 4 specs; curried `isTier` (bugs, conformance) | low | patch | Verified by reading. |
| 10 | `shopHint` takes `gold`, which is only null-checked (bugs) | low | patch | Removed along with the move into the store. |
| 11 | The spine doesn't list `lastBuy`, `shopHint` or `beginAction`, and has the `itemAdvice(item)` signature; the `design-assets.md` `wingpotmax` row lacks a tag and is in the wrong section (conformance) | low | patch | The orchestrator updates the spine and design-assets. |
| 12 | Disabled unaffordable items are out of the Tab order (a11y) | low | rejected | AD-8 mandates `disabled`; the shortfall stays readable in browse mode. |
| 13 | Item names are no longer headings (a11y) | low | rejected | The list and buttons navigate fine; one `h1` per screen still holds. |
| 14 | `recommendedItem` and `rankJobs` repeat the playable computation (bugs) | low | rejected | Negligible at ~10 ads (YAGNI). |

## Verification

**Results (2026-10-05):** `pnpm test:unit --run` passed 211 of 211. `pnpm lint` reported 0 errors (oxlint warnings are the existing pedantic-rule noise). `pnpm build` succeeded; prettier clean.

**Browser (Chrome via playwright-core, `pnpm preview`, API mocked; script `browser/b2.mjs` in the session scratchpad):**
- 1440×900: 11 of 11 rows fully visible (34px each), the view and page don't scroll, also with a shortfall note on every row and after a buy.
- Badges per scenario: proactive (3 lives, 900 gold, a Gamble ad) gives Buy next on Claw Honing and "Shop, Level up"; after buying it, Owned ×1, status "+2 levels", Level emphasised, and Buy next moves to Rocket Fuel; after the next action (a solve) the status and emphasis clear. 1 life/60 gold: potion "Low on lives", tab "Low on lives". 1 life/20 gold: no badge, potion disabled with "You need 30 more gold.", tab still "Low on lives". 3 lives/200 gold: no hint. A failed buy shows the tavern failure line on the row.
- Accessible names (CDP): "Healing potion, +1 life, 50 gold"; "Claw Honing, +2 levels, 300 gold, Buy next"; link "Shop, Level up" (Chrome inserts a space before each separator, as in B1).
- 360×640 and 320×640: no horizontal scroll; every row's icon, name, effect, cost and badge inside the viewport.
- Forced colors (light and dark): item icons keep 30–64% ink; the emphasised stat is outlined.
- Reduced motion: no animation on the stat or the status.
- No console errors or warnings; no non-API foreign requests; one shop GET per game.

**Commands:**
- `pnpm test:unit --run`: all pass.
- `pnpm lint`: 0 errors.
- `pnpm build`: succeeds.

**Manual checks:**
- Chrome at 1440×900 and 360×640 with the API mocked (scripts in the session scratchpad `browser/`): item count, badges per scenario, buy feedback, forced colors.

Orchestrator follow-up (2026-10-05): removing `gold` from `shopHint` made 1 life with unknown gold show "Low on lives", which contradicts the frozen matrix row "Unknown stats: no tab hint". Restored in the store computed (no hint while gold is null); the game-flow row now expects "Shop".
