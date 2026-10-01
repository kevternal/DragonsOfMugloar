---
title: 'Core game loop: start, board, solve, shop, reputation, last turn, game over'
type: 'feature'
ticket: ''
created: '2026-10-01'
status: 'ready-for-dev'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/spec-mugloar-game-client.md'
  - '{project-root}/_bmad-output/initiative-game-client/spec-mugloar-game-client/api-contract.md'
  - '{project-root}/_bmad-output/initiative-game-client/architecture-mugloar-game-client/architecture-mugloar-game-client.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repo is still the create-vue template. Nobody can play Dragons of Mugloar through it.

**Approach:** Build the playable loop end to end against the architecture spine:
- Layers: `api/` → `game/` → stores → views/components.
- Routes: `/` and `/game/:gameId/{ads,shop,over}`.
- Turn actions: solve, buy, and reputation, through one turn pipeline, with a last-turn summary.
- Game over with restart.
- Board-refresh retry with a tavern-voice notice.
- Baseline accessible, responsive layout.

Covers CAP-1, 2, 3, 4, 5, 7, 9 (decode part), 12, and 13.

## Boundaries & Constraints

**Always:**
- Follow spine AD-1–3, AD-5–8, AD-10, AD-11, AD-13–18.
- Only `src/api/` calls `fetch`, and the base URL is a constant.
- Decode ads in `game/`. An ad with an unlisted `encrypted` value is kept but can't be solved, and logs a dev warning.
- Stats are `number | null`. Merge only the fields present in a response.
- Only one request in flight at a time, and Start is guarded too.
- Disable a buy when gold is known and below its cost.
- Every player-facing string lives in `src/copy.ts`, in tavern voice, with plain button labels.
- Use `rem` for every length. Only the global stylesheet has `@media`.
- Semantic HTML, keyboard support, and an always-rendered `aria-live` region for the last turn.
- Tests never touch the network: AD-16 setup file.

**Never:**
- No `localStorage`, saves, resume, or high scores (deferred work 1).
- No risk-tier, urgency, reward-rank, or affordability cues, and no fonts or icons (deferred work 2). Show `probability` as plain text.
- No polling, and no automatic retries except the AD-18 board refetch.
- No `v-html`.
- No calls to the live API from tests.
- No new interfaces or abstractions beyond the spine.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start | Click Start | One `POST game/start`, then the shop and messages; route becomes `/game/<id>/ads`; stats shown | Double click sends one request |
| Solve success | `solve` 200, `success: true` | Stats merged; `lastTurn` shows ad text, message, and deltas; board refetched | — |
| Encrypted ad | `encrypted` 1 or 2 | Shown decoded; solve sends the decoded adId | Unlisted value: rendered, solve disabled, dev warn |
| Buy | Gold known and less than cost | Buy control disabled, shortfall shown in text | — |
| Buy omits score | `buy` response has no `score` | Score unchanged, not nulled | — |
| Reputation | Player clicks it | Values shown; `turn` +1 locally when known | — |
| Game over | Solve returns `lives: 0` | Status `over`; route `/game/<id>/over` with final score and turn; Play again starts a new game | — |
| Board refetch fails | Network error, 5xx, or 429 | Up to 2 retries (2 s, 5 s); solving disabled while stale; then tavern notice and a "Check the board again" button | 404 means `expired` |
| Solve 404 | Ad gone | Not treated as expired; board refetch decides | Retryable `error` shown |
| Expired game | `GET messages` 404 | Route `/` with an expired notice | — |
| Open a game URL fresh | `/game/<id>/ads`, store empty | Messages and shop fetched; stats show "unknown" | 404 means expired |

</frozen-after-approval>

## Code Map

- `src/main.ts`: Pinia and router already wired. Add the global style import.
- `src/App.vue`: becomes a `<RouterView>` shell.
- `src/router/index.ts`: empty routes; fill in per AD-10.
- `src/__tests__/App.spec.ts`: asserts "You did it!". Rewrite it.
- `vitest.config.ts`: add `setupFiles` and `unstubGlobals: true`.
- `eslint.config.ts`: add `no-restricted-imports` overrides per folder (AD-1) and `vue/no-v-html` (AD-17).
- `.oxlintrc.json`: keep. It runs `pedantic` and `style` at warn. Filenames are kebab or Pascal; tests are `*.spec.ts`.
- `tsconfig.app.json`: `noUncheckedIndexedAccess` is on, and the `@/*` alias exists.
- `package.json`: add `@vue/devtools-api` (the Pinia 4 peer).
- Live API shapes: `api-contract.md`. Labels and item effects: `observed-values.md`, read-only reference.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- add `@vue/devtools-api` with pnpm -- required Pinia 4 peer
- [ ] `vitest.config.ts`, `src/test-setup.ts` -- fetch guard that throws, plus `unstubGlobals` -- AD-16
- [ ] `eslint.config.ts` -- import boundaries and `vue/no-v-html` at error level -- AD-1, AD-17
- [ ] `src/api/types.ts`, `src/api/client.ts` -- DTOs, `ApiError`, one function per endpoint, base URL constant; non-2xx responses are never parsed -- AD-2, AD-5
- [ ] `src/game/` (`types.ts`, `decode.ts`, `apply-turn.ts`) -- domain types (`Ad`, `ShopItem`, `Stats`, `Reputation`, `LastTurn`, `Deltas`), `decodeAd`, `applyTurn` -- AD-3, AD-7, AD-11
- [ ] `src/copy.ts` -- all player-facing text -- tavern-voice convention
- [ ] `src/stores/game.ts` -- setup store: state per AD-6 (no high scores); actions `start`, `load`, `solve`, `buy`, `investigateReputation`, `refreshMessages`; the turn pipeline; stale-response guard; `pending`; board retry -- AD-5–8, AD-10, AD-13, AD-18
- [ ] `src/router/index.ts`, `src/App.vue` -- routes and a `RouterView` shell; focus the `<h1>` after navigation -- AD-10, AD-15
- [ ] `src/views/StartView.vue`, `GameView.vue`, `AdsPanel.vue`, `ShopPanel.vue`, `GameOverView.vue` -- the `load` watch, status-driven navigation, the always-present live region -- AD-9, AD-10, AD-15
- [ ] `src/components/StatsBar.vue`, `AdCard.vue`, `ShopItem.vue`, `LastTurn.vue`, `ReputationPanel.vue`, `BoardNotice.vue` -- presentational, props in and emits out -- AD-1, AD-15
- [ ] `src/styles/` (`base.css`, `tokens.css`, `layout.css`) -- 62.5% root, tokens, the single breakpoint (`48rem /* 768px */`): ads and shop side by side on wide screens -- AD-14
- [ ] Tests under `__tests__/` -- `decode`, `apply-turn`, the store (stubbed fetch, covering the I/O matrix), and component role queries; rewrite `App.spec` -- AD-16

**Acceptance Criteria:**
- Given the dev server, when a player plays only through the UI, then the loop (board → solve or buy → summary → refreshed board) runs until game over, and Play again starts a new game.
- Given keyboard-only use, when playing, then every action is reachable and operable, with visible focus.
- Given a 360px-wide and a 1440px-wide viewport, when viewing any screen, then there is no horizontal scroll.
- Given the test suite, when it runs, then no real network request is made.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- **Two-level routes.** `GameView` is the parent of the `ads` and `shop` child panels, and holds the stats bar, the live region, and the `load` watch. Each child owns its `<h1>`. `/over` is a sibling child under `/game/:gameId`.
- **Turn pipeline shape.** One private helper runs all three turn actions:

```ts
async function runTurn(call: () => Promise<TurnResponse>, describe: (r) => LastTurnInfo) {
  if (pending.value) return
  const id = gameId.value; pending.value = true; error.value = null
  const prev = { ...stats.value }
  try { const r = await call(); if (gameId.value !== id) return
        const { stats: next, deltas } = applyTurn(prev, r); stats.value = next
        lastTurn.value = { ...describe(r), deltas }; if (next.lives === 0) status.value = 'over' }
  catch (e) { if (gameId.value === id) error.value = toError(e) }
  finally { if (gameId.value === id && status.value === 'playing') await refreshBoard(id); if (gameId.value === id) pending.value = false }
}
```

## Verification

**Commands:**
- `pnpm test:unit --run` -- expected: all pass, no unstubbed fetch
- `pnpm lint` -- expected: no errors
- `pnpm build` -- expected: type-check and build succeed

**Manual checks:**
- `pnpm dev`: play one game to game over; check the 360 and 1440 px layouts; navigate the full loop with the keyboard only. This plays the live API: about 2 requests per turn.
