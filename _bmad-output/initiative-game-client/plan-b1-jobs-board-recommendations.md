---
title: 'B1: jobs board recommendations, compact rows, icons and fonts'
type: 'feature'
ticket: ''
created: '2026-10-05'
status: 'built'
baseline_revision: '4b8080bdfbd872a44fb298ecaa36e217f4c90ac8'
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
- [x] `package.json`, `src/main.ts`, `tokens.css`, `base.css`: fonts and tokens. Fonts first, so later visuals are judged in the real faces.
- [x] `src/assets/icons/*`, `src/components/GameIcon.vue`: the icon pipeline.
- [x] `src/game/risk.ts`, `src/game/recommendations.ts`, `src/game/types.ts`: the pure rules (AD-4).
- [x] `src/stores/game.ts`: `stateEstimate` and `rankedJobs` (AD-6, AD-7).
- [x] `src/copy.ts`: job texts and credits.
- [x] `src/components/JobRow.vue` (delete `AdCard.vue`), `src/views/AdsPanel.vue`: compact rows (CAP-16).
- [x] `src/components/StatsBar.vue`, `ReputationPanel.vue`: stat icons.
- [x] Tests: one or more tests per I/O matrix row, written to fail when the rule breaks. Role and name queries only.

**Acceptance Criteria:**
- Given 1440×900 and a 12-ad board, the jobs view shows at least 8 rows without scrolling (today it shows about 4).
- Given 360×640, every row shows its risk icon, label, win %, reward and expiry without horizontal scroll.
- Given a screen reader on a row, the announced name includes the ad text, the label, the win % (or "unknown odds") and any badge.
- Given the built app, network requests for fonts go only to the app's own origin.

## Implementation Notes

- **Best pick with unknown odds.** The best pick is the first *playable* ad in display order. When no playable ad has known odds, that is the first unknown-odds one (soonest expiry, then adId), which is also what the backend reaches when every value ties at win rate 0. A left-out steal or a trap is never best.
- **Unknown-odds and trap groups** have no value, so they sort by expiry, then adId. A left-out steal with an unknown label sorts with the unknown odds but keeps its state-risk flag. Unsolvable ads sit in the unknown group with no flag.
- **`RankedJob`** also carries `tier` and `winPct`, so `JobRow` never re-derives them (and an unlisted label warns once per ranking, not per render). `risk.ts` adds `adRiskTier(ad)`: unsolvable ads are `unknown` without a second warning.
- **`stateDelta(message)`** goes by message prefix, as `AdKind.stateDelta(message)` does: bait worded "Steal …" is −2, and other bait follows its own prefix. The guard reads the steal delta from the same `STATE_DELTA` table.
- **Store:** `runTurn` takes an `effects(response)` callback returning `{ incrementTurn, stateChange }`, which `recordTurn` applies right after the log push. A reputation turn sets `stateEstimate = state`, and any other turn adds its change. `solve` captures `stateDelta(ad.message)` before the `await`. `stateEstimate` is exposed read-only, and `rankJobs` gets `gold`.
- **Row layout:** a container query (`@container job (min-width: 64rem)`, 640px at the 62.5% root [V, Chrome 2026-10-05]) puts the row on one line; narrower rows use two lines. No viewport `@media` outside `layout.css`.
- **Row name:** the button's content forms its name, with no `aria-label`. The odds line comes first in the DOM and on screen, and visually hidden parts from `copy.jobs` add "Solve: ", the tier word, the separators, " gold" and " turns left". Example: "Solve: safe, Piece of cake, 95%, Best pick. Escort the mayor. 80 gold, 4 turns left". The clamp lifts on hover and `:focus-visible`.
- **Unknown tier icon:** the approved set has no art for unknown, so it shows a "?" mark (decorative) next to the "unknown odds" text.
- **Tier colours:** each is at least 5.2:1 against bg, surface and the notice background (passes as text too).
- **Icons:** the 12 SVGs, fetched from game-icons/icons master on 2026-10-05, with `<path d="M0 0h512v512H0z"/>` removed. Vite inlines them as data URIs (under the 4 KB limit), so they add no requests.
- **Polish after user test (2026-10-05):**
  - **Rows:** the reward moved into the odds group, after the label and win %, before the badges; the expiry stays at the row end. Reward and expiry are 1.6rem, weight 700, in Fredoka. Wide rows have `--space-2`/`--space-3` padding. On narrow rows the expiry spans both lines, so it centres on the row. Measured in Chrome: the odds, reward, % and expiry centres coincide, with a 0px offset at 1440 and 360. The name now reads "Solve: safe, Piece of cake, 95%, 34 gold, Best pick. <ad>. 5 turns left".
  - **Mobile log:** I could not reproduce the reported state in headless Chrome. I tried 360×640 with taps, clicks, failures, long flavour lines, a focused log, and reputation and buy turns. Each time the region was 44px, the newest entry 42px, and its flavour visible. The fragile part was the 2px margin between them: any scroll set before a later resize, or browser scroll anchoring, would leave the newest flavour out of view. Fixes:
    - `.entries` sets `overflow-anchor: none`.
    - A `ResizeObserver` on the region and its list re-pins the collapsed log to the newest entry.
    - The flavour may wrap to 2 lines, with the action still clamped to 1. `--log-height-mobile` rose from 5.4rem to 7.4rem (three lines).
    - While collapsed, the newest `li` has `min-height: 100cqh` (the region is a size container), so its line sits at the top even when it is shorter than the region. The desktop grid reverts this.
  - **Credits:** unchanged. The user found that the Vue DevTools button was covering them.

## Plan Change Log

## Review Triage Log

Review pass 1 (2026-10-05). Lenses: quick, conformance, test-quality (61 mutations), accessibility, bugs-efficiency-readability, manual-browser (Chrome, mocked API). The browser run was repeated after a concurrent mutation run made the first pass unreliable; the tree was confirmed identical to the reviewed diff. Verdict counts: medium 7, low 12, false 1, rejected 6.

| # | Finding (lenses) | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | Icons vanish in forced-colors mode (a11y, browser) | medium | patch | Browser: 0 ink pixels, because `background-color: currentColor` is forced to Canvas. Fix: `forced-color-adjust: none` and `CanvasText` under forced colors. |
| 2 | The row `aria-label` overrides visible content: it adds "Solve:" that isn't visible, is 25–40 words long, and announces Best pick and Trap last (a11y, quick, bugs) | medium | patch | Fix: drop `aria-label` and build the name from content. Put a visually hidden "Solve" and units in the text, and place the odds and badges line before the message so the decisive cues come first. |
| 3 | The ad text is clamped with no way for sighted users to read the full text (a11y) | medium | patch | SC 1.4.10 and 1.4.12. Fix: unclamp on hover and `:focus-visible` of the row. |
| 4 | Readability: unbraced ifs; magic `group` numbers; placeholder rows mutated later; dense loss-cost expression; dead `?? 0`; mixed delta constants; `rankJobs` takes all of `Stats` but reads gold; two lookups per ad and three things named `winPct`; `recordTurn` writes the estimate twice; positional `runTurn`/`recordTurn` arguments; template ternary; dead `.trap` class; badge kind mismatch; container name; redundant `WebkitMaskImage`; duplicated badge tokens; exports used only by tests (conformance, bugs) | medium | patch | Verified by reading. The user requires code that reads like a book. |
| 5 | Tests stay green under mutations: playable-only loss cost, order inside the left-out-steal and trap groups, the `adId` tie-break in the expiry groups, the unknown-label steal flag, the safest-pick tier order, the only-steals winner, the circular loss-cost expectation, the store passing stats and shop, JobRow visible text and the tier icon mapping, non-role queries, unrealistic bait fixtures, garbled `risk.spec` titles (test-quality, quick) | medium | patch | Mutation evidence is listed by the lens. |
| 6 | At 360×640 only 4 rows fit: the credits wrap to 3 lines, and the long state-risk badge wraps the row (browser, a11y) | medium | patch | Bars measured 185+134 px. Fix: shorter credits and badge copy, still naming every author and the licence. |
| 7 | `warnUnlisted` repeats on every `rankedJobs` recompute (quick, conformance, bugs, browser) | low | patch | Fix: dedupe per field and value in `warn.ts`. |
| 8 | `stateDelta('bait')` is −2 for any bait, while Java goes by message prefix (quick, conformance) | low | patch | Fix: derive the delta from the message prefix, as Java does. |
| 9 | `value` is computed for traps, though the spec defines it for playable ads only (conformance) | low | patch | Fix: `null` for traps. |
| 10 | Inline "?" mark; dead `copy.ads.*` strings; "Solve" duplicated (quick, conformance) | low | patch | Fix: use copy, delete the dead keys. |
| 11 | Disabled rows lose their tier stripe through specificity (a11y) | low | patch | `button:disabled` (0,1,1) beats `.job`. |
| 12 | `ul` with `list-style: none` loses list semantics in Safari; the ranking isn't stated (a11y) | low | patch | Fix: `role="list"` and a visually hidden "best first" intro from copy. |
| 13 | Tier never appears in text (AD-15) (a11y, conformance) | low | patch | Fix: a visually hidden tier word in the name. |
| 14 | Badges have no border in forced colors; the hover contrast comment is stale (a11y, bugs) | low | patch | Fix: transparent border; update the comment to state a 5.1:1 floor. |
| 15 | `stateEstimate` is writable from outside the store (conformance, bugs) | low | patch | Fix: expose it read-only; drive the test through a reputation reading. |
| 16 | The AD-4 table doesn't list `tier`, `winPct` and `adRiskTier`; AD-14 allows no `em` (GameIcon) and doesn't say how to annotate container queries (conformance, a11y) | low | patch | Spine updated by the orchestrator: `em` allowed for icon sizing, container queries annotated at the 10 px root. |
| 17 | An unknown-odds ad versus Impossible gets a different best pick than Java (conformance) | low | rejected | The spec's deliberate group order; it differs only in a 0 % tie. |
| 18 | `lossCost` uses `Math.max(0, …)`, unlike Java (conformance) | false | rejected | Rewards are positive in every probe. |
| 19 | Fonts import every unicode subset (bugs) | low | rejected | `unicode-range` means only latin is fetched. |
| 20 | Font swap shifts layout (a11y) | low | rejected | Cosmetic; it needs metric overrides. |
| 21 | Credits name the authors collectively, not per icon (a11y) | low | rejected | Names all three authors plus the site and licence; meets CC BY. |
| 22 | The unsolvable row's name contains encoded text (a11y) | low | rejected | The text is visible too; there's nothing better to show. |

## Verification

**Results (2026-10-05):** `pnpm test:unit --run` passed 118 of 118 tests. `pnpm lint` reported 0 errors; the oxlint warnings are pedantic-rule noise of the kind already in the codebase. `pnpm build` succeeded. A headless Chrome run of `pnpm preview` with the API mocked showed: 1440×900, 12 of 12 rows visible (34px each); 360×640, no horizontal scroll and every row's icon, label, %, reward and expiry inside the viewport; fonts computed and loaded as Fredoka Variable and Nunito Variable; font requests only to the app origin.

**Commands:**
- `pnpm test:unit --run`: all pass.
- `pnpm lint`: 0 errors.
- `pnpm build`: succeeds.

**Manual checks:**
- Browser at 1440×900 and 360×640 with the API mocked: the row counts and badges match the ACs, and the fonts render as Fredoka and Nunito.

Patch verification (2026-10-05):
- **Checks:** tests 134/134 across 3 runs, lint 0 errors, build and prettier OK.
- **Browser re-check, mocked API:**
  - 12/12 rows visible at 1440×900, in the correct order, and the page doesn't scroll.
  - The clamp lifts on hover and on keyboard focus.
  - Forced-colors icons are visible (38–65% ink).
  - One unknown-label warning per load.
  - Accessible names are content-based, with the decisive cues first.
  - Three played turns re-rank correctly.
- **Remaining, accepted:**
  - At 360×640, 4 rows fit between the bars. The top bar (185 px) is now the limit; that's a layout follow-up.
  - On desktop the odds sit in their own column beside the message (the intended one-line wide row).
  - Accessible names carry a space before the separators, from flex-item text joining. Screen readers don't voice it; rejected as negligible.
