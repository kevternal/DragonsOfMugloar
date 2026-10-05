---
name: 'Vue expert review — Mugloar game client'
type: review
scope: 'frontend/src (Vue 3.5, TS ~6, Pinia 4, vue-router 5, Vite 8, Vitest 4)'
date: '2026-10-05'
reviewer: 'Claude (independent, read-only)'
spine: '../architecture-mugloar-game-client/architecture-mugloar-game-client.md (AD-1..AD-18)'
---

# Vue expert review — Mugloar game client (2026-10-05)

**Tags.** **[V]** means verified, with a source URL and the date checked (2026-10-05 unless stated). Code observations are [V] from reading the working tree at 19:40–19:50 EEST. **[D]** means stated in docs but not verified here. **[U]** means from memory or unverified.

**Snapshot caveat.** Another agent was editing the shop code during this review (`ShopItem.vue`, `ShopPanel.vue`, `stores/game.ts`, `game/recommendations.ts`, `game/shop.ts`, `GameView.vue`, and their tests). I reviewed those files as found.

- A run of `vitest run` at 19:45 gave 4 failures out of 225 tests, all in `shop-panel.spec.ts` and `game-flow.spec.ts` buy and hint cases. The failing assertions show mid-edit output (for example `"…300 goldBuy, Owned ×1owned 1…"`), so I treated them as work in progress, not findings [V].
- Several issues I found early were fixed mid-review by that agent. They're listed in §3.0 so nobody re-raises them.

---

## 1. Summary verdict

**This is a well-architected, above-average small Vue 3 app.** Its layering is stricter and better enforced than the reference templates.

- `src/game/` is genuinely pure and tested hard.
- ESLint enforces the dependency rules per folder (AD-1).
- The store is a single, well-sectioned setup store, with stale-response guards that most apps omit (`isCurrent` / epoch).
- Accessibility is treated as a requirement, not a polish item.
- Composition API usage is modern and idiomatic: `useTemplateRef`, `useId`, reactive props destructure, `satisfies`, discriminated unions.

**No structural rewrite is warranted.** Specifically, I would **not** split `stores/game.ts` into several stores, and I would not split the large row components into more components. The size of `ShopItem.vue` and `JobRow.vue` is mostly CSS, which is legitimate given AD-14's container-query layouts.

**The real issues are small and specific:**
1. **Two spec drifts in the store.**
   - The board auto-retry fires on any non-404 error, not just network, 5xx and 429 (AD-18, and the API-courtesy rule).
   - A 404 from `refreshShop()` marks the game expired, which AD-5 reserves for `GET messages`.
2. **`readonly()` on returned store state.** The Pinia docs say this breaks devtools and plugins.
3. **Live regions inserted with `v-if`.** The status region should exist before its content changes.
4. **Duplicated UI fragments.** The badge, error alert and retry notice each appear 2–3 times, which passes the spine's own YAGNI "second concrete use" test.
5. **`GameView.vue`'s script (119 lines, four concerns).** It reads better as two composables.
6. **A lint setup that drowns signal.** oxlint reports 2,101 warnings and 0 errors. Unbraced `if`s survive, and `eslint-plugin-vue` runs only its `essential` tier.

---

## 2. Top 10 recommendations, ranked by value for effort

| # | Recommendation | Where | Effort | Why it ranks here |
|---|---|---|---|---|
| 1 | Retry the board only on `network`, 5xx and 429; fail fast on other 4xx | `stores/game.ts:221-244` (`fetchBoard`) | S | A spec bug (AD-18, spec "never poll" courtesy). A 400, 401 or 403 now costs 2 extra calls and holds `pending` for 7 s |
| 2 | Decide whether a shop 404 means expired, then align the code or AD-5 | `stores/game.ts:485-488`; test at `game.spec.ts:396` | S | Code and spine contradict each other, and a test locks in the contradiction |
| 3 | Replace `readonly(ref)` in the store's return with getters (`computed(() => x.value)`), or drop it | `stores/game.ts:532-534` | S | Pinia docs: making state readonly "will break SSR, devtools, and other plugins" [V] |
| 4 | Keep `role="status"` / `role="alert"` containers always rendered; toggle only their text | `GameView.vue:146-147`, `StartView.vue:21-22`, `GameOverView.vue:41` | S | MDN: a live region must exist before its content changes [V]. AD-15 already applies this rule to the log |
| 5 | Lint hygiene: let the user choose among (a) dropping oxlint's `style` and `pedantic` categories, or cherry-picking from them; (b) `curly: ['error','all']`; (c) `pluginVue.configs['flat/recommended']` (or `strongly-recommended`) | `.oxlintrc.json`, `eslint.config.ts:21` | S | 2,101 warnings bury real ones. Unbraced `if`s remain at `App.vue:10`, `apply-turn.ts:22,25` and `GameOverView.vue:13` |
| 6 | Extract `ErrorAlert.vue`, a shared badge, and a generalised retry notice | `.error` ×3 views, `.badge` in `JobRow.vue:215` and `ShopItem.vue:274` plus `.nav-hint` in `GameView.vue:160`, `.notice` in `BoardNotice.vue:19` and `ShopPanel.vue:64` | S–M | Each has 2–3 concrete uses, so the spine's own YAGNI threshold is met. It also fixes #4 in one place |
| 7 | Split `GameView.vue`'s script into `useTurnFocusRestore()` and `useStickyBarHeights()` | `GameView.vue:46-78`, `GameView.vue:80-120` | M | The Vue docs endorse composables "not only for reuse, but also for code organization" [V]. Needs a one-line AD-1 amendment (a `composables/` layer) |
| 8 | Register the route-focus `afterEach` once in `router/` or `main.ts`, or remove it on unmount; skip failed navigations | `App.vue:9-12` | S | The hook is never removed (`afterEach` returns a remover [V, typings]). Tests mount `App` against a shared router singleton (`App.spec.ts:7,11`), so hooks pile up |
| 9 | Test hygiene: one shared `stubApi`, one spec per component, fewer CSS-class selectors | `game.spec.ts:34-46` vs `__tests__/stub-api.ts`; `components.spec.ts` (7 components, 600+ lines) | M | Vue's testing guide says to test behaviour, not implementation [V]. The spine says to query by role and accessible name |
| 10 | Remove the `response as TurnResponse` cast by typing the pipeline | `stores/game.ts:187`, `runTurn<R extends object>` at `:364` | S | The only unchecked cast in app code apart from `response.json() as T`. Cheap to make the compiler prove it |

**Runner-ups** (each S):
- Add Pinia's `acceptHMRUpdate` block (dev experience).
- Pick one props style: `const props = defineProps` (in `ActivityLog` and `ReputationPanel`) or destructure (everywhere else).
- Pass `gameId` to `GameView` as a route prop.
- Do a spine sync pass (§3.9).

---

## 3. Detailed findings

### 3.0 Already fixed during this review (don't re-raise)

Observed at about 19:43, compared with my first read at about 19:35 [V].

- **Buy feedback matched by name.** `ShopPanel` matched the buy result by `itemName`. It now matches by `itemId`, and `TurnRecord` buy entries carry `itemId` (`game/types.ts:38`, `ShopPanel.vue:21`).
- **Duplicated "which stat a buy raised" logic.** This was in both `GameView.changedStat` and `ShopItem.changedText`. It's now `game/shop.ts:49 raisedStat()`, as listed in the AD-4 table.
- **Shop hint computed in the view.** `GameView` called `shopHint()` itself. It's now the store getter `shopHint` (`stores/game.ts:99`), as AD-6 says.
- **Per-row live regions.** `ShopItem`'s per-row `role="status"` regions duplicated the activity log's announcement, against AD-15's "only live region for turn results". They were removed; the comment at `ShopItem.vue:141` notes it.
- **`lastBuy` changed from a `computed` over `actionStartSeq` to a `ref`.** It's set in `recordTurn` and cleared in `beginAction` and `reset`. This is simpler and matches AD-6's wording.

### 3.1 Components and views over 100 lines

Line counts are per block, from an awk count of the working tree [V]:

| File | Total | Script | Template | Style | Verdict |
|---|---|---|---|---|---|
| `components/ShopItem.vue` | 366 | 95 | 50 | 213 | **Keep as one component.** Extract the badge only (#6) |
| `components/JobRow.vue` | 276 | 42 | 44 | 182 | **Keep.** Extract the badge only (#6) |
| `components/ActivityLog.vue` | 195 | 72 | 47 | 68 | **Keep.** An optional `ActivityLogEntry.vue` is low value |
| `views/GameView.vue` | 178 | 119 | 33 | 18 | **Split the script** into two composables (#7) |
| others | ≤ 99 | — | — | — | Fine |

- **Best practice.**
  - Vue's style guide sets no line limit [V, https://vuejs.org/style-guide/]. Its relevant rules are "Component files", "Simple expressions in templates", "Simple computed properties" and "Tightly coupled component names" [V, https://vuejs.org/style-guide/rules-strongly-recommended.html].
  - `eslint-plugin-vue` has `vue/max-lines-per-block` with per-block `script`, `template` and `style` limits. It has no documented default and is in no preset [V, https://eslint.vuejs.org/rules/max-lines-per-block.html]. So "100 lines" is a house heuristic, not a community rule.
  - For comparison, Elk (★6.0k, pushed 2026-10-05) has `app/components/status/StatusActionsMore.vue` at 356 lines [V, GitHub API].
- **Our code.** In the two row components, 65–70% of the lines are scoped CSS for container-query layouts (AD-14). Their scripts are small, and almost every function is a named `computed` with a doc comment. Splitting them into sub-components would push the CSS grid areas across files and fight the "one native button per row, content forms the name" accessibility design (CAP-16 and CAP-17 comments at `JobRow.vue:48`, `ShopItem.vue:101`).
- **Recommendation.**
  - Don't split the rows. Do extract the repeated badge (#6).
  - For `GameView`, see §3.2.
  - If you want a guard rail, add `vue/max-lines-per-block` with `{ script: 120, template: 80 }` and leave `style` uncapped. This is the user's choice.
- **Effort:** S.

### 3.2 Separation of concerns

**Layering (AD-1) is good.**
- [V] ESLint `no-restricted-imports` overrides exist for components, game, views and router (`eslint.config.ts:35-146`).
- `eslint .` exits 0 [V, run 2026-10-05].
- `game/` has no Vue imports. Its only api import is `import type` (`decode.ts:1`).
- This is stronger than create-vue (no boundary rules) and Vitesse (auto-imports everywhere) [V, GitHub API listing of `antfu-collective/vitesse/src`: `components composables layouts pages stores styles`, with auto-imports via `auto-imports.d.ts`].

**F-2.1 `GameView.vue` script mixes four concerns** (`GameView.vue:12-121`):
1. Load on route param.
2. Status-driven navigation.
3. Focus restore after a turn: `:46-78`, with a non-reactive `turnInFlight` flag and two watchers.
4. Sticky-bar measurement: `:80-120`, with a ResizeObserver, CSS custom properties and cleanup.

- **Best practice.** "you can and should apply any code organization best practices to your Composition API code" [V, https://vuejs.org/guide/extras/composition-api-faq.html]. "Composables can be extracted not only for reuse, but also for code organization… component-scoped services" [V, https://vuejs.org/guide/reusability/composables.html]. Composables should clean up their side effects in `onUnmounted` [V, same page].
- **Recommendation.**
  - Add `src/composables/use-turn-focus-restore.ts`: it takes a getter for the panel root and owns the `pending` and `gameId` watchers.
  - Add `src/composables/use-sticky-bar-heights.ts`: it takes the two template refs and owns the observer and its cleanup.
  - `GameView`'s script drops to about 35 lines of pure orchestration.
  - Under the spine this is a new layer, so amend AD-1: "`composables/` — Vue-aware helpers used by views; no store or api imports".
  - **YAGNI check.** This isn't a speculative abstraction. There's no interface and no second implementation; it's a move-and-name. The spine's YAGNI clause targets "interface, abstraction, or pattern … until a second concrete use". The user should decide whether a named organisational module counts.
- **Effort:** M (move, add the folder rule, and keep the existing `game-flow.spec` focus tests green).

**F-2.2 Logic in templates is mostly fine.**
- [V] A few compound conditions remain inline: `AdsPanel.vue:20` (`game.board.length === 0 && !game.boardStale && game.status === 'playing'`) and `ShopPanel.vue:38`.
- **Best practice.** "Templates should only include simple expressions" [V, rules-strongly-recommended].
- **Recommendation.** Use a `showEmptyBoard` computed in the view, or a store getter `boardEmpty`. **Effort:** S. Low priority.

**F-2.3 `stores/game.ts` (546 lines): keep it as one store.**
- **Our code.** [V]
  - 12 state refs and 3 getters.
  - 7 public actions, all funnelled through `runTurn` (`:364`) or the board and shop loaders.
  - The guards `isCurrent`, `isCurrentEpoch`, `idleGameId` and `holdsGame` are named and documented.
  - Section banners (`// ---- Board (AD-18)`) make it navigable.
  - `pending`, `epoch` and `gameId` are shared by every action.
- **Best practice.**
  - Pinia supports composing stores, but warns against cycles and requires `useStore()` calls before any `await` [V, https://pinia.vuejs.org/cookbook/composing-stores.html].
  - Splitting would give "board", "shop" and "turns" stores that all need the same `pending`/epoch guard and `gameId`: cross-store coupling on every action. That's the opposite of AD-6's goal of "exactly two stores", and of AD-7's "one pipeline".
  - A composable-inside-store split, such as `useBoardRefresh(gameId, pending)` called inside the setup store, is possible [U] but adds indirection for no reuse.
- **Recommendation.** Keep one store. Optional S-sized moves:
  - `toError`, `emptyStats` and `statsFromStart` (`:29-45`) are pure and could live in `game/`.
  - Otherwise leave the file alone. Its size reflects the real protocol complexity (AD-5, AD-7, AD-18).

**F-2.4 (Low) Spine wording versus code on "views never call recommendation functions".**
- [V] AD-6 says views "never call the recommendation functions themselves". Yet `ShopPanel.vue:5` imports `shelfOrder`, and `ShopItem.vue:4` imports `itemAdvice`.
- AD-1 allows `views → game` and `components → game`, and the AD-4 table says the shop view uses `shelfOrder`. So the code is legal, but AD-6's sentence reads stricter than intended.
- **Recommendation.** Reword AD-6 to "never call `rankJobs` / `recommendItem` / `shopHint`", meaning the board-relative or stateful ones. **Effort:** S (doc only).

### 3.3 Store design (Pinia)

**F-3.1 `readonly()` in the setup-store return** (`stores/game.ts:532-534`: `stateEstimate`, `purchases`, `lastBuy`).
- **Best practice.** "You must return all state properties in setup stores … Not returning all state properties or making them readonly will break SSR, devtools, and other plugins." [V, https://pinia.vuejs.org/core-concepts/]
- **Our code.** These three are wrapped to stop views mutating them, which is a good intent (AD-7).
- **Recommendation.** Use one of two options:
  - Keep them as private refs and expose `computed(() => stateEstimate.value)`. Pinia treats `computed` as a getter, so it's read-only by construction and visible in devtools. The trade-off is that they become getters, not state, so `$patch` and `$reset` don't touch them, which is what you want here [D, the same page's "computed() become getters"].
  - Or return the plain refs and rely on AD-7 plus review.
- **Effort:** S.

**F-3.2 AD-18 retry predicate is too broad** (`stores/game.ts:221-244`).
- **Spine.** "When `GET messages` fails with a network error, 5xx, or 429, the store retries… A 404 is never retried." The spec says the same (`spec-mugloar-game-client.md:104`) [V].
- **Our code.** `fetchBoard` returns `'failed'` for any error that isn't `not-found`, including `http` with status 400, 401 or 403 (`api/client.ts:25-27` maps every non-404 to `'http'`). `refreshBoard` then retries twice, after 2 s and 5 s [V].
- **Recommendation.** Use `const retryable = err.kind === 'network' || err.status === 429 || (err.status ?? 0) >= 500`. Mark the board stale either way, but only return `'failed'` when the error is retryable. Add one test with a 400.
- **Effort:** S.

**F-3.3 `refreshShop()` treats a shop 404 as expiry** (`stores/game.ts:485-488`; locked in by `game.spec.ts:396` "404 means expired").
- **Spine, AD-5.** "only a `not-found` from `GET messages` sets status `expired`".
- **Recommendation.** Either:
  - set `error` and let the next messages fetch decide (spine-conformant), or
  - amend AD-5 to say a shop 404 is conclusive. That's plausible, since the shop endpoint is per game, but it's [U] until probed.

  The user decides. **Effort:** S.

**F-3.4 (Low) `holdsGame` includes `'loading'`** (`stores/game.ts:123-125`). AD-10 says the no-op happens for `playing` or `over`. Including `loading` is a sensible de-duplication of concurrent loads [V code]. Update AD-10 to match. **Effort:** S (doc).

**F-3.5 (Low) No HMR accept.**
- Pinia's Vite HMR needs `if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))` next to each store [V, https://pinia.vuejs.org/cookbook/hot-module-replacement.html]. Vitesse does this [V, `src/stores/user.ts` via GitHub API].
- Without it, store edits reload the page and lose the game in progress [U].
- **Effort:** S.

**Placement is good.** Pure derivations live in `game/` and are exposed as store getters (`rankedJobs`, `recommendedItem`, `shopHint`). That matches "computed getters should be side-effect free" [V, https://vuejs.org/guide/essentials/computed.html]. One nit: `warnUnlisted` is a `console.warn` side effect reachable from getters. It's dev-only and de-duplicated (`game/warn.ts:2-13`), which is acceptable.

### 3.4 Props, emits, reactivity, lifecycle

**F-4.1 Props and emits design is good.**
- [V] All components use type-based `defineProps<…>()` and tuple-typed `defineEmits<{ solve: [adId: string] }>()`.
- Components emit ids, not objects, and parents call store actions (`AdsPanel.vue:33`, `ShopPanel.vue`). That's exactly one-way data flow [V, https://vuejs.org/guide/components/props.html].
- Defaults are set via 3.5 reactive destructure (`ShopItem.vue:9-27`, `StatsBar.vue:7-11`), which the docs recommend [V, same page].
- Booleans are precomputed in the parent (`:disabled="game.pending || game.boardStale"`), which matches the "props stability" advice [V, https://vuejs.org/guide/best-practices/performance.html].

**F-4.2 (Low) Mixed props styles.**
- `ActivityLog.vue:6` and `ReputationPanel.vue:7` use `const props = defineProps`. `JobRow`, `ShopItem` and `StatsBar` destructure.
- **Recommendation.** Destructure everywhere. When passing a prop to `watch` or a composable, wrap it in a getter, as the docs warn: "watch(() => foo)" [V, props page]. `ActivityLog.vue:66`'s `watch(() => props.log.length, …)` would become `watch(() => log.length, …)`.
- **Effort:** S.

**F-4.3 Computed versus watch use is correct.**
- [V] Watchers are used only for side effects: the route load, navigation, focus, the ResizeObserver set and the log scroll. Each uses `flush: 'post'` where it touches the DOM, which the docs recommend [V, https://vuejs.org/guide/essentials/watchers.html].
- Watchers created in setup auto-stop on unmount [V, same page].
- Both `ResizeObserver`s are disconnected in `onBeforeUnmount` (`GameView.vue:116-120`, `ActivityLog.vue:65`), and `GameView` removes the CSS variables it set [V].

**F-4.4 `App.vue` route-focus hook is never removed** (`App.vue:9-12`).
- `router.afterEach(...)` returns `() => void` to unregister it [V, `node_modules/vue-router/dist/index-D7ja2BKs.d.ts:1531`].
- The hook is registered inside a component's setup and never removed. In the app that's harmless, because `App` mounts once. In tests, `App.spec.ts:11` and `:22` mount `App` against the module-level `router` and a fresh router, and every mount adds a hook.
- The hook also runs after **failed** navigations, because the third `failure` argument is ignored [V, https://router.vuejs.org/guide/advanced/navigation-guards.html: "receive a third argument reflecting navigation failures"].
- **Recommendation.** Move the hook to `main.ts` or `router/index.ts`, or `onUnmounted(router.afterEach(...))`. Skip it when `failure` is set. Note that AD-1 forbids `router/` from importing anything but views, and this hook needs no imports.
- **Effort:** S.

**F-4.5 (Low) `GameOverView` redirects from setup** (`GameOverView.vue:12-13`).
- The router docs' idiom is a `beforeEnter` guard that returns a location [V, navigation-guards page]. But that guard needs the store, and AD-1 forbids `router/` from importing stores.
- **Recommendation.** Keep it as is (the spine wins). Only brace the `if` (§3.6).

**F-4.6 (Low) `GameView` reads `route.params` directly** (`GameView.vue:15`).
- The router docs recommend `props: true` to decouple a component from `$route` [V, https://router.vuejs.org/guide/essentials/passing-props.html].
- Since vue-router 5 ships typed routes in core [V, https://router.vuejs.org/guide/migration/v4-to-v5], `props: true` would also remove the `String(...)` coercion.
- **Effort:** S. Optional.

### 3.5 TypeScript strictness and type design

- **Good.** [V]
  - `@vue/tsconfig` 0.9.1 gives `strict`, `verbatimModuleSyntax` and `noImplicitThis` (read from `node_modules/@vue/tsconfig/tsconfig.json`), and the app adds `noUncheckedIndexedAccess` (`tsconfig.app.json`). That's already stricter than create-vue's default.
  - Domain types are discriminated unions (`TurnRecord`, `TurnInfo` via a `DistributiveOmit` helper, `game/types.ts`). `satisfies Record<…>` keeps copy tables exhaustive (`copy.ts`). `as const` registries are used throughout.
  - Only one non-null assertion exists, and it's in test code.
- **F-5.1 Typing the turn pipeline.** `recordTurn(..., response: object, ...)` casts `response as TurnResponse` (`stores/game.ts:176-187`). The cast exists because `ReputationDto` shares no keys with the weak type `Partial<Record<StatKey, number>>` [U, TS weak-type detection, from memory].
  - **Recommendation.** Add a pure `statFields(response: object): TurnResponse` in `game/apply-turn.ts` that picks known `StatKey`s with a `typeof === 'number'` check. That removes the cast and validates at the boundary. Alternatively, constrain `runTurn<R extends SolveDto | BuyDto | ReputationDto>`.
  - **Effort:** S.
- **F-5.2 (Optional) Extra flags.** The handbook lists `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`, `noImplicitOverride` and `noPropertyAccessFromIndexSignature` as outside `strict` [V, https://www.typescriptlang.org/tsconfig/#strict].
  - Of these, `noFallthroughCasesInSwitch` is free here.
  - `exactOptionalPropertyTypes` tends to be noisy with Vue optional props and `undefined` attribute bindings such as `:aria-describedby="x ? id : undefined"` [U].
  - The user decides. **Effort:** S.
- **F-5.3 (Low) `api/client.ts:29` trusts JSON with `as T`.** This is accepted by AD-2, which says to return DTOs raw, and `game/decode` is tolerant. No change needed; noted for completeness.

### 3.6 Naming and readability ("reads like a book")

- **Strong overall.** [V]
  - Guards and steps are named (`idleGameId`, `beginAction`, `finishTurn`, `playableJobs`, `leastBoughtPlus2`).
  - Every exported function has a one-line JSDoc that cites its rule (AD or CAP number).
  - Thresholds are named constants that cite evidence (`recommendations.ts:22-66`).
  - `byValue`, `byExpiry` and `bySafety` comparators read like prose.
- **F-6.1 Unbraced `if`s remain:** `App.vue:10` (`if (from.name === undefined) return`), `game/apply-turn.ts:22` and `:25`, and `GameOverView.vue:13` [V, grep].
  - **Recommendation.** Brace them, and enforce with `curly: ['error', 'all']`. eslint-config-prettier says `curly` "can be used just fine with Prettier as long as you don't use the 'multi-line' or 'multi-or-nest' option" [V, https://github.com/prettier/eslint-config-prettier#special-rules].
  - **Effort:** S.
- **F-6.2 (Low) CSS class names.** The shop badge previously used camelCase classes (`buyNext`). It now uses `{ best: reason }` in the current file, which is fine. Keep CSS classes kebab-case.

### 3.7 CSS architecture

- **Good.** [V]
  - Every SFC uses `<style scoped>`, as Style guide Priority A "Use component-scoped styling" requires [V, https://vuejs.org/style-guide/rules-essential.html].
  - All values come from `tokens.css`, with contrast ratios documented next to the tier colours.
  - Viewport `@media` queries appear only in `layout.css`. Components use `@container` (`JobRow.vue:269`, `ShopItem.vue`).
  - `prefers-reduced-motion` and `forced-colors` are handled in components.
  - All of this follows AD-14 exactly and is more disciplined than the reference apps; Vitesse and Elk use UnoCSS utilities [V, `unocss.config.ts` at Elk's root].
- **F-7.1 Duplicated fragments** (#6). [V]
  - `.error`: identical in `StartView.vue:36`, `GameOverView.vue:71` and `GameView.vue:172`, with the same `role="alert"` markup.
  - `.notice`: in `BoardNotice.vue:19` and `ShopPanel.vue:64`. Same markup shape: a message plus a retry button.
  - Pill badge: `JobRow.vue:215`, `ShopItem.vue:274` and `GameView.vue:160` (`.nav-hint`).
  - **Recommendation.**
    - Add `components/ErrorAlert.vue` (prop `error: GameError | null`; always renders the `role="alert"` container, which fixes #4).
    - Generalise `BoardNotice` into `RetryNotice.vue` (props `message`, `busyMessage`, `retryLabel`, `busy`), and use it on both panels.
    - Add `components/TagBadge.vue` (prop `tone: 'best' | 'trap' | 'state' | 'muted'`), or a `.badge` utility in `base.css`.
  - The spine's YAGNI threshold ("second concrete use") is met in every case.
  - **Effort:** S–M.
- **F-7.2 (Info) Bar heights measured in JS.** The ResizeObserver writes `--top-bar-height` (`GameView.vue:80-120`) to drive `scroll-padding-block`. That's a justified JS-for-CSS bridge (WCAG 2.4.11), because CSS can't read a sticky element's height [U]. Keep it, but move it into the composable (#7).

### 3.8 Tests

- **Good.** [V]
  - 225 tests across 11 files, in `__tests__/` folders next to the code, as in create-vue's layout (`src/components/__tests__/HelloWorld.spec.*`) [V, GitHub API].
  - `setActivePinia(createPinia())` runs in `beforeEach`, as the Pinia testing docs prescribe [V, https://pinia.vuejs.org/cookbook/testing.html].
  - A global `fetch` tripwire (`test-setup.ts`, AD-16) with `unstubGlobals`.
  - Behaviour-level assertions on emitted events and spoken names, real fake-timer tests for AD-18, and a pure `game/` suite with 50+ cases.
  - That's well above Vitesse's two smoke tests [V, `test/component.test.ts` uses class selectors `.inc` and `.dec` plus snapshots].
- **F-8.1 Duplicate fetch stub.** `stores/__tests__/game.spec.ts:5-46` re-implements `json`, `html404` and `stubApi` from `src/__tests__/stub-api.ts` [V]. Import the shared one. **Effort:** S.
- **F-8.2 One spec for seven components.** `components/__tests__/components.spec.ts` holds the JobRow, GameIcon, ShopItem, StatsBar, BoardNotice, ReputationPanel and ActivityLog suites. Split it into `JobRow.spec.ts` and so on, to match the "component files" norm and create-vue's per-component spec. **Effort:** S (mechanical).
- **F-8.3 Selectors tied to CSS classes.**
  - [V] Helpers query `.odds > :not(.visually-hidden)`, `.badge`, `.name` and `.visually-hidden` (`components.spec.ts:33-42`, `shop-panel.spec.ts:57-70`).
  - Vue's testing guide says "Don't test implementation details" and to test "from the user's perspective" [V, https://vuejs.org/guide/scaling-up/testing.html]. The spine says "query by role and accessible name".
  - The custom `spoken()` and `visible()` helpers are a good start.
  - **Recommendation.** Consider `@testing-library/dom`'s `getByRole(wrapper.element, 'button', { name })`.
    - `@testing-library/dom` is maintained (★3.3k, pushed 2026-09-15) [V, GitHub API].
    - `@testing-library/vue` looks dormant: latest release v8.1.0 on 2024-05-18 [V, GitHub API]. Prefer the DOM package directly with `@vue/test-utils` mounting.
  - **Effort:** M. This is a user tooling choice.
- **F-8.4 (Low) Shared router in `App.spec.ts`.** The first test uses the module-level `router` singleton (`App.spec.ts:11-13`), so its state can leak into later files [U]. Use `createRouter({ history: createMemoryHistory(), routes })` per test, as the second test already does. **Effort:** S.
- **F-8.5 (Info) No `createTestingPinia`.** View tests drive the real store with stubbed `fetch`. That's a deliberate integration style. It's valid, and arguably better here because AD-7's pipeline is the thing under test. Pinia's docs offer `createTestingPinia` for isolated component tests [V, testing page]; no change is needed.

### 3.9 Accessibility

- **Strong.** [V]
  - Native buttons, with accessible names formed by content.
  - `aria-describedby` for shortfall and unsolvable notes, with `useId()`. The Vue a11y guide shows exactly this pattern [V, https://vuejs.org/guide/best-practices/accessibility.html].
  - One `<h1>` per panel with `tabindex="-1"`, focused on route change and after a disabled control loses focus.
  - The `role="log"` section wraps an `<ol>` and is never `v-if`'d.
  - Unknown values are stated in text. Forced-colours fallbacks are in place.
  - WCAG 2.5.8 target size is respected (`--control-height-compact: 3.2rem`).
  - This is more thorough than any reference app checked.
- **F-9.1 Live regions inserted with `v-if`** (#4). `GameView.vue:146` (`role="status"` loading), `StartView.vue:21` (`role="status"` expired notice) and the three `role="alert"` errors.
  - MDN: "The element with `role="status"` should be present in the DOM before content changes occur" [V, https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role].
  - `role="alert"` is usually announced on insertion in practice [U].
  - **Recommendation.** Render the container always and bind only its text. `ErrorAlert` from F-7.1 does this once for all three alerts.
  - **Effort:** S.
- **F-9.2 (Info) Long accessible names.** Row buttons announce the full row, for example "Solve: safe, Piece of cake, 95%, 34 gold, Best pick. Escort the mayor. 5 turns left". That's deliberate (decisive cues first) and satisfies label-in-name [U, WCAG 2.5.3]. It's verbose for screen-reader users scanning by Tab. If testers complain, consider moving the message to `aria-describedby`. No action now.
- **F-9.3 (Info) Two extra landmarks.** `StatsBar` and `ReputationPanel` render `<section aria-label>`, which creates region landmarks [V, Vue a11y guide's landmark table: "`<section>` … requires label"]. That's acceptable. With a full top bar, consider whether a `<header>` landmark alone is enough. No action now.

### 3.10 Tooling and other items a Vue expert would flag

- **F-10.1 Lint noise** (#5).
  - `oxlint .` reports **2,101 warnings and 0 errors** [V, run 2026-10-05]. The biggest sources are `one-var` 365, `no-magic-numbers` 355, `sort-keys` 302, `vitest/prefer-expect-assertions` 190, `unicorn/no-null` 130 and `no-ternary` 51. Several contradict the codebase's own style, such as `no-null` (AD-11 models unknown as `null`) and `no-ternary`.
  - `eslint .` is clean, but runs `pluginVue.configs['flat/essential']` only (`eslint.config.ts:21`). The plugin offers `strongly-recommended` ("considerably improve code readability") and `recommended` ("community defaults") [V, https://eslint.vuejs.org/user-guide/].
  - **Options for the user:**
    - (a) Set oxlint to `correctness: error` and drop `style` and `pedantic`, or keep them and turn off the rules that contradict the code.
    - (b) Upgrade to `flat/recommended`.
    - (c) Add `curly: all`.
    - (d) Optionally add `vue/max-lines-per-block`.
  - **Effort:** S.
- **F-10.2 Spine sync** (doc only). [V] The code and AD-6, AD-10, AD-14 and the Stack table have drifted:
  - The `high-scores` store, persistence (AD-12) and the start-screen high-score list don't exist. They're deferred per `deferred-work.md:2` (CAP-10, 11 and 14 split). Mark them "deferred" inline in AD-6, AD-9, AD-10, AD-12 and the Structural Seed.
  - `@lucide/vue` is "to add" in the Stack table but not installed, and no UI glyphs use it.
  - `RiskLevelSwitch` (AD-14, AD-15, Structural Seed) doesn't exist.
  - `shopFailed` state is missing from AD-6's ownership list.
  - `holdsGame` covers `loading` (F-3.4).

  **Effort:** S.
- **F-10.3 (Info) Vue Router 5 typed routes** are available in core [V, migration page]. They're optional and low value with four named routes.
- **F-10.4 (Info) Mounting after `router.isReady()`** (`main.ts:20`) is good practice, and it avoids a first-paint footer flash.

---

## 4. Strengths relative to the reference apps

| Area | This app | create-vue (★4.4k, pushed 2026-10-05) | Vitesse (★9.4k, pushed 2026-02-25) | Elk (★6.0k, pushed 2026-10-05) |
|---|---|---|---|---|
| Layer boundaries | Lint-enforced per folder (AD-1) [V] | Folders only [V] | Auto-imports blur boundaries [V] | Nuxt `app/` conventions, components grouped by feature folders with a parent prefix (`status/Status*.vue`) [V] |
| Pure domain logic | `src/game/`, no Vue, 50+ unit tests [V] | n/a | `composables/` (Vue-aware) [V] | `composables/` mix pure and Vue code [V, listing] |
| Store | One setup store, stale-response guards, single turn pipeline [V] | Counter example [V, D] | Small setup store with HMR [V] | n/a |
| Accessibility | Spec-level (AD-15), live log, focus management, forced colours [V] | — | — | Has `components/aria` [V, listing] |
| Tests | 225 tests, fetch tripwire, behaviour-level [V] | One spec [V] | Two smoke tests with snapshots [V] | `tests/unit` and `nuxt` [V, listing] |
| CSS | Tokens plus container queries, `@media` only in one file [V] | Plain CSS | UnoCSS | UnoCSS [V] |

Other things done well:
- Facts in comments are tagged [V], [D] or [U]. Named constants cite their evidence.
- All copy lives in `copy.ts` with `satisfies` exhaustiveness.
- Modern Vue 3.5 APIs: `useTemplateRef`, `useId`, reactive props destructure.
- No `v-html`, enforced by lint (AD-17).

---

## 5. Sources (checked 2026-10-05)

**Vue core docs**
- Vue style guide index: https://vuejs.org/style-guide/ [V]
- Priority A rules: https://vuejs.org/style-guide/rules-essential.html [V]
- Priority B rules: https://vuejs.org/style-guide/rules-strongly-recommended.html [V]
- Priority C rules: https://vuejs.org/style-guide/rules-recommended.html [V]
- Composables (organisation, cleanup, return refs): https://vuejs.org/guide/reusability/composables.html [V]
- Composition API FAQ (logic organisation): https://vuejs.org/guide/extras/composition-api-faq.html [V]
- Props (3.5 destructure, one-way flow): https://vuejs.org/guide/components/props.html [V]
- Computed best practices: https://vuejs.org/guide/essentials/computed.html [V]
- Watchers (flush, cleanup, auto-stop): https://vuejs.org/guide/essentials/watchers.html [V]
- Performance (props stability, shallowRef): https://vuejs.org/guide/best-practices/performance.html [V]
- Accessibility: https://vuejs.org/guide/best-practices/accessibility.html [V]
- Testing: https://vuejs.org/guide/scaling-up/testing.html [V]

**Pinia**
- Setup stores and readonly warning: https://pinia.vuejs.org/core-concepts/ [V]
- Composing stores: https://pinia.vuejs.org/cookbook/composing-stores.html [V]
- Testing: https://pinia.vuejs.org/cookbook/testing.html [V]
- HMR: https://pinia.vuejs.org/cookbook/hot-module-replacement.html [V]

**Vue Router**
- Navigation guards: https://router.vuejs.org/guide/advanced/navigation-guards.html [V]
- Data fetching: https://router.vuejs.org/guide/advanced/data-fetching.html [V]
- Passing props: https://router.vuejs.org/guide/essentials/passing-props.html [V]
- v4 → v5 migration: https://router.vuejs.org/guide/migration/v4-to-v5 [V]
- `afterEach(guard): () => void`: local typings `frontend/node_modules/vue-router/dist/index-D7ja2BKs.d.ts:1531` [V]

**TypeScript**
- TSConfig `strict` family: https://www.typescriptlang.org/tsconfig/#strict [V]
- `@vue/tsconfig` base: https://raw.githubusercontent.com/vuejs/tsconfig/main/tsconfig.json and local `node_modules/@vue/tsconfig/tsconfig.json` [V]

**Linting**
- eslint-plugin-vue configs: https://eslint.vuejs.org/user-guide/ [V]
- `vue/max-lines-per-block`: https://eslint.vuejs.org/rules/max-lines-per-block.html [V]
- eslint-config-prettier `curly`: https://github.com/prettier/eslint-config-prettier#special-rules [V]

**Accessibility**
- MDN `status` role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role [V]

**Reference repos** (metadata and file listings via the GitHub API, 2026-10-05) [V]
- `vuejs/create-vue`: ★4410, pushed 2026-10-05
- `elk-zone/elk`: ★6033, pushed 2026-10-05
- `antfu-collective/vitesse`: ★9438, pushed 2026-02-25
- `vuejs/pinia`: ★14734, pushed 2026-09-26
- `vuejs/core`: ★54532
- `vuejs/router`: ★4694
- `vuejs/eslint-plugin-vue`: ★4588
- `vuejs/test-utils`: ★1160, pushed 2026-10-01
- `testing-library/dom-testing-library`: ★3335, pushed 2026-09-15
- `testing-library/vue-testing-library`: ★1121, latest release v8.1.0 on 2024-05-18

**Local runs (read-only)**
- `npx oxlint .` gave 2,101 warnings and 0 errors.
- `npx eslint . --no-cache` exited 0.
- `npx vitest run` gave 221 of 225 passing; the 4 failures were in shop files being edited mid-review.
