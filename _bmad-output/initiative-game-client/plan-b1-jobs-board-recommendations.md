---
title: 'B1: jobs board recommendations, compact rows, icons and fonts'
type: 'feature'
ticket: ''
created: '2026-10-05'
status: 'draft'
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

**Problem:** The jobs board lists ads in API order as big text cards. Picking a good job means reading every one, a screen holds only a few, and nothing warns about bait ads (0 of 21 attempts won) or about steals that would trigger bait.

**Approach:**
- Port the job half of backend decision tree v3.4 into pure TypeScript.
- Render the board as compact rows: a risk icon, the measured win rate, the ad text clamped to two lines, the reward and the expiry, plus Best pick, Trap and state-risk badges.
- Ship the approved fonts and icons, and the credits line they require.

## Boundaries & Constraints

**Always:**
- Implement every job rule exactly as `recommendations.md` sections "Win rate per label", "Ad kinds" and "Jobs" specify (AD-4): integer maths, named constants that cite the findings, nothing hidden or disabled.
- The store owns `stateEstimate`: reset per game, updated in the same step as the `TurnRecord`, replaced by `state` on a reputation reading. The store also exposes a computed `rankedJobs` (AD-6, AD-7).
- Icons are the approved game-icons.net SVGs, stored in `src/assets/icons/`. Strip the black background path, and render them through a CSS mask filled with `currentColor`. No `v-html` (AD-17), and no new icon dependency.
- Fonts come from `@fontsource-variable/fredoka` and `@fontsource-variable/nunito` 5.3.0 (OFL), self-hosted via npm.
- The credits line names Lorc, Delapouite and Sbed, game-icons.net, and CC BY 3.0.
- Risk is never shown by colour alone: icon, label and percentage go together. Tier colours meet 3:1 contrast against the background.
- Each row is a single native `<button>` whose accessible name states the job and its odds.
- All text lives in `copy.ts`. Units are rem; viewport `@media` rules go only in `layout.css`.

**Never:**
- Shop recommendations, `purchases`, shelves, item icons or shop-tab hints (that's B2).
- `@lucide/vue` (no glyph needs it yet).
- Persisting the state estimate.
- New API calls.
- Changing the turn pipeline order.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Value sort | A mixed board, gold above the potion cost | Rows ordered by value, then win %, then expiry, then adId. The first row is Best pick. | No error expected |
| Bait | A bait ad on the board | Flagged as a trap, last in order, never Best pick. Every steal is flagged state-risk and sorted after the playable ads. | No error expected |
| State guard | `stateEstimate` −7, a steal on the board | The steal is flagged state-risk (−7 − 2 < −8) and sorted after the playable ads. | No error expected |
| Only steals | The guard is on and only steals remain | The steals stay playable, with no flag. | No error expected |
| Broke | Gold below the potion's cost | Best pick is the safest playable ad (tier, reward, expiry, adId). | No error expected |
| Unknown gold | `gold` is `null` | No broke exception; Best pick is the top value. | No error expected |
| Unknown label | An unlisted `probability` | The row shows "unknown odds" and sorts after the flagged steals, before the traps. | dev warn (CAP-9) |
| Unsolvable | `solvable: false` | The row sorts as unknown odds, its button is disabled, and it shows the existing note. | No error expected |
| Estimate | Successful infiltrate, then a failed steal, then a reputation reading with `state` −3 | +2, then unchanged, then −3. | No error expected |
| New game | `start()` or `load()` of another id | `stateEstimate` is 0. | No error expected |
| Empty board | No ads | No rows, and no Best pick. | No error expected |

</frozen-after-approval>

## Code Map

- `src/game/risk.ts` (new): `riskTier(probability)` (four tiers plus unknown) and `winPct(ad)`, from the `recommendations.md` table. This replaces nothing; `riskTier` isn't implemented anywhere yet. Use `warnUnlisted` from `src/game/warn.ts` on a miss.
- `src/game/recommendations.ts` (new):
  - `adKind`, `stateDelta`, `rankJobs({ stats, board, shop, stateEstimate }) → RankedJob[]`.
  - The potion's cost comes from the cheapest shop item whose `itemEffect` grants a life (`src/game/shop.ts`).
  - Mirror `backend/src/main/java/io/github/kevternal/dragonsofmugloar/npc/game/Strategy.java` (`playable`, `bestValue`, `SAFEST`, `value`) and `AdKind.java`. The deliberate difference: unknown-odds ads sort in their own group.
- `src/game/types.ts`: add `RankedJob`, plus `adKind` on the solve variant of `TurnInfo` if the store needs it.
- `src/stores/game.ts`:
  - `stateEstimate` ref; reset in `reset()`.
  - In `recordTurn`, a successful solve adds `stateDelta`; a reputation turn sets `stateEstimate = info.reputation.state`.
  - Computed `rankedJobs`.
  - `solve` already captures the ad before the `await`.
- `src/components/AdCard.vue`: replace with `JobRow.vue`. Keep the unsolvable note and its `aria-describedby`.
- `src/components/GameIcon.vue` (new): `name` prop mapped to an imported SVG URL, rendered as a `<span aria-hidden="true">` with `mask-image`.
- `src/assets/icons/`: these SVGs from github.com/game-icons/icons master (white fill, black square path removed):
  - `lorc/cake-slice`, `lorc/footprint`, `delapouite/rolling-dices`, `sbed/death-skull`;
  - `delapouite/two-coins`, `lorc/hourglass`, `lorc/heart-drop`, `lorc/trophy`, `sbed/level-four`;
  - `delapouite/person`, `lorc/crown`, `lorc/hood`.
- `src/views/AdsPanel.vue`: iterate `game.rankedJobs`, with a tighter list gap.
- `src/components/StatsBar.vue`, `ReputationPanel.vue`: a stat icon before each value (decorative; the labels stay).
- `src/main.ts`: import both fontsource packages.
- `src/styles/tokens.css`: `--font-display` (Fredoka) and `--font-body` (Nunito) with fallbacks; tier colours `--color-risk-safe|moderate|risky|deadly|unknown`; badge colours.
- `src/styles/base.css`: body and heading fonts.
- `src/copy.ts`:
  - `credits` with the authors and licence;
  - `jobs.*`: unknown odds, best pick, trap, state-risk, and the row's accessible-name template.
- `package.json`: add the two fontsource packages.
- Tests:
  - `src/game/__tests__/recommendations.spec.ts`, `risk.spec.ts`;
  - store cases in `src/stores/__tests__/game.spec.ts`;
  - `JobRow` cases in `src/components/__tests__/components.spec.ts` (role and name queries);
  - order and badges in `src/views/__tests__/game-flow.spec.ts`.
  - Don't remove existing coverage of the solve flow.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `src/main.ts`, `tokens.css`, `base.css`: fonts and tokens. Fonts first, so later visuals are judged in the real faces.
- [ ] `src/assets/icons/*`, `src/components/GameIcon.vue`: the icon pipeline.
- [ ] `src/game/risk.ts`, `src/game/recommendations.ts`, `src/game/types.ts`: the pure rules (AD-4).
- [ ] `src/stores/game.ts`: `stateEstimate` and `rankedJobs` (AD-6, AD-7).
- [ ] `src/copy.ts`: job texts and credits.
- [ ] `src/components/JobRow.vue` (delete `AdCard.vue`), `src/views/AdsPanel.vue`: compact rows (CAP-16).
- [ ] `src/components/StatsBar.vue`, `ReputationPanel.vue`: stat icons.
- [ ] Tests: one or more tests per I/O matrix row, written to fail when the rule breaks. Role and name queries only.

**Acceptance Criteria:**
- Given 1440×900 and a 12-ad board, the jobs view shows at least 8 rows without scrolling (today it shows about 4).
- Given 360×640, every row shows its risk icon, label, win %, reward and expiry without horizontal scroll.
- Given a screen reader on a row, the announced name includes the ad text, the label, the win % (or "unknown odds") and any badge.
- Given the built app, network requests for fonts go only to the app's own origin.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm test:unit --run`: all pass.
- `pnpm lint`: 0 errors.
- `pnpm build`: succeeds.

**Manual checks:**
- Browser at 1440×900 and 360×640 with the API mocked: the row counts and badges match the ACs, and the fonts render as Fredoka and Nunito.
