---
title: 'Iteration A: game screen layout, routed views, activity log'
type: 'feature'
ticket: ''
created: '2026-10-02'
status: 'built'
baseline_revision: '1f8d06b39d3bf2cb93064b9e91b23ac47d854b6a'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['quick', 'conformance', 'test-quality', 'accessibility', 'bugs-efficiency-readability', 'manual-browser']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-client/architecture-mugloar-game-client/architecture-mugloar-game-client.md'
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/spec-mugloar-game-client.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On desktop the player has to scroll the page to see the last turn and their reputation. Both panels are always visible, so the `/shop` route changes nothing. The single last-turn box loses history.

**Approach:**
- Rebuild `GameView` as a fixed-viewport grid on desktop and a sticky-bar page on mobile.
- Render the jobs board and the shop as separate child routes at every width.
- Replace `lastTurn` with an in-memory activity log.
- Move reputation into the top bar.
- Show the credits line on every screen.

## Boundaries & Constraints

**Always:**
- Follow the spine as updated 2026-10-02, in particular:
  - AD-7: `log: TurnRecord[]` and `seq`.
  - AD-10: routed `AdsPanel`/`ShopPanel`.
  - AD-14: grid rows `auto / minmax(0, 1fr) / var(--log-height) / auto`; mobile sticky top and bottom bars; the sticky preconditions; `scroll-padding-block`.
  - AD-15: `<section role="log" aria-live="polite">` around `<ol>`; set `scrollTop` instantly; `GameView` owns focus.
- Only the newest log entry shows its flavour line.
- Below the fixed grid (mobile), the log expands to about 40% of the viewport while focused (tap or Tab) and collapses on blur. User decision 2026-10-05, review finding 27.
- Log tokens: `--log-height: 10rem` and `--log-height-mobile: 5rem`.
- All player text goes in `src/copy.ts`.
- Use rem only. Only `layout.css` holds viewport `@media` rules.

**Never:**
- Strategies, hints, the Risk level switch, shop shelves or sorting (iteration B).
- Fonts or icons. The credits line keeps its current text until the icons iteration.
- Persisting the log.
- Adding new API calls.
- Changing the turn pipeline order.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shop route | `/game/g1/shop` at any width | Only `ShopPanel` is rendered. The nav Shop link has `aria-current="page"`. | No error expected |
| Ads route | `/game/g1/ads` | Only `AdsPanel` is rendered. | No error expected |
| Solve | Solve succeeds and the response carries `turn` 9 | The log appends `{ seq: n+1, turn: 9, kind: 'solve', … }`. That entry shows the API message as its flavour line, and the previous entry no longer shows one. The log scrolls to the end. | No error expected |
| Buy | Buy succeeds | The entry shows the item name and the gold and lives changes, with no flavour line. | No error expected |
| Reputation | Investigate | The entry has no success mark. The top bar shows the people, state and underworld values. | No error expected |
| Failed turn | The API call throws | No entry is appended. `error` is shown. | AD-5 |
| New game | `start()` or a `load()` of another id | `log` is `[]` and `seq` restarts. | No error expected |
| Reload | Mid-game page reload | The log is empty, because it isn't persisted. | No error expected |
| Ended game | `/game/g1/ads` while the store holds g1 as `over` | Redirects to `/game/g1/over`. | No error expected |
| Credits | Any route | The credits line is visible exactly once. | No error expected |

</frozen-after-approval>

## Code Map

- `src/game/types.ts`: rename `LastTurn` to `TurnRecord` (add `seq` and `turn: number | null`) and `LastTurnInfo` to `TurnInfo`.
- `src/stores/game.ts` (refactored on this branch):
  - `lastTurn` becomes `log`.
  - Add a `seq` counter, reset in `reset()`.
  - `recordTurn` appends. `turn` comes from the new stats.
  - Keep the guard helpers (`isCurrent`, `idleGameId`). They already gate turn actions on `playing` (AD-8).
- `src/components/LastTurn.vue`: replace with `ActivityLog.vue`.
- `src/components/ReputationPanel.vue`: compact top-bar layout. Keep its emit and props.
- `src/views/GameView.vue`: becomes the grid shell, containing:
  - a top bar: `StatsBar`, `ReputationPanel` and nav;
  - the loading and error lines;
  - `<div class="game-view"><RouterView/></div>`;
  - a bottom bar: `ActivityLog` and the credits line.

  It no longer imports the panels, and keeps both watches. `/over` (`isOver`) hides the top bar.
- `src/views/AdsPanel.vue`, `ShopPanel.vue`: drop the `active` prop; always render `<h1 tabindex="-1">`.
- `src/router/index.ts`:
  - `ads` and `shop` get their components.
  - The parent `/game/:gameId` gets `meta: { gameScreen: true }`.
- `src/App.vue`: render `<footer>` only when `!route.meta.gameScreen`, so the credits appear once. Keep the `afterEach` focus.
- `src/styles/layout.css`, `tokens.css`, `base.css`:
  - layout.css: the AD-14 grid and sticky rules.
  - tokens.css: the log tokens.
  - base.css: `html { scroll-padding-block }`. Never `overflow: hidden` on an ancestor; use `overflow-x: clip` where needed.
- `src/copy.ts`:
  - `lastTurn` becomes `log`, with an accessible label "Activity" and entry texts.
  - Add a `credits` key and reuse the footer text.
- Tests to update:
  - `src/stores/__tests__/game.spec.ts`: assertions on `lastTurn`.
  - `src/components/__tests__/components.spec.ts`: the `LastTurn` blocks.
  - `src/views/__tests__/game-flow.spec.ts` and `shop-panel.spec.ts`: they mount the panels with `active`.

## Tasks & Acceptance

**Execution:**
- [x] `src/game/types.ts`: the `TurnRecord`/`TurnInfo` types. This is the shared shape for the store and the log.
- [x] `src/stores/game.ts`: `log`, `seq`, the append in `recordTurn`, and the reset. Implements AD-7.
- [x] `src/copy.ts`: log and credits strings.
- [x] `src/components/ActivityLog.vue`:
  - one line per entry: `T{turn}`, a ✓/✗ mark (visually hidden text "succeeded"/"failed"), the action, and the gold and lives changes;
  - the newest entry also gets the flavour line;
  - watch `log.length`, then `nextTick`, then `scrollTop = scrollHeight`.

  Delete `LastTurn.vue`. Covers CAP-12 and AD-15.
- [x] `src/components/ReputationPanel.vue`: compact top-bar markup. Covers CAP-5.
- [x] `src/router/index.ts`, `src/views/AdsPanel.vue`, `src/views/ShopPanel.vue`: routed child views. Covers AD-10.
- [x] `src/views/GameView.vue`: the grid shell, plus focus on the panel `<h1>` when `pending` turns false and `document.activeElement` is `body`. Covers AD-14 and AD-15.
- [x] `src/App.vue`: footer suppressed on game routes.
- [x] `src/styles/*`: tokens, grid, sticky bars, `scroll-padding`. Covers CAP-15.
- [x] Tests: update the existing specs, and add specs for every I/O matrix row (store log semantics, `ActivityLog` rendering and newest-only flavour, routed views, credits once). The specs are the regression net.

**Acceptance Criteria:**
- Given a 1440 × 900 viewport on a game route, when the board has 8+ jobs and the log 20+ entries, then the page has no vertical scrollbar, the jobs view and the log each scroll on their own, and stats, reputation and the credits stay visible.
- Given a 360 × 640 viewport, when scrolling the jobs list, then the top bar stays pinned at the top, the log and credits stay pinned at the bottom, and a focused job button is never hidden under either bar.
- Given a screen reader, when a turn completes, then the new log entry is announced once.

## Implementation Notes

- Loading and error lines sit inside the top bar (`<header class="game-top">`), so the desktop grid keeps exactly four rows (placed by `grid-template-areas`, which also covers `/over` with no top bar) and errors stay visible while the view scrolls.
- Desktop: the bottom bar is `display: contents` from 48rem up, so the log and the credits line fill grid rows 3 and 4 directly.
- `scroll-padding-block` reads `--top-bar-height` / `--bottom-bar-height`. `GameView` measures the bars with `ResizeObserver` (in rem) because they wrap with content; the vars are removed on unmount.
- The after-turn focus rule only fires for actions that started while `playing`, so loading a game never moves focus.
- `ReputationPanel` now always shows the three rows, with "unknown" until investigated (CAP-5); `copy.reputation.none` was removed.
- `StatsBar` styles compacted (label and value inline) so both mobile bars stay under half of 360 × 640. This file was not in the Code Map.
- The log region has `tabindex="0"`: it scrolls and holds no controls, so keyboard users need to reach it.
- Log entries hide zero gold/lives changes. Lives use "life"/"lives" (CAP-12 example "−1 life"). An unknown turn shows "T?".

## Plan Change Log

## Review Triage Log

Review pass 1 (2026-10-02). Lenses: quick, conformance, test-quality, accessibility, bugs-efficiency-readability, manual-browser (Chrome, mocked API). Verdict counts: high 1, medium 10, low 9, false 2, maybe-false 2.

| # | Finding (lens) | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | The desktop page scrolls (AC1 fails). `.visually-hidden` spans are `position:absolute` with no positioned ancestor, so they escape `.game-view` and `.activity-log` (quick, browser) | high | patch | Browser: `scrollHeight` 2579 against 900; `position:relative` on `.game-view` gives 900. Fix: `position:relative` on both scrollers. |
| 2 | Reputation sits below the stats on desktop, not beside them (CAP-5) (conformance) | medium | patch | `.game-top` is a one-column grid at every width. Fix: put stats and reputation side by side from 48rem. |
| 3 | The after-turn focus watch keeps a stale `actionStarted` across a game switch, and double-focuses when a turn ends the game (bugs) | medium | patch | `load()` goes reset→beginLoading in one tick, so pending stays true→true. Fix: focus only when `status === 'playing'`. Braced and renamed. |
| 4 | The empty-state "none" text sits inside the live region and is re-announced on every new game (a11y, conformance) | medium | patch | AD-15: only entries change. Fix: move the empty state outside the `role=log` region. |
| 5 | Spoken log entries run together with no separators, e.g. "Turn 5succeededHelp…" (a11y) | medium | patch | Vue's whitespace condensing removes the spaces (compiled). Fix: add separators in the hidden texts. |
| 6 | On mobile, the newest entry's line is pushed out by its wrapping flavour line, and the action text is cut off with no way to read it (browser, a11y, conformance, quick) | medium | patch | Screenshot `mobile-360x640-mid.png`. Fix: let `.action` wrap, and scroll so the newest entry's top aligns to the region top. This still "jumps to the newest entry". |
| 7 | The mobile bars are at 49.3% of 360×640 and exceed half with unknown stats or an error line. Short viewports (landscape, zoom) let the bars cover the content, and the desktop grid collapses the view (browser, a11y, quick) | medium | patch | Measured 228+88px. Fix: a compact mobile top bar (reputation on one row), plus height-gated rules in layout.css (sticky only with min-height; desktop grid only with min-height). |
| 8 | The store sets `reputation` only after the board refetch, so the log shows the turn while the top bar shows stale values for up to about 7s (conformance) | medium | patch | Fix: set `reputation` when the turn is recorded. |
| 9 | Test quality: the focus test can't fail; the scroll test uses a constant `scrollHeight`; `onMounted` scroll, ±2 lives, reputation 0, `/over` hiding the top bar, the error alert, `seq` restart on load, the ResizeObserver path, and the Shop h1 `tabindex` are untested; a reload test is a tautology; there are class and tag queries (test-quality, conformance, quick) | medium | patch | Mutations stayed green (listed by the lens). Fix: rewrite or add the tests named. |
| 10 | Readability: unbraced ifs; `deltaText` twice per row; `isNewest` helper; `actionText` fall-through; `as TurnRecord` cast; `TurnInfo` infer trick; `formatDelta` dead branch and inline units; `reputationRows` per-field checks; watch inside `onMounted`; `measureBars` read/write interleave; jsdom-only guard; eager `document` lookup (bugs, conformance) | medium | patch | Verified by reading; the cast is removable (tsc). The user requires book-like code. |
| 11 | ✓/✗ glyphs are inline, not in `copy.ts` (conformance, quick) | low | patch | Direct move to `copy.log`. |
| 12 | Reputation button `min-height: 3.2rem` is a literal value, not a token (conformance) | low | patch | Fix: use a token. |
| 13 | Footer flashes on a cold deep link because the app mounts before `router.isReady()` (bugs, conformance) | low | patch | `main.ts` mounts first. Fix: `await router.isReady()`. |
| 14 | `.game-view` padding of 0.4rem is less than the 0.5rem focus outline reach (bugs, a11y) | low | patch | Fix: `--space-2`. |
| 15 | Heading order: the Reputation `h2` precedes the panel `h1`; `ShopItem` `h3` skips a level (a11y) | low | patch | Fix: name the reputation section with `aria-label` instead of a heading; make the `ShopItem` heading `h2`. |
| 16 | A reputation log entry doesn't speak the new values (a11y) | low | patch | Fix: action text includes the three values. |
| 17 | Dead `.panel` class (conformance) | low | patch | Delete it. |
| 18 | Empty top grid row gap on `/over` (bugs, conformance) | low | rejected | Cosmetic, rarely noticed, and the fix adds grid branching. |
| 19 | Route-change focus lives in `App.afterEach`, while AD-15 says `GameView` owns focus (conformance, a11y) | low | defer | The plan said to keep `afterEach`; it works (one `h1` per screen). The spine wording needs reconciling. |
| 20 | `measureBars` runs on desktop for nothing (bugs) | low | rejected | Harmless; the value is correct (0 or static). |
| 21 | `App` `afterEach` leaks a hook per test mount (bugs) | low | rejected | Production mounts once. |
| 22 | `actionStarted` is module-level and shared (bugs) | false | rejected | Top-level `let` in `<script setup>` is per-instance. |
| 23 | Two `GameView` instances clear each other's CSS variables (bugs) | false | rejected | No Transition or KeepAlive; unmount precedes the new mount. |
| 24 | Intermittent unit failures (async leak across tests) (quick) | maybe-false | defer | Seen twice in about 40 runs; the cause is unknown. Settled by repeated runs with `--sequence.shuffle` at the baseline and at HEAD. |
| 25 | A focus move in the same tick as the log update may cut off the polite announcement (a11y) | maybe-false | defer | Needs a real VoiceOver/NVDA check. |
| — | Pre-existing: `index.html` has `lang=""` and the title "Vite App"; the loading `role=status` is inserted together with its content (a11y) | — | defer | Not caused by this change. |
| — | The browser's shop mock used 11 items, including `wingpotmax` (browser) | — | note | No defect. |
| — | The Vue DevTools button covers the credits in dev (browser) | low | rejected | Dev-only. |

## Verification

**Commands:**
- `pnpm test:unit --run`: all tests pass.
- `pnpm lint`: 0 errors.
- `pnpm build`: succeeds.

**Manual checks (if no CLI):**
- `pnpm dev` at 1440 × 900 and 360 × 640 (devtools): check the three ACs above. Play about 5 turns against the live API, roughly 2 requests per turn.

Patch verification (2026-10-02):
- **Checks:** tests 72/72 across 5 runs, lint 0 errors, build ok.
- **Browser re-check, mocked API:**
  - Desktop 1440×900: `scrollHeight` 900 (was 2579). Stats and reputation side by side. The view and the log scroll independently. The newest entry is visible on 26/26 turns.
  - Mobile bars: 37.3% of the screen with unknown stats, 41.7% with known stats.
  - Short screens at 844×390 and 1024×500: the content stays usable.
  - 320 px: no horizontal scroll. Game over: ok. Console: clean.
- **Two new findings from the re-check:**

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 26 | The mobile focus ring tucks under the top bar by 0.41 px on Shift+Tab, because the scroll padding leaves no room for the ring | low | patch | Applied directly: `scroll-padding-block` adds `--focus-ring-reach`, and the ring width and offset are now tokens. |
| 27 | Mobile log: long ad messages now wrap to about 9 lines in a 40 px scroller, so the flavour line is never visible without scrolling the log | medium | intent_gap | Resolved by the user (option c, tap or focus to expand). The frozen intent is amended; it's applied in layout.css and tokens.css. |

Final browser check (v4, 2026-10-05):
- Tap-to-expand, the collapsed one-line clamps and desktop all pass.
- The collapsed flavour line was cut off by 2 px, so `--log-height-mobile` went from 5rem to 5.4rem. This is the smallest change that fits two clamped lines in the slim log. The frozen intent's 5rem was the user's "let's try" value.
