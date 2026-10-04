# Rubric review: architecture-mugloar-game-client spine

- **Reviewer:** independent rubric reviewer (no edits made to the spine)
- **Date:** 2026-10-01
- **Inputs:** the spine, its `.memlog.md`, the spec kernel plus `api-contract.md`, `observed-values.md`, `risk-cues.md`, `game-flow.md`, `design-assets.md`, and the brownfield `frontend/` (package.json, .oxlintrc.json, eslint.config.ts, tsconfig*.json, vite/vitest config, src/).
- **Live API:** not called.

## Verdict

**The spine is not ready yet. It needs one more pass on the load and lifecycle rules.** The paradigm, layering, single gateway, store ownership, call budget, and units rules are sound. They respect YAGNI and KISS, and they ratify the brownfield template: by-type folders, `__tests__/*.spec.ts`, kebab/Pascal filenames, setup stores, and `@` alias are all consistent with `.oxlintrc.json`, `eslint.config.ts`, and `tsconfig.app.json`. The weak area is the game lifecycle, where AD-5, AD-9, AD-10, AD-12, and AD-13 interact:

- As written, the game-over screen will usually show "expired" instead of the final score.
- Switching tabs can refetch data, which breaks the call budget.
- A restored save is never checked against the API.
- A possibly-benign 404 deletes the save.

AD-3 also contradicts CAP-9. Several CAP-6/CAP-12 derivations and the a11y and security rules leave room for build units to diverge.

## Checklist summary

| Check | Result |
| --- | --- |
| Fixes the real divergence points | Mostly. Gaps: load idempotency, how stats are merged for fields missing from a response, CAP-6 derivations beyond tier, the LastTurn label snapshot, breakpoint mechanics, and the "start" double-submit guard. |
| Every rule is enforceable and prevents its divergence | Partly. AD-1, AD-14, and AD-16 state outcomes but no mechanism. AD-10 as worded *causes* a bug instead of preventing one. |
| Nothing in Deferred lets units diverge | Yes. One note: deferring e2e leaves CAP-8 verification without an owner (see F-17). |
| Ratifies the brownfield code | Yes. Minor items are listed under F-19. |
| Covers CAP-1..12 and the constraints | CAP-9 is contradicted (F-2). CAP-7 and CAP-11 are broken by rule interaction (F-1, F-4). CAP-6 is only partly covered (F-8). The "start once" part of CAP-1 is unguarded (F-9). |
| Every dimension decided, deferred, or open | Missing: an untrusted-content/XSS rule, browser targets, the a11y conformance target and reduced motion, saved-game retention, and an Open Questions section. |
| Fact tags | Used well (AD-6, AD-11, AD-14). One overclaim (F-20). |

## Findings

### F-1 — critical — AD-10 × AD-9 × AD-13: "entering any `/game/:gameId/*` route calls `load`" breaks game over and the call budget

- **Problem:**
  - AD-9 clears the save on game over, and then `GameView` replaces the route with `/game/:id/over`. AD-10 says entering *any* `/game/:gameId/*` route calls `load(gameId)`. With no save, `load` fetches messages. A finished game returns 404 on `GET messages` [V, api-contract], so `load` sets status `expired`. The end screen therefore shows "expired" instead of the final score and turn, which breaks CAP-7.
  - Reloading `/over` hits the same path. CAP-7 data survives only in the high-score entry.
  - Taken literally, switching `/ads` ↔ `/shop` re-enters a `/game/:gameId/*` route. That triggers `load`, which (with or without a save) refetches messages and shop. This contradicts AD-13, which allows the shop to be fetched once per game, and allows messages only on load and after turns.
  - AD-10 handles "gameId differs from the store's" but never says what `load` does when the gameId is the same.
- **Fix:**
  - Make `load(gameId)` idempotent: when `store.gameId === gameId` and status ∈ {`playing`, `over`}, it is a no-op. Call it from a `beforeEnter` or watch on the `:gameId` param only, not on child-route changes.
  - Exclude `/game/:gameId/over` from `load`. `GameOverView` reads the final score and turn from `useHighScoresStore` by `gameId`, which is persisted and survives reload. If there is no entry, it redirects to `/`.
  - State this in AD-10 and AD-9, and add `over` to the AD-10 route table note.

### F-2 — high — AD-3: "Undecodable ads are dropped (spec constraint)" contradicts CAP-9 and mis-cites the spec

- **Problem:**
  - The spec has no drop rule. CAP-9 says an ad with an unlisted `encrypted` value *still renders*, with neutral styling and a dev warning. AD-3 attributes a rule to the spec that the spec does not contain, and the rule produces the opposite behaviour.
  - AD-4's dev-warn rule covers only the probability and item-effect registries, not the `encrypted` registry. A `decodeAd` author has no instruction to warn.
- **Fix:**
  - Replace the rule with: "`decodeAd` handles `null`/1/2. Any other `encrypted` value yields an `Ad` with `decoded: false`, the raw text shown, tier `unknown`, its solve control disabled (the true adId is unknown), and a dev `console.warn` naming `encrypted` and the value."
  - Move the `encrypted` scheme table into the AD-4 registry list, so there is one registry rule.

### F-3 — high — AD-5: every mid-game 404 is treated as "game expired", which can wipe a live save

- **Problem:**
  - The response to solving an already-expired ad is [U] (api-contract). If that response is a 404, AD-5 sets the game to `expired` and clears the save, even though the game is alive.
  - A wrong path from a coding bug ("Cannot GET", 404) is also indistinguishable from an expired game.
  - AD-5 also leaves open whether the save is cleared in the mid-game case: "also status `expired`" is ambiguous about clearing.
- **Fix:**
  - On `not-found` from solve or buy, confirm by calling the free `GET messages` once. Only a 404 there means `expired`. Otherwise treat it as a retryable `error` and show the refreshed board, which AD-7 already refetches. This costs one free call, only on the 404 path, so it stays within AD-13.
  - State explicitly that `expired` clears the save in both cases.

### F-4 — high — AD-10 restore path skips the API, contradicting AD-13, CAP-11, and game-flow

- **Problem:**
  - AD-10 says that when a save exists, `load` restores it. It does not say whether messages are fetched. AD-13 says "Messages are fetched on `load`". `game-flow.md` says "Boot → Turn: saved game, *API accepts gameId*".
  - Build units can diverge: one restores the stale board and never validates, another fetches.
  - Without a fetch, a game that expired while idle (5 to about 40 minutes [V bounds]) shows as playable until the first action fails.
  - CAP-11 also says that a rejected save leads to "the start screen is shown". The spine shows an `expired` status inside the game route instead, and never says which screen renders it.
- **Fix:**
  - AD-10: "Restore restores stats, shop, reputation, and lastTurn from the save, then always fetches messages (free). That fetch is the validity check and the fresh board."
  - Decide where `expired` renders. Either redirect to `/` with a notice ("That game has ended or expired"), which matches the CAP-11 wording, or record it as a deliberate deviation from the spec.

### F-5 — medium — AD-7 / AD-11: the rule for merging stats when a response omits a field is implicit, and the reputation turn is undefined

- **Problem:**
  - Response field sets differ:
    - Solve has no `level`.
    - Buy has no `score`.
    - Reputation returns no stats, yet consumes a turn [V].
  - "Merge the response stats" plus "`null` until the next response that carries the field" leaves two divergence points:
    - Does a missing field keep its prior value? (It should.)
    - After reputation, is `turn` incremented locally (+1), kept, or set to `null`? CAP-12 requires the summary to show how `turn` changed for reputation.
- **Fix:**
  - Add to AD-7: "Fields absent from a response keep their previous value. `investigateReputation` increments a known `turn` by 1 locally, tagged [V: consumes one turn] in a code comment, and the next solve or buy response overwrites it."

### F-6 — medium — AD-7 / CAP-12: `lastTurn` does not say what "the action" holds

- **Problem:** After a turn the board is refetched, and the solved ad is usually gone. If `lastTurn` stores only `adId`, LastTurn cannot show "which ad". One unit may look the id up in the board while another snapshots it. A reload makes this worse.
- **Fix:** Define `LastTurn = { kind: 'solve' | 'buy' | 'reputation'; label: string /* ad message or item name, snapshotted before the call */; success: boolean | null; message: string | null; deltas: Partial<Record<'lives'|'gold'|'score'|'level'|'turn', number>> }` in `game/`, and state that it is persisted.

### F-7 — medium — AD-14: "breakpoints declared once" cannot be enforced with `<style scoped>` per SFC

- **Problem:**
  - CSS custom properties cannot be used inside `@media` conditions.
  - With no preprocessor and no PostCSS custom-media plugin, any component that needs a media query has to repeat the raw `48rem`, which the rule forbids.
  - The rule therefore either blocks responsive components or gets broken quietly.
- **Fix (the user picks):**
  - (a) Only the global layout stylesheet may contain `@media`. Components adapt through intrinsic layout (flex-wrap, grid `auto-fit` with `minmax`) or `@container` queries with token widths.
  - (b) Adopt `@custom-media` through Vite's built-in Lightning CSS (`css.lightningcss.drafts.customMedia`) or `postcss-custom-media`, declared once in `styles/breakpoints.css`.
  - Option (a) is the KISS/YAGNI choice.

### F-8 — medium — AD-4: only the tier and the item effect have a single home; the other CAP-6 derivations do not

- **Problem:**
  - `risk-cues.md` defines four derivations: reward rank (thirds of the *current board*), urgency cut-offs (≤1 / 2–3 / ≥4), affordability with shortfall, and the "at least one affordable" shop-entry indicator. AD-4 assigns none of them.
  - Each card could compute these its own way. Reward rank is especially at risk, because it needs the whole board and an AdCard cannot compute it alone. Ties and boards whose size is not divisible by 3 are also unspecified.
  - Base64 decoding of latin-ext text: `atob` returns a binary string. Whether the payload is UTF-8 is [U]. Implementers will differ.
- **Fix:**
  - Extend AD-4 so that `game/` owns `riskTier(probability)`, `urgency(expiresIn)`, `rewardRanks(ads) → Map<adId, 'high'|'mid'|'low'>` (with the tie and remainder rule stated), and `affordability(gold, cost) → { affordable, shortfall }`.
  - Views or stores compute board-relative ranks once and pass them as props.
  - `decodeAd` decodes base64 with `TextDecoder('utf-8')` over the bytes, with a test fixture, and this is tagged [U] until a non-ASCII encrypted ad is seen.

### F-9 — medium — AD-8: the guard covers only turn-consuming actions, so `start` and unaffordable buys are unguarded

- **Problem:**
  - CAP-1 requires `game/start` to be called *once*. A double click on Start creates two games, because older games are not ended [V], and both calls are wasted.
  - Buying with `gold < cost` still costs a turn [V: buy consumes a turn even when it fails], and every buy with gold ≥ cost succeeded [V]. The spine does not say whether the unaffordable buy control is disabled. ShopItem authors will diverge, and an enabled control wastes a turn and an API call.
- **Fix:**
  - Extend AD-8 to `start`: it uses the same `pending` guard.
  - Add: "A buy control is disabled when `gold` is known and `< cost`. The control shows the shortfall in text, and the reason is exposed through `aria-describedby`."

### F-10 — medium — AD-1: the import graph omits real edges and has no enforcement

- **Problem:**
  - The diagram has no `views → game` edge, but views must import domain types (`Ad`, `ShopItem`) to pass typed props, and may need `rewardRanks`.
  - `router/` and `App.vue` are absent, so "nothing else" makes `router → views` illegal.
  - Nothing enforces the rule. Neither `.oxlintrc.json` nor `eslint.config.ts` has a restricted-imports setup.
- **Fix:**
  - Add the edges `views → game` and `router → views` (and `router → stores` if a guard calls `load`), and place `App.vue` with views.
  - Offer the user an enforcement option: ESLint `no-restricted-imports` overrides per folder (for example, `src/components/**` cannot import `@/stores/*` or `@/api/*`; `src/game/**` cannot import `vue`, `pinia`, or `@/api/*` except `import type`). Per the user's memory note, present this as a choice, not a mandate.

### F-11 — medium — Missing rule: API text is untrusted content

- **Problem:** Ad messages are free-form third-party text, some of it base64 or ROT13 decoded. Nothing forbids `v-html`. One component rendering through `v-html` would be an XSS vector.
- **Fix:** Add a short AD or convention: "API strings are rendered only by text interpolation. `v-html` is forbidden." It can be enforced by `vue/no-v-html` (an eslint-plugin-vue rule, not in `flat/essential`; the user decides whether to enable it).

### F-12 — medium — AD-15: accessibility gaps where retrofitting is expensive

- **Problem:**
  - No conformance target is named, so contrast for tier colours is unbounded.
  - The risk-cues "pulse" for critical urgency has no `prefers-reduced-motion` rule.
  - The `aria-live` region has to stay in the DOM before content changes, or screen readers miss the first announcement. If LastTurn is rendered with `v-if`, the announcement is lost.
  - Icon-only buttons (Lucide) need accessible names.
  - "Each screen has one `<h1>`" is ambiguous for `GameView` with the ads and shop children. Is the h1 in the parent or in each child?
- **Fix:**
  - Target WCAG 2.2 AA, including 4.5:1 text contrast and 3:1 for non-text cues.
  - Animations are gated by `@media (prefers-reduced-motion: no-preference)`.
  - The live region is rendered unconditionally in `GameView`, and only its content changes.
  - Icon-only controls have `aria-label`, and decorative icons have `aria-hidden="true"`.
  - Each child panel (ads, shop) owns the `<h1>`. `GameView` holds `<main>`, the stats, and the live region.

### F-13 — medium — AD-16: "A test that reaches the network fails" has no mechanism

- **Problem:** `vitest.config.ts` has no `setupFiles`, and jsdom plus Node 22/24 provide a real global `fetch`. A store test that forgets to stub will call dragonsofmugloar.com for real.
- **Fix:** Add `src/test-setup.ts`, registered in `vitest.config.ts` `test.setupFiles`, that does `vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unstubbed fetch in test') }))` in a `beforeEach`. Tests override it per case. Name the file in the Structural Seed.

### F-14 — low — AD-12: wording contradiction and unbounded saved-game growth

- **Problem:**
  - "Each store writes its state" and "Only the game store state is persisted" contradict each other. The intended meaning is "of the game store, `pending` and `error` are excluded".
  - Games expire after 5 to about 97 minutes [V bounds], but `mugloar:vN:game:<id>` keys are never pruned unless the player revisits that URL. `status` persistence is also unspecified: `loading` must never be restored.
  - "Invalid shape" has no designated validator.
- **Fix:**
  - Reword the rule.
  - Store `savedAt` in each save, and prune game saves older than 24h on app boot.
  - Persist `status` only as `playing`.
  - Give `game/` one `parseSave(unknown): Save | null` that does the shape check.

### F-15 — low — AD-7 / state diagram: `restart` semantics diverge from the spec and game-flow

- **Problem:** CAP-7 says "Restart starts a fresh game (CAP-1)", and `game-flow.md` has `GameOver → Loading`. The spine's diagram has `over → idle`, which returns to the start screen. These are two different UXs.
- **Fix:** Pick one and state it in AD-7. Either `restart()` resets and calls `start()` (matches the spec), or the deviation is recorded.

### F-16 — low — AD-5 / AD-7: recovering from a retryable error is unspecified

- **Problem:**
  - After a network failure in `load`, status stays `loading` with an `error`, and no action is named for retrying or dismissing it.
  - After a lost solve response, the turn may have been consumed on the server. Stats are briefly stale, and the next response heals them.
- **Fix:**
  - State that retry means re-invoking the same action from an explicit user control, never automatically (consistent with AD-13).
  - State that the error clears at the start of the next action.
  - Note that stale stats self-heal.

### F-17 — low — Deferred e2e leaves CAP-8 verification without an owner

- **Problem:** CAP-8 requires no horizontal scroll at 360 and 1440 px across Chrome, Firefox, Safari (macOS and iOS), and Edge, current and previous majors. jsdom cannot verify layout. The browser target is also never named; Vite 8's default build target is assumed, not stated.
- **Fix:** Add a Deployment/Operations line: "CAP-8 is verified manually per release with a checklist (360 / 1440 px, listed browsers)." Also state "Vite default build target accepted" as a decision, or set `build.target` explicitly.

### F-18 — low — Expired games and high scores (CAP-10)

- **Problem:** A game that expires while idle with a known score is never "finished" by the client rule, so its score is silently lost from the high scores. This is a product decision the spine does not make.
- **Fix:** Add it as an Open Question, or decide it: "On `expired`, if `score` is known and > 0, append it once (AD-9 dedupe applies), flagged `expired: true`."

### F-19 — low — Brownfield housekeeping not mentioned

- **Problem:**
  - `src/App.vue` and `src/__tests__/App.spec.ts` assert "You did it!" and will fail once App becomes a `RouterView` shell.
  - `package.json` has no `packageManager` field, so "pnpm per lockfile" is not pinned.
  - The new dependencies (`@lucide/vue`, the fontsource packages) are listed in Stack but are not yet in `package.json`. That is fine for a spine, but say "to add".
- **Fix:**
  - One line in the Structural Seed: "App.vue becomes `<RouterView>`, and App.spec is rewritten."
  - Optionally add `packageManager`. The user decides.

### F-20 — low — Fact-tag precision

- **Problem:** AD-6 says `highScore` "is always 0 [V]". The evidence is "0 in every probe game" (8+ games). "Always" overclaims the observation.
- **Fix:** Change it to "was 0 in every probe game [V 2026-10-01]".

### F-21 — low — No Open Questions section

- **Problem:** The checklist requires every dimension to be decided, deferred, or an open question. Several items above (F-15, F-18, the base64 encoding, the expired-ad solve response) are open, and the spine has nowhere to put them.
- **Fix:** Add an `## Open Questions` section with these items, each tagged [U].

## What is good (keep)

- Rejecting FSD and a `GameApi` port follows YAGNI, and the reasons are recorded in the memlog.
- Raw DTOs in `api/` plus decoded domain types at the store boundary (AD-2, AD-3) is a clean seam.
- AD-11 (stats can be `null`) correctly models the verified absence of an endpoint that reads stats.
- AD-13 matches the spec's call-budget constraints exactly. AD-14 correctly cites Media Queries 4.
- The Deployment section correctly names the SPA-fallback requirement for deep links.
