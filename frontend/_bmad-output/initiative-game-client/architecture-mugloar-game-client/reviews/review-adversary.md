# Adversarial Review — Architecture Spine, Mugloar Game Client

- **Reviewed:** `architecture-mugloar-game-client.md` (draft, 2026-10-01)
- **Against:** spec kernel, `api-contract.md`, `observed-values.md`, `risk-cues.md`, `game-flow.md`
- **Lens:** pairs of units that each follow every AD to the letter and still build incompatibly. Each finding names the pair, how they diverge, and a minimal rule (YAGNI/KISS) that closes the gap.
- **API calls made:** none.

## Verdict

The layering, gateway, decoding, and error-shape rules hold up. The spine breaks at three seams: **`load(gameId)` semantics** (when it runs, what it does when the store already holds that game, and how it interacts with the cleared save at game over), **async races** (no rule ties a response to the game that issued it), and **persistence write timing** (a `watch` that rewrites the save the action just cleared). Two findings are critical. Both appear on the happy path (start a game, lose a game), not only in edge cases.

| # | Severity | Seam |
| --- | --- | --- |
| F1 | Critical | `load()` on the same gameId wipes a live or finished game (start → ads, over → `/over`) |
| F2 | Critical | Persistence `watch` rewrites the save the game-over action just cleared |
| F3 | High | Responses from a previous game land in the current one (no stale-response guard) |
| F4 | High | Turn-pipeline order: deltas vs merge, absent vs null fields, `pending` scope |
| F5 | High | Restore-from-save vs "messages fetched on load" vs CAP-11 expiry check |
| F6 | High | `LastTurn` shape is unspecified, so the component and the store diverge |
| F7 | High | Two tabs overwrite each other's high scores |
| F8 | Medium | AD-3 "drop undecodable ads" contradicts CAP-9 "unlisted `encrypted` still renders" |
| F9 | Medium | A 404 from solving an expired ad is indistinguishable from an expired game |
| F10 | Medium | No owner for navigation on `expired`, or for who appends the high score |
| F11 | Medium | The closed action list in AD-7 leaves no legal way to retry, and `start` is unguarded |
| F12 | Medium | Reward rank, urgency, and affordability have no home, and affordability with `gold: null` is undefined |
| F13 | Medium | AD-12 contradicts itself on high-score persistence, and the persisted shape is unspecified |
| F14 | Low | Reputation consumes a turn but returns no `turn`; the local turn either drifts or is guessed |
| F15 | Low | Version bump silently deletes high scores; orphaned saves accumulate |

---

## F1 — Critical: `load()` on the same gameId wipes a live or finished game

**Units:** `router/` + `GameView` (who calls `load`) vs `stores/game` `load()` / `start()` / game-over handling.

**How they diverge while complying:**

- AD-10: "Entering **any** `/game/:gameId/*` route calls `load(gameId)`." It specifies behaviour only for "save exists", "no save", and "404". "A route whose gameId *differs* … replaces the store state" implies something different happens on the *same* gameId, but the spine never says what.
- **Start path.** `start()` sets state; StartView pushes `/game/X/ads`; the route calls `load('X')`. AD-12's `watch` may not have flushed yet (Vue watchers are async). If no save exists yet, `load` takes the "no save" branch: it refetches messages and the shop (breaking AD-13, "shop once per game") and **leaves the stats `null`**, wiping the stats that CAP-1 requires on screen. Both builders followed the rules.
- **Game-over path.** AD-9 clears the save, then `GameView` replaces the route with `/game/X/over`. That is "entering a `/game/:gameId/*` route", so `load('X')` runs. No save exists, so it fetches messages, and a finished game returns 404 [V]. Status becomes `expired`. **The game-over screen turns into "expired" every time.** A reload on `/over` goes the same way, and so does Back from `/over`.
- **Tab switch.** ads → shop: one builder hooks `load` on the parent route's `beforeEnter` (does not fire on child switches); another calls it in each child view's `onMounted` (fires every switch, restores from the save, and clobbers in-memory state, including mid-request).

**Proposed rule (amend AD-10):**

> `load(gameId)` is called once per entry into the `/game/:gameId` parent route (a `beforeEnter` guard on the parent, or a `watch` on `route.params.gameId` in `GameView`), not on child switches. If `store.gameId === gameId` and `status` is `playing` or `over`, `load` is a no-op. `/game/:gameId/over` renders from store state only. If the store has no finished game for that id (for example after a reload), it redirects to `/`, because the high-score list already holds the result.

---

## F2 — Critical: the persistence watch rewrites the save that game over just cleared

**Units:** `stores/game` game-over step (AD-9 "the save for that game is then cleared") vs the persistence `watch` (AD-12 "each store writes its state through a `watch`").

**How they diverge:** the action sets `status = 'over'` and calls `localStorage.removeItem(key)` synchronously. The deep watch fires afterwards, because `status` and stats changed, and writes the state back under `mugloar:vN:game:X`. The save is not cleared. Then F1's `load` path *restores* a finished game as if it were live, or (with F1 fixed) a stale save sits there forever. The same happens on `expired`: AD-5 clears the save, and the watch rewrites it with `status: 'expired'`. The same happens on `restart()`: the reset state has `gameId: null`, so the watch writes `mugloar:vN:game:null`, or throws, depending on the builder.

**Proposed rule (amend AD-12):**

> The watch is the **only** writer and remover of `mugloar:vN:game:<id>`. Actions never touch `localStorage`. The watch writes when `status === 'playing'` and removes the key when `status` is `over` or `expired`. It does nothing when `gameId` is `null`. "The save is cleared" in AD-5 and AD-9 means "status changed to `over`/`expired`". The watch does the removal.

---

## F3 — High: responses from a previous game land in the current one

**Units:** `stores/game` turn actions and `load` (async) vs `router` / `StartView` (navigation while a request is in flight).

**How they diverge:** the player solves in game A. While the request is pending, they press Back to `/` and start game B, or open a `/game/B/ads` link. AD-10 replaces the store state, and `restart()` resets `pending` to `false`. A's solve response then resolves and merges A's lives, gold, and score plus A's `lastTurn` into B. The persistence watch writes the result under `game:B`. If A's response had `lives === 0`, **B is marked over** and A's score is appended under B's id. Two quick `load` calls (A, then B) resolve out of order, and the last to resolve wins. Resetting `pending` also reopens AD-8's double-spend window. No AD is violated.

**Proposed rule (new AD, or a clause in AD-7):**

> Every async store action captures `const id = gameId.value` before its first `await`. After each `await` it returns without touching state if `gameId.value !== id`. `load(B)` and `start()` follow the same check, using the requested id or a monotonically increasing request counter.

One line per action. No cancellation or AbortController is needed.

---

## F4 — High: turn-pipeline ordering is ambiguous in three places

**Units:** `stores/game` pipeline vs `game/` delta function vs the `LastTurn` / `AdCard` components.

1. **Deltas vs merge.** AD-7 lists "merge the response stats, **then** set `lastTurn` (… deltas from `game/`)". One builder computes deltas against the post-merge store and gets all zeros. Another snapshots first. Both follow the listed order.
2. **Absent vs `null`.** Buy has no `score`, and solve has no `level` [V]. A merge written as `score: res.score ?? null` follows AD-11 ("`null` means unknown") and **erases a known score on every buy**. A spread merge keeps it. The `game/` delta function may receive `undefined` or `null` and treat them differently.
3. **`pending` scope.** AD-8 says "while `pending` is true". One builder clears it after the API response, another after the message refetch. In the gap, the board is stale and the player can click an ad that was just consumed or has expired. That is the exact failure AD-8 exists to prevent. On error, is `error` cleared at the next action's start or never? Is `lastTurn` set on a failed call?

**Proposed rule (rewrite the AD-7 sequence):**

> `pending = true; error = null` → snapshot the prior stats → call the API → `game/applyTurn(prior, response)` returns `{ stats, deltas }`, where only fields **present** in the response change and a missing field is "unchanged", never `null`; a delta exists only when both sides are numbers → set `stats` and `lastTurn` → game-over check → refetch messages if still `playing` → `pending = false` (in `finally`). On API failure, `lastTurn` is not set. The refetch and the error still apply.

---

## F5 — High: restore-from-save vs "messages fetched on load" vs the CAP-11 expiry check

**Units:** `stores/game` `load()` (AD-10) vs the AD-13 budget vs the CAP-11 acceptance test.

**How they diverge:**

- AD-10, save branch: "restore it". There is no API call.
- AD-13: "Messages are fetched on `load`". That is a call.
- CAP-11: "If the API rejects the saved gameId, the save is cleared and the start screen is shown". That requires a call on reload.

Builder A restores without a call. A reload after 40 idle minutes shows a playable game with a stale board, and the first click fails with 404 → `expired`. That passes AD-10 and fails CAP-11. Builder B also refetches messages. Whether the board is persisted at all (AD-12 says "the game store state" minus `pending` and `error`, so yes) is a further ambiguity.

**Proposed rule (amend AD-10 and AD-12):**

> The save branch restores everything except the board, then fetches messages. A 404 there is the CAP-11 rejection path. The board is not persisted. The shop list is persisted (to honour "once per game").

This is one free GET per reload, within the AD-13 budget.

---

## F6 — High: the `LastTurn` shape is unspecified

**Units:** `components/LastTurn` vs `stores/game` (`lastTurn` producer); persistence as a third consumer.

**How they diverge:** AD-7 says `lastTurn` is "the action plus the response message plus deltas". `LastTurn` is listed as a domain type in `game/`, but its fields are not. CAP-12 requires showing **which ad or item**. The store builder records `adId`. The component builder expects the ad's `message` text. After the post-turn refetch, the solved ad is gone from the board, and after a reload no board exists (F5), so the id can no longer be resolved. Reputation's result (three values) has no stated place: in `lastTurn`, or in the separate `reputation` field from AD-6? Is it persisted?

**Proposed rule (pin the type in AD-7):**

```ts
type LastTurn =
  | { kind: 'solve'; adMessage: string; success: boolean; message: string; deltas: Deltas }
  | { kind: 'buy'; itemName: string; success: boolean; deltas: Deltas }
  | { kind: 'reputation'; reputation: Reputation; deltas: Deltas };
type Deltas = Partial<Record<'lives' | 'gold' | 'score' | 'level' | 'turn', number>>;
```

Store a snapshot of the display text, never a reference. `reputation` in AD-6 is the latest value of `lastTurn.reputation`, or drop the separate field.

---

## F7 — High: two tabs overwrite each other's high scores

**Units:** `stores/high-scores` (in-memory list, written whole by a watch) vs a second tab running its own instance. This needs **different** games, not just the same one.

**How they diverge:** tab 1 ends game X, appends, and writes `[…, X]`. Tab 2, loaded earlier, ends game Y and writes `[…, Y]` from its stale in-memory list. **X is lost.** AD-9's "append exactly once per gameId" holds in each tab, and AD-12 holds too. With two tabs on the *same* game, the losing tab gets a 404 and `expired`, which is acceptable, but its stale save write can still overwrite the newer save (last write wins).

**Proposed rule (amend AD-12 for high scores only):**

> `append(entry)` re-reads `mugloar:vN:highscores` from `localStorage`, dedupes by `gameId`, then writes. The store is hydrated from storage on read, so the list is not a write-only mirror.

Two-tab play on the same game is explicitly unsupported (last write wins). Say so in the Deferred section rather than building cross-tab sync.

---

## F8 — Medium: AD-3 "drop undecodable ads" contradicts CAP-9

**Units:** `game/decodeAd()` vs `AdCard` and its CAP-9 test.

**How they diverge:** CAP-9: "An ad with an unlisted `probability` **or `encrypted`** value still renders, with neutral styling." AD-3: "Undecodable ads are dropped (spec constraint)." No such constraint exists in the spec kernel. The decoder builder drops `encrypted: 3`, the AdCard builder's acceptance test expects it rendered, and both cite a source.

**Proposed rule (choose one and state it in AD-3):**

> An ad with an unlisted `encrypted` value is kept with its raw fields, gets tier `unknown`, and has its solve button disabled, because the encoded adId cannot be solved. It warns in dev (AD-4).

Alternatively, amend CAP-9 to say it is dropped with a dev warning. The user decides. The spine must not cite a spec constraint that doesn't exist.

---

## F9 — Medium: a 404 from solving an expired ad looks like an expired game

**Units:** `stores/game` error mapping (AD-5, "`not-found` mid-game → `expired`") vs the turn pipeline (AD-7, "the ad may have expired").

**How they diverge:** the response for solving an expired ad is [U]. If the API answers 404, which is plausible for a missing sub-resource, one builder follows AD-5 and declares the whole game expired, clearing the save of a live game. Another builder follows AD-7 and treats it as retryable. Both are compliant.

**Proposed rule (amend AD-5):**

> A 404 from a turn action is not conclusive. The pipeline's message refetch decides: if the refetch returns 404, set `expired`; otherwise, set a retryable `error`. Only a 404 on `GET messages` means the game has expired.

This costs no extra calls, because the refetch already happens.

---

## F10 — Medium: no owner for `expired` navigation or for the high-score append

**Units:** `GameView` (watches `status`) vs `StartView` / router vs `stores/game` vs `stores/high-scores`.

**How they diverge:**

- AD-9 assigns the `over` → `/over` redirect to `GameView`. For `expired`, CAP-11 says "the start screen is shown" and the state diagram says "expired → idle: new game", but no unit owns that step. One builder renders an "expired" panel in place. Another redirects to `/` and loses the explanation. A third does nothing.
- "The high score is appended exactly once" names no caller. Store A's action calls `useHighScoresStore().append()`. `GameOverView` does it in `onMounted`. Both are legal under AD-1, so a builder can end up with both (the dedupe hides that) or neither.

**Proposed rule:**

> `stores/game` calls `useHighScoresStore().append()` inside the game-over step. That is the only store-to-store call. `GameView` replaces the route with `/` on `expired`. StartView reads a one-shot `expiredNotice` flag from the game store, set in the same step and cleared by `start()`.

Or choose the in-place panel. Either is fine, but write one down.

---

## F11 — Medium: the closed action list in AD-7 leaves no legal retry, and `start` is unguarded

**Units:** `stores/game` vs any view showing the "retryable" `error`.

**How they diverge:** AD-5 promises a *retryable* error. AD-13 forbids retry loops. AD-7's list ("state changes only inside `start`, `load`, `solve`, `buy`, `investigateReputation`, `restart`") contains no retry or dismiss action. Builder A adds `refreshBoard()`, which violates AD-7. Builder B wires the retry button to `load(gameId)`, which is a no-op under the F1 fix. Builder C leaves no retry at all. Separately, `start` is not turn-consuming, so AD-8 does not block a double click: **two games are created**, which breaks CAP-1 ("calls `game/start` once"). `restart()` vs `start()`: if StartView calls `start()` without `restart()`, the previous game's `lastTurn` and `reputation` leak into the new game (CAP-7, "no state left over").

**Proposed rule (amend AD-7 and AD-8):**

> Add `refreshMessages()` (one GET, triggered by the player) to the action list. `start()` always resets the full state first, and `restart()` is removed as a separate action. AD-8's guard also covers `start` (a `status === 'loading'` guard).

---

## F12 — Medium: reward rank, urgency, and affordability have no home

**Units:** `AdCard` / `ShopItem` (presentational, single-item props) vs the board and shop views vs `game/` registries.

**How they diverge:** AD-4 places tier and item-effect mappings in `game/`. Reward rank ("thirds of the **current board**"), urgency cut-offs, and affordability are not covered. `AdCard` receives one ad and *cannot* compute a board-relative rank. So one builder computes it in the view, another passes the whole board into each card, and a third duplicates the cut-offs. Affordability with `gold === null` (AD-11, opened on a second device) is undefined: one builder renders it as affordable (`null >= 50` is `false` in JS, so it actually renders as unaffordable with a "shortfall of NaN"), another as unknown. The "any item affordable" shop indicator inherits the same ambiguity.

**Proposed rule (extend AD-4):**

> `game/` also owns `rewardRanks(ads): Map<adId, 'high' | 'mid' | 'low'>`, `urgency(expiresIn)`, and `affordability(gold: number | null, cost): 'yes' | 'no' | 'unknown'`. Views call them and pass the results as props. Components never compute cues from raw numbers.

---

## F13 — Medium: AD-12 contradicts itself, and the persisted shape is unspecified

**Units:** `stores/high-scores` persistence vs `stores/game` persistence vs the restore-validation code.

**How they diverge:**

- Bullet 1: "Each store writes its state". Bullet 2 defines a `highscores` key. Bullet 3: "**Only** the game store state is persisted". A literal reader of bullet 3 doesn't persist high scores, which breaks CAP-10.
- "Game store state minus `pending` and `error`" includes `status`. A save written with `status: 'loading'` restores to a game stuck in loading. "Invalid shape is discarded", but what counts as valid is unstated, so each builder writes its own checker.

**Proposed rule:**

> Bullet 3 becomes: "the game store persists `{ gameId, stats, shop, reputation, lastTurn }`. `status` is not persisted, and a restore sets it to `playing`." One `game/` (or store-local) guard function per key does the shape check. On failure the key is removed, not just ignored.

---

## F14 — Low: reputation consumes a turn but returns no `turn`

**Units:** `stores/game` `investigateReputation` vs `game/` deltas vs `StatsBar`.

**How they diverge:** CAP-12 requires the turn change to be shown for reputation. The response has only `{people, state, underworld}`. Builder A increments `turn` locally ("+1 turn"), inferring from [V]-inferred evidence. Builder B leaves `turn` unchanged and shows no delta. `StatsBar` then disagrees with the next solve's `turn` by one, and the next solve's turn delta reads "+2" under B.

**Proposed rule:**

> After reputation, `turn` increments locally when it is known. The delta shows `turn +1`. Note it as derived from the inferred [V] fact in `api-contract.md`.

---

## F15 — Low: a version bump deletes high scores; orphaned saves accumulate

**Units:** whoever bumps `N` vs `stores/high-scores` vs abandoned game saves.

**How they diverge:** AD-12 versions both keys with one `N`. A game-shape change bumps `N`, and every high score silently disappears, which breaks CAP-10 ("survives a reload"). Saves from abandoned games (a tab closed mid-game, games that expired server-side and were never revisited) are never removed.

**Proposed rule:**

> Version each key independently: `mugloar:game:v<G>:<id>` and `mugloar:highscores:v<H>`. `start()` removes every other `mugloar:game:*` key, since only one game is playable per device. If the user wants multiple concurrent saves, skip the cleanup and accept the leak.

---

## Checked and holding

- AD-2/AD-5 error shape: the HTML 404 body is handled by not parsing non-2xx responses. That's sound.
- Final score at game over is always a number: only solve can bring lives to 0, and solve returns `score` and `turn` [V]. The `number` type in AD-6's high-score entry is safe, but a one-line note in AD-9 would stop a builder from widening it to `number | null` "to be safe".
- AD-1 layering and AD-3 decoding at the store boundary leave no second decode site.
