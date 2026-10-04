# Adversarial Review 2 — Architecture Spine, Mugloar Game Client (iteration 2)

- **Reviewed:** `architecture-mugloar-game-client.md` (status final, updated 2026-10-02). Focus: AD-4, AD-6, AD-7, AD-8, AD-10, AD-12, AD-14, AD-15.
- **Against:** spec kernel (CAP-12, CAP-15, CAP-16, CAP-17), `strategies.md`, `risk-cues.md`, `observed-values.md`, `api-contract.md`, `game-flow.md`.
- **Lens:** construct two units one level down that each obey every AD to the letter and still build incompatibly. Each pair is a hole; each hole gets a minimal (YAGNI/KISS) rule.
- **API calls made:** none. One local Node check of floating-point products (F4), marked [V local].
- **Provenance:** claims about browser behaviour that I did not test are marked [U]. Everything else is read directly from the spine or the spec.

## Verdict

**Not ready to build CAP-15 to CAP-17 as written. The iteration-1 core still holds.** Layering, the gateway, the turn pipeline order, persistence and the `load` rules survive the new features. The new surface has three high-severity holes:

1. **The desktop layout contradicts itself.** An unbounded log sits in an `auto` grid row, and "the routed view is the only scroll region". Together they squeeze the jobs and shop view to zero height after enough turns.
2. **`shopHint` is underspecified.** It is under-defined for unknown lives, empty or stale boards, item identity, ties and unaffordable items. Two correct builds recommend different items, and one of them flags "Low health" on a second device purely because `null <= 2` is `true` in JavaScript.
3. **Turn actions are never gated on `status === 'playing'`.** A game-over board reached through Back or a link still lets the player solve. That request 404s and moves a finished game into `expired`.

Medium-severity issues: sort determinism (including a [V local] floating-point tie bug), focus loss after each turn, list semantics in the live region, and an AD-14 vs AD-15 contradiction about `@media`.

| # | Severity | Seam | ADs |
| --- | --- | --- | --- |
| F1 | High | Desktop grid: unbounded log in an `auto` row vs "only scroll region" | AD-14, CAP-12, CAP-15 |
| F2 | High | `shopHint` semantics: unknown lives, vacuous board, item identity, ties, affordability | AD-4, AD-6, CAP-17 |
| F3 | High | Turn actions and controls not gated on `playing`; a finished game reachable at `/ads` and `/shop` | AD-7, AD-8, AD-10, AD-5 |
| F4 | Medium | `sortJobs`: unknown-tier internal order, final tie-break, float ties, duplicate `riskLevel` registry | AD-4, CAP-16 |
| F5 | Medium | Focus: owner, `tabindex`, initial load, focus lost on `disabled` and on solved-ad removal | AD-15, AD-8 |
| F6 | Medium | Live region: `<ol role="log">` drops list semantics, double announcements, how to scroll | AD-15, CAP-12 |
| F7 | Medium | AD-14 bans component `@media`; AD-15 requires `prefers-reduced-motion` media for animations | AD-14, AD-15 |
| F8 | Medium | Mobile sticky: what sticks, where, and the height budget at short viewports | AD-14, CAP-15, CAP-5 |
| F9 | Medium | Strategy state: `v-model` bypasses `setStrategy`; reset on reload or no-op `load` is implicit | AD-6, AD-7, CAP-16 |
| F10 | Low | `TurnRecord`: reputation has no success mark, `seq` source, ad text capture timing | AD-7, CAP-12 |
| F11 | Low | Shelf order vs hint tie-break, and three competing signals on the shop entry point | AD-4, CAP-4, `risk-cues.md` |
| F12 | Low | `/over` redirect: one-shot or reactive; who navigates on "play again"; GameView chrome while `over` | AD-9, AD-10 |

---

## F1 — High: the desktop grid starves the routed view

**Units:** `styles/layout.css` (AD-14) vs `ActivityLog` (AD-7: log "unbounded").

**How they diverge while complying:**
- AD-14: from 48rem the grid is `100dvh` with rows `auto / 1fr / auto`. "The routed view is the only scroll region; the page never scrolls."
- AD-7 and CAP-12: the log is append-only with no size limit.
- **Builder A** follows AD-14 literally and gives the log no `overflow`, because it may not scroll. The `auto` row grows by one entry per turn. Once the top bar plus the log exceed `100dvh`, the `1fr` row resolves to 0. The jobs board disappears around turn 15–25 on a 1440×900 screen. The exact turn depends on entry height. The page cannot scroll, so the content is unreachable. This violates CAP-15 ("only the jobs or shop view scrolls").
- **Builder B** bounds the log with `max-height` and `overflow-y: auto`. That breaks the AD-14 sentence "the routed view is the only scroll region".
- The same row problem hits the top bar. Stats, reputation, the Risk level switch and the nav share one `auto` row. At 48rem they wrap, and nothing bounds the row.

**Proposed rule (amend AD-14):**
> From 48rem: rows `auto / minmax(0, 1fr) / <log-height>`. `<log-height>` is a token, a fixed `rem` value capped at a fraction of `dvh`. Exactly two scroll regions exist: the routed view and the log list. Both use `min-height: 0; overflow-y: auto`. The top bar must not wrap beyond two lines at 48rem; it lays out with intrinsic `flex-wrap`, and this is checked manually as part of the CAP-8 checks.

Alternative, for the user to decide: put the log in a right-hand column at the desktop breakpoint (`grid-template-columns: 1fr <log-width>`). The log then gets full height without competing with the view.

---

## F2 — High: `shopHint` lets two correct builds disagree

**Units:** `game/strategies.ts` `shopHint` (builder A) vs `game/strategies.ts` `shopHint` (builder B). The callers are `stores/game` `hint`, the GameView nav and ShopPanel.

The signature `shopHint(strategy, stats, board, shop) → { kind, itemId: string | null } | null` with "critical health takes priority" leaves these choices open:

| Gap | Builder A | Builder B | Consequence |
| --- | --- | --- | --- |
| `stats.lives === null` (CAP-14 second device) | `stats.lives <= strategy.criticalHealth` | `lives !== null && lives <= …` | In JavaScript `null <= 2` is `true`, so A shows "Low health" on every second-device open. |
| Status `over` (lives 0) | critical hint | `null` | The over screen's nav (F12) says "Low health" on a dead dragon. |
| Board empty, all-unknown, or `boardStale` | `measured.every(...)` → `true` (vacuous) | needs ≥ 1 measured job | A recommends levelling on an empty or failed board, so the hint fires on unreliable data (AD-18). |
| Identity of "the healing potion" | `itemId === 'hpot'` | the shop item whose `itemEffect` is +1 life | They diverge if the registry changes. Hard-coding also bypasses AD-4 ("registries are the only mapping"). |
| Potion unaffordable (gold < 50) | `{ critical, itemId: 'hpot' }` | `{ critical, itemId: null }` or falls through to the level hint | A recommends a disabled item; B hides the reason. A level item can't be affordable when gold < 50 (all cost ≥ 100 [V]), so falling through returns `null`: the hint is lost entirely. |
| Potion missing from `shop` (shop fetch failed, `refreshShop()` pending) | `'hpot'` anyway | `null` | ShopPanel would badge an item that isn't on the shelf. |
| Gold unknown (`null`) | `affordability` `'unknown'` counts as affordable | doesn't count | The level hint shows on second devices for A only. |
| `'gold'` tie: five 100-gold items [V] | first in API order | lowest `id` | Different item, so a different `copy.ts` line (hint copy is keyed by item id). |
| `'turns'` with gold 100–299 (no +2 affordable) | `null` (strict reading: "the +2 item") | best affordable, which is +1 | Spec: "the affordable item that gives the most levels (+2)". Both readings are literal. |
| `'turns'` tie: five 300-gold items [V] | API order | `id` | As above. |
| What is a "level item" | `itemEffect(id).level > 0` | any item except `hpot` | They differ for an unregistered item (CAP-9: no recorded effect). |

There is also a spec conflict. `strategies.md` says the per-item hint lines are "rotated". The spine's Hint copy convention says the line is "deterministic" (keyed by item id). With a deterministic tie-break, `'gold'` always picks the same item, so nothing rotates.

**Proposed rule (amend AD-4 `shopHint` row; one rule set, one function):**
> `shopHint(strategy, { status, stats, board, boardStale, shop })`, where `shop` is already in shelf order (F11). It returns `null` unless `status === 'playing'`.
> 1. **Critical health:** `stats.lives !== null && stats.lives <= strategy.criticalHealth` → `{ kind: 'critical-health', itemId }`. `itemId` is the first shop item whose `itemEffect` grants a life, or `null` if the shop has none. Affordability doesn't matter: the item shows its shortfall (AD-8). This result is final and never falls through.
> 2. **Increase level:** only when `!boardStale`, at least one board ad has a non-null `riskLevel`, every such ad has `riskLevel ≥ strategy.increaseLevelAtRisk`, and `affordability(gold, cost).state === 'yes'` (never `'unknown'`) for at least one *level item* (`itemEffect` level > 0). Pick from the affordable level items in shelf order. `'gold'`: the lowest cost, first on the shelf. `'turns'`: the most levels, then lowest cost, then first on the shelf. If only +1 items are affordable, `'turns'` picks a +1 item.
> 3. Otherwise `null`. Type: `{ kind: 'critical-health'; itemId: string | null } | { kind: 'increase-level'; itemId: string } | null`.
>
> Then settle the copy conflict, for the user to decide. Either "rotated" means one line per item id (amend `strategies.md`), or the spine rotates lines by `seq` or turn. A deterministic-per-item rule is the KISS choice.

---

## F3 — High: the turn pipeline runs on a finished game

**Units:** `AdsPanel` and `ShopPanel` (control state) vs `stores/game` `solve` and `buy` (AD-7/AD-8 guards) vs the router (AD-10).

**How they diverge while complying:**
- AD-8 guards actions only on `pending`. AD-18 adds `boardStale`, and AD-3 adds `solvable`. Nothing gates on `status`.
- AD-10: `/game/:id/ads` and `/shop` are child routes. `load` is a no-op when the store holds that id as `over`, which keeps the board and the shop in memory.
- **Path:** game over → `/over` → browser Back → `/game/X/ads`. Every rule is satisfied, the board renders, and solve is enabled. `solve()` returns 404 [V for finished games on `GET messages`; [U] for solve], which is "inconclusive" (AD-5). Step 7 refetches messages and gets 404, so status becomes `expired`. AD-5 calls `append(expired: true)`, which is deduplicated by `gameId` (harmless). GameView then routes to `/` with the *expired* notice, for a game that ended normally.
- Builder B instead disables solving on `status !== 'playing'`. That is undocumented, so the two builds behave differently.

**Proposed rule (amend AD-8 and AD-10):**
> Turn actions (`solve`, `buy`, `investigateReputation`) and `refreshMessages` return immediately unless `status === 'playing'`. Their controls render `disabled` under the same condition. When the store holds the game as `over`, `/game/:id/ads` and `/game/:id/shop` replace to `/game/:id/over`. GameView's existing `status` watch already does this. Make it `immediate`, so it also covers entry by Back.

---

## F4 — Medium: `sortJobs` is not deterministic across builds

**Units:** `game/strategies.ts` sort-key registry vs the `sortJobs` comparator, built independently.

1. **Order inside the unknown group.** "Unknown risk always last" doesn't say how unknowns are ordered among themselves. Their `expectedReward` is `null`. A: `null` compares as `-Infinity`, so unknowns are ordered by `expiresIn`. B: unknowns stay in API order.
2. **Unknown handled per key or as a prefix.** If a builder folds "unknown last" into the keys, Glory's `notDeadly(ad)` computes `riskLevel !== 4`, which is `true` for `null`. Unknowns then sort *above* deadly ads, against the spec. The spine says "always last" but doesn't say *where* that rule lives.
3. **Final tie-break.** The last key is `expiresIn`. Equal rows keep input order (`Array.prototype.sort` is stable), and input order is whatever the API returned on this refetch. After each turn, equal jobs swap places. `rewardRanks` already ends its tie-break with `adId`; `sortJobs` doesn't.
4. **Floating-point false ties [V local, Node 2026-10-02].** With win rates 1.0/0.7/0.4, `4 × 0.7 = 2.8` but `7 × 0.4 = 2.8000000000000003`. Of reward pairs in 1–1000 across levels 1–3, 250 should tie and don't. Under For Glory! (where `expectedReward` compares across levels), the moderate ad loses a tie it should pass on to `expiresIn`.
5. **Two registries for one fact.** AD-4 lists `riskTier(probability)` and `riskLevel(probability)` as separate functions. A builder may give each its own label map, and the two maps can drift (CAP-9's whole concern).

**Proposed rule (amend AD-4):**
> `riskLevel(p) = TIER_LEVEL[riskTier(p)]`: one label table, with the level derived from the tier. Win rates are integer percentages (100/70/40/10), and `expectedReward` compares `reward × pct` as an integer (it displays as `/100` if ever shown). `sortJobs` partitions the board into known and unknown. Known ads are sorted by `strategy.sortBy`, then by `adId` ascending. Unknown ads are appended, sorted by `reward` descending, then `expiresIn` ascending, then `adId`. Sort keys are called only with known-risk ads, so they never see `null`.

---

## F5 — Medium: focus has no owner, and every turn may drop it

**Units:** `router/` (an `afterEach` focus hook) vs each panel's `onMounted` focus, plus AD-8 ("every action control renders `disabled`") vs AD-15 ("visible focus").

- **Owner.** AD-15 says "Focus moves to the new `<h1>` on route change" and nothing more. A puts it in `router.afterEach`; B puts it in each panel's `onMounted`. Combined, focus runs twice. Neither says whether focus moves on the *initial* load or reload, where moving it skips the top bar, or for redirects (`/game/:id` → `/ads`).
- **`tabindex`.** An `<h1>` isn't focusable without `tabindex="-1"`. A builder who leaves it out gets a silent no-op `focus()`.
- **Focus lost each turn.** The player activates a solve button. AD-8 disables it while `pending`. Browsers may move focus to `<body>` when the focused element becomes disabled [U, not tested here]. After the refetch, the solved ad leaves the board and the list re-sorts, so the button no longer exists in either case. A keyboard player starts from the top of the page each turn. Builders will each invent their own recovery, or none.

**Proposed rule (amend AD-15):**
> GameView owns focus. On a route change *after* the first navigation, it focuses the routed panel's `<h1>` (`tabindex="-1"`) in `nextTick`. Panels never call `focus()`. After a turn action, if the previously focused control is no longer in the DOM or is disabled, GameView focuses the active panel's `<h1>`.

Alternative: keep the controls focusable during `pending` with `aria-disabled="true"`, relying on the store guard. This changes AD-8's "renders `disabled`" and is for the user to decide.

---

## F6 — Medium: live-region semantics and scrolling

**Units:** `GameView` (AD-15: "always renders the activity log as `<ol role="log">`") vs `ActivityLog` (a component that renders the list) vs any result display for CAP-3.

- **`role` on `<ol>`.** An explicit `role="log"` replaces the list role, so the `<li>` children lose their list context. That breaks AD-15's own "collections are `<ul>/<li>`" rule. The exact screen-reader impact is [U].
- **Who renders the `<ol>`.** AD-15 says GameView renders it, and the seed lists an `ActivityLog` component. A puts the `<ol>` in GameView with `v-for` over records; B puts it in ActivityLog. Both work, but tests querying by role then target different units.
- **Double announcement.** CAP-3 requires the client to show the solve message and its success. A builder adds a result toast with `role="status"`, and the log entry also announces. The player hears every turn twice.
- **Scrolling.** "Scrolls to the end instantly" doesn't say how. A uses `lastLi.scrollIntoView()`. Below 48rem that also scrolls the *page* (F8), so the player loses their place on the board every turn. B sets `logEl.scrollTop = logEl.scrollHeight`, which scrolls only the log.

**Proposed rule (amend AD-15):**
> `ActivityLog` renders `<section role="log" aria-label="…">` around a plain `<ol>`. It is always mounted, and only its `<li>` children change. It scrolls by setting its own `scrollTop`, never with `scrollIntoView`. The log is the only live region for turn results. The only other live region is the single error/notice region (`role="alert"` for `error`, `role="status"` for board notices).

---

## F7 — Medium: AD-14 and AD-15 contradict on `@media`

**Units:** `AdCard` (urgency pulse) vs `styles/layout.css`.

- AD-14: "Only the global layout stylesheet contains `@media` queries. Components … never their own `@media`."
- AD-15: "Animations, such as the urgency pulse, are inside `@media (prefers-reduced-motion: no-preference)`."
- A puts the pulse keyframes in AdCard's scoped style inside the media query, which breaks AD-14. B moves the pulse into the global stylesheet, which breaks the "`<style scoped>` per SFC" convention and spreads AdCard's styling across two files.

**Proposed rule (amend AD-14):**
> The ban covers viewport-size queries (`width`, `height`, `orientation`) only. User-preference queries (`prefers-reduced-motion`, and later `prefers-color-scheme`) are allowed in components.

---

## F8 — Medium: mobile sticky layout is under-specified

**Units:** `GameView` template structure vs `styles/layout.css`.

- **What sticks.** AD-14 says "the stats bar is sticky at the top". AD-10 puts stats, reputation, the Risk level switch and the nav in GameView's top bar. CAP-5 places reputation below the stats on mobile. A makes the whole top bar sticky (on a 360×640 screen that is roughly a third of the viewport). B makes only `StatsBar` sticky, so the nav scrolls away. Neither is wrong.
- **Where sticky works.** `position: sticky; bottom: 0` works only while the element's containing block extends past the viewport. If B wraps the log in its own container (for example a `<footer>` holding only the log), it never sticks. The rule needs the DOM placement.
- **Height budget.** Sticky top plus a sticky bottom log with "a bounded height" has no stated bound. On a phone in landscape (about 640×360, below 48rem) the two can cover most of the viewport.

**Proposed rule (amend AD-14):**
> Below 48rem only `StatsBar` and the log are sticky. Both are direct children of the game screen's root container. Stats wrap to at most two lines. The log's height is a token capped at a fraction of `dvh` (for example `min(14rem, 30dvh)`). The Risk level switch and the nav are in normal flow.

---

## F9 — Medium: strategy state, mutation path and reset

**Units:** `RiskLevelSwitch` + `GameView` vs `stores/game`.

- **Mutation bypass.** A setup store exposes `strategyId` as a writable ref. GameView binds `<RiskLevelSwitch v-model="game.strategyId">`. That is legal under AD-1 (the view reads stores) and assigns directly, bypassing `setStrategy` (AD-7 "state changes only inside these actions"). Nothing enforces AD-7, and it matters because B adds behaviour inside `setStrategy` (for example a dev log or, later, persistence), which A silently skips. The same applies to every exported ref.
- **Reset semantics.** AD-6 says "reset by `start()` and `load()`", and AD-10 says `load` can be a no-op. Does a no-op `load` reset? It is harmless today, because the no-op only fires when the switch hasn't been used yet. A reload mid-game *does* reset to Play it safe, because the strategy isn't in the save (AD-12). CAP-16 says it "resets on each new game", so a reset within the same game is an unstated consequence, not a decision.

**Proposed rule (amend AD-6 and AD-7):**
> The store returns state as `readonly` (or as computed getters). Views bind `:model-value` plus `@update:model-value="game.setStrategy"`. `strategyId` resets to `'safe'` exactly when the state is replaced (`start()`, or `load()` of a different `gameId` or from a save). A no-op `load` leaves it alone. A reload therefore returns to Play it safe; state this, or add `strategyId` to the save (user decision).

---

## F10 — Low: `TurnRecord` details

**Units:** `game/apply-turn` (builds records) vs `ActivityLog` (renders them).

- **Reputation has no success mark.** CAP-12 says *each* entry shows "a success or failure mark". The `reputation` variant has no `success`. A renders a check mark; B renders nothing. Add `success: true` to the variant, or state that reputation entries show a neutral mark.
- **`seq` has no owner.** It isn't in AD-6's state list. A uses `log.length + 1`; B adds a counter. Pick `seq = log.length` at append time, since the log is append-only and reset per game.
- **When ad text is captured.** `adMessage` must be read from the board *before* the `await`. AD-18 retries and other-tab play can replace the board before step 5. State it in AD-7 step 2: "snapshot the previous stats and the action's display text".
- Otherwise, the type matches CAP-12. It stores all deltas, the component shows gold and lives, the solve flavour `message` is the subheading, and buy has no flavour text [V: buy response has no `message`].

---

## F11 — Low: shelf order, hint order and the shop entry signals

**Units:** `ShopPanel` (CAP-4: "items cheapest first") vs `shopHint` (F2 tie-breaks) vs the GameView nav.

- No AD says where or how the shelf is sorted, or how equal-cost items are ordered. If the hint's tie-break differs from the shelf's, the recommended item isn't the first affordable one on the shelf, so the hint looks arbitrary.
- The shop entry point carries three signals: "at least one item affordable" (`risk-cues.md`), "Low health" and the level-hint highlight. Which one wins, and whether the affordable indicator is computed in the view (`anyAffordable`) or the store, is open. AD-15 also doesn't list the hint among things to convey in text.

**Proposed rule (amend AD-4 and AD-6):**
> `game/sortShop(items)` sorts by cost ascending, then API order. The store holds `shop` already sorted, and `shopHint` consumes that order. The nav entry shows at most one emphasis, in this order: critical-health, then increase-level, then affordable. Each is conveyed in text (`copy.ts`), not by colour alone.

---

## F12 — Low: `/over` redirect and "play again"

**Units:** `GameOverView` vs the router vs `start()`.

- AD-10: "`/over` … if the store doesn't hold that game as `over`, it redirects to `/`." It doesn't say whether that check runs once (a guard) or reactively (a `watch`). "Play again" calls `start()`, which resets state first (AD-7), so `gameId` becomes `null` while the route is still `/game/OLD/over`. A reactive builder redirects to `/` mid-start and unmounts GameOverView before it can navigate to the new game. A guard-based builder doesn't.
- Who navigates after `start()` resolves isn't stated for GameOverView. StartView's path is implied.
- GameOverView renders inside GameView, so stats, the switch, the nav and the hint stay visible on the over screen. With F2 unfixed, that includes "Low health" at 0 lives.

**Proposed rule (amend AD-9 and AD-10):**
> The `/over` check is a one-shot route guard. "Play again" `await`s `start()` and then calls `router.replace('/game/<newId>/ads')`. The caller of `start()` always owns that navigation. While `status === 'over'`, GameView hides the Risk level switch and the ads/shop nav.

---

## Checks that hold

- **Strategy configuration** matches `strategies.md` field for field (`sortBy`, `criticalHealth` 2/1, `increaseLevelAtRisk` 3/4, `optimizeShopFor`). The "components never branch on strategy id" rule is stated in both documents.
- **One owner for derived advice.** `sortedBoard` and `hint` are store computeds (AD-6), so the nav and ShopPanel can't disagree, once F2 fixes the function itself.
- **`setStrategy` vs `pending`** (AD-7/AD-8) is consistent: it makes no API call, and re-sorting during a solve is safe, because the action captured `adId` and `gameId`.
- **Persistence:** AD-12 excludes the strategy and the log from the save, which matches the spec's non-goals. The reload consequence is in F9.
- **Routing:** the child routes, the `load`-once watch and the no-op rule (AD-10) hold for ads↔shop switches. Only the `over` edges (F3, F12) leak.
- **`dvh` fallback** (`100vh` then `100dvh`) is sound for the CAP-8 browser range per the cited compat data.
