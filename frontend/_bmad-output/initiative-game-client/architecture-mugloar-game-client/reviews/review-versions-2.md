# Review: versions and technical claims (round 2)

- **Spine:** `architecture-mugloar-game-client.md` (status final, updated 2026-10-02)
- **Lens:** Was each committed decision checked against reality (npm registry, lockfile, installed source, specs, MDN data) rather than asserted from memory? This round focuses on what changed on 2026-10-02.
- **Reviewer date:** 2026-10-02. The game API was not called. Only read-only commands were run (`npm view`, `grep` over `pnpm-lock.yaml` and `node_modules`, downloads of public spec and compat-data files to the scratchpad).
- **Tags:** [V] = probed or read from the primary source today. [D] = documented in a secondary source, not probed. [U] = unconfirmed.

## Verdict

**Sound on versions, but two of the new platform claims are wrong or incomplete.** Every package still exists, nothing is deprecated, and the peer ranges fit. The dvh support numbers are exactly right. However:

- `<ol role="log">` is not conforming HTML.
- The mobile sticky layout has two unstated preconditions that are easy to break, plus a WCAG 2.2 AA risk.
- Of the five platform features added today, only dvh has a cited source.
- One row in the Stack table is already out of date.

## What changed on 2026-10-02, claim by claim

| # | Claim in spine | Status | Evidence |
| --- | --- | --- | --- |
| C1 | dvh: Chrome 108, Firefox 101, Safari 15.4 | **[V] correct** | `@mdn/browser-compat-data@8.1.4` (current latest), `css.types.length.viewport_percentage_units_dynamic`: chrome 108, edge 108, firefox 101, safari 15.4, safari_ios 15.4, chrome_android 108. The svh and lvh entries are identical. |
| C2 | `height: 100vh; height: 100dvh` fallback | **[V] valid but unreachable** | Vite 8.3.1's installed default target is `ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET = chrome111, edge111, firefox114, safari16.4, ios16.4` (`node_modules/vite/dist/node/chunks`). CAP-8 targets "current and previous major". No browser in scope lacks dvh. The fallback costs nothing but protects no supported browser. |
| C3 | `<ol role="log">` is an implicit polite live region | **Half right** | [V] WAI-ARIA 1.2 says: "Elements with the role log have an implicit aria-live value of polite." [V] ARIA in HTML (W3C TR, `el-ol`) allows only these roles on `ol`/`ul`: group, listbox, menu, menubar, none, presentation, radiogroup, tablist, toolbar, tree. **`log` is not allowed.** It also overrides the list role, so the `<li>` children lose their list context. [D] MDN's log role page says a log needs an accessible name (`aria-label`/`aria-labelledby`). Spine does not mention this. [U] Whether every target screen reader announces an *implicit* `log` without an explicit `aria-live` was not confirmed. The 2026 Roselli live-region support survey does not test `role="log"`. |
| C4 | Native radios styled as a button group, so arrow keys change it | **[V] correct, with caveats** | [V] WAI APG radio group: Arrow keys move focus *and check* the next radio; Tab moves into and out of the group. Native same-`name` radios behave this way. The caveats are not in the spine: (a) the input must be visually hidden, not `display:none` or `visibility:hidden` (either removes it from focus and the accessibility tree). (b) [V] ARIA in HTML allows the `radiogroup` role on `fieldset`. A `<fieldset>` + `<legend>Risk level</legend>` gives the group its name without ARIA. (c) Each arrow press checks a radio, so `setStrategy` runs per keypress. That is fine, because it calls no API. (d) AD-8 says "every action control renders `disabled`" while pending. The switch must be excluded, because `setStrategy` is exempt. |
| C5 | Below 48rem, page scrolls; stats `position: sticky` top, log sticky bottom | **[V] supported; preconditions missing** | [V] BCD: `position: sticky` is unprefixed in Chrome 56, Firefox 32, Safari 13. [V] MDN `position`: a sticky element "sticks to its nearest ancestor that has a scrolling mechanism (created when overflow is hidden, scroll, auto, or overlay)". It is also constrained by its containing block. Two unstated risks follow. (1) Any `overflow-x: hidden` on `html`/`body`/`.game` is a common way to satisfy CAP-8's no-horizontal-scroll rule, and it silently breaks both sticky bars. `overflow: clip` does not create a scroll container ([V] BCD: Chrome 90, Firefox 81, Safari 16, all in scope). (2) The stats bar sticks only within its parent. If it sits inside the "top bar" wrapper (stats + reputation + switch + nav, per AD-10/AD-14), it scrolls away once that wrapper's bottom edge passes. The same applies to the log, which must sit in the page-tall container. |
| C6 | WCAG 2.2 AA with sticky top + bottom on a 360 px screen | **Risk not addressed** | [V] WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum), level AA: a focused component must not be entirely hidden by author content. The Understanding doc names sticky headers and footers as the typical failure. It lists **C43 `scroll-padding`** as a sufficient technique. With a sticky stats bar plus a bounded sticky log on a short (e.g. landscape) phone, Tabbing through ad cards can land focus under either bar. |
| C7 | Fixed-height grid ≥48rem, page never scrolls | **Conflict with current shell** | `src/App.vue` renders `<footer class="site-footer">` after `<RouterView/>`, and the Conventions table requires per-author icon credits in the footer. A `100dvh` game grid plus a footer outside it makes the page scroll, which breaks CAP-15. `.game` also has `max-width` + padding in `layout.css`. Not a version issue, but the dvh decision depends on it. |
| C8 | vue-router child routes rendered through `GameView`'s `<RouterView>` | **[V] correct for v5** | [V] Installed `vue-router@5.3.1` types: `children?: RouteRecordRaw[]`, `RouterView` exported. [V] Router docs (v4.x/v5.x) on nested routes: the parent needs `<router-view>`; `path: ''` gives a default child; named children are recommended. [V] v4→v5 migration guide: "If you're using Vue Router 4 without unplugin-vue-router, there are no breaking changes." Nested routes, `redirect`, `afterEach`, and `createWebHistory` are untouched. Current `src/router/index.ts` still uses component-less `ads`/`shop` children (`children: []`) from the side-by-side design. The spine's change is a code task, not a version risk. |
| C9 | Focus moves to the new `<h1>` on route change | **[V] feasible; mechanism unstated** | [V] Router docs, navigation resolution flow: `afterEach` is step 10, "DOM updates triggered" is step 11. So focusing in `afterEach` directly finds the *old* h1. Deferring with `nextTick` is required. That is what `src/App.vue` already does, and it works for eagerly imported components. It breaks if a route component becomes lazy (`() => import()`), because the async chunk renders after that tick. A plain `<h1>` is not focusable. The code already adds `tabindex="-1"` (StartView, GameOverView, Ads/ShopPanel), but the spine does not say so. Also, `querySelector('h1')` relies on AD-15's one-h1 rule. Now that panels are child routes, each panel always owns its h1, which is simpler than today's `h1`/`h2` swap. |

## Stack table vs `package.json`, lockfile and registry (2026-10-02)

| Package | Spine | package.json | Lockfile | npm latest | Note |
| --- | --- | --- | --- | --- | --- |
| Node | ^22.18.0 or >=24.12.0 | same (`engines`) | — | — | local v26.10.0 |
| pnpm | not pinned, 12.6.0 locally | none | — | 12.8.1 | local 12.6.0 [V]. Matches the user's decision |
| typescript | ~6.0 | ~6.0.0 | 6.0.3 | **7.0.2** (released 2026-07-08) | deferral still valid: vue-tsc 3.3.12, published today, still depends on `@volar/typescript 2.4.28`. Secondary sources [D] say Vue tooling waits for the TS 7.1 API |
| vue | ^3.5.42 | ^3.5.42 | 3.5.43 | 3.5.43 | ok |
| pinia | ^4.0.3 | ^4.0.3 | 4.0.3 | 4.0.3 | peers unchanged (`@vue/devtools-api ^8.1.5` required) |
| @vue/devtools-api | **^8.1.5 (to add)** | **^8.2.1** (already added) | 8.2.1 | 8.2.1 | **Stale row**: already a direct dependency, at a different range |
| vue-router | ^5.3.1 | ^5.3.1 | 5.3.1 | 5.3.1 | peers fit (vue ^3.5.34, pinia ^4.0.2, vite ^8) |
| vite | ^8.2.2 | ^8.2.2 | 8.3.1 | 8.3.2 | ok |
| vitest | ^4.1.11 | ^4.1.11 | 4.1.11 | 5.0.3 (`V4` = 4.1.11) | deferral noted |
| @vue/test-utils / jsdom | ^2.5 / (unversioned) | ^2.5.0 / ^30.0.1 | 2.5.1 / 30.1.1 | 2.5.1 / 30.1.1 | ok. The jsdom range is not stated in the spine |
| oxlint + ESLint | ~1.82 / ^10.10 | ~1.82.0 / ^10.10.0 | 1.82.0 / 10.11.0 | 1.86.0 / 10.11.0 | the tilde holds oxlint four minors behind. Deliberate? Not stated |
| @lucide/vue | ^1.49.0 (to add) | absent | — | **1.50.0** (published 2026-10-02) | caret covers it. Not deprecated |
| @fontsource-variable/fredoka, nunito | ^5.3.0 (to add) | absent | — | 5.3.0 | ok |

Nothing is deprecated (`npm view <pkg> deprecated` was empty for all of the above).

## Findings

### F1 — High — `<ol role="log">` is non-conforming and drops list semantics
- **Evidence:** C3. ARIA in HTML does not allow `log` on `ol`.
- **Fix:** In AD-15, use `<section role="log" aria-live="polite" aria-labelledby="log-heading">` (or a `div`) wrapping a plain `<ol>`. The redundant `aria-live` is a hedge for [U] screen reader support of the implicit value. Name the log, because MDN requires an accessible name. Cite WAI-ARIA 1.2 §log and ARIA in HTML.

### F2 — Medium — Mobile sticky layout: unstated preconditions plus a WCAG 2.2 AA (2.4.11) risk
- **Evidence:** C5, C6.
- **Fix:** Add three lines to AD-14:
  1. No ancestor of the sticky bars may set `overflow` hidden, auto, or scroll. Use `overflow-x: clip` if horizontal clipping is needed.
  2. The sticky stats bar and log are direct children of the page-tall game container, not of the top-bar wrapper.
  3. Set `html { scroll-padding-block: <stats height> <log height> }` (WCAG C43), and keep the log's max height small enough that 2.4.11 holds at 360 × 640 portrait and in landscape.

### F3 — Medium — Today's platform decisions are mostly unsourced
- **Evidence:** Of C3, C4, C5, C8, and C9, only dvh (C1) has a Sources entry. The `[V]` tag sits only on the dvh numbers.
- **Fix:** Add these to Sources:
  - WAI-ARIA 1.2 §log
  - ARIA in HTML (`ol`/`fieldset` rows)
  - WAI APG radio pattern
  - MDN `position` (sticky)
  - WCAG 2.2 Understanding 2.4.11 / C43
  - Vue Router nested routes, navigation guards, and the v4→v5 migration guide

  Tag the role=log AT-support assumption [U].

### F4 — Medium — The fixed-height game grid conflicts with the app-level footer
- **Evidence:** C7.
- **Fix:** In AD-14 or AD-10, say where the footer credits live on the game screen. Either move the footer outside the game route (render it only on `/` and `/over`), or put it inside the grid's last row or the scrolling panel. Then "the page never scrolls" holds.

### F5 — Low — Stack row for `@vue/devtools-api` is stale
- **Evidence:** The spine says `^8.1.5 (to add)`. `package.json` has `^8.2.1`, and the lockfile has 8.2.1.
- **Fix:** Change the row to `^8.2.1` (required peer of Pinia 4) and drop "to add".

### F6 — Low — Focus-on-route-change mechanism not written down
- **Evidence:** C9. `afterEach` runs before the DOM update. A plain `h1` needs `tabindex="-1"`. Both are already in the code but not in the spine.
- **Fix:** In AD-15, state the mechanism: "`router.afterEach` + `nextTick`, skipped on the initial navigation; every route-level `<h1>` has `tabindex="-1"`; route components are imported eagerly (lazy imports need focus in the component's `onMounted` instead)."

### F7 — Info
- **dvh fallback:** The 100vh line in AD-14 is harmless. You can keep it or drop it. If kept, note that the Vite default target (Safari 16.4+) already implies dvh.
- **Radio switch:** AD-8's blanket "every action control renders disabled while pending" should exempt the Risk level switch, to match the `setStrategy` exemption. AD-15 should say "fieldset + legend, inputs visually hidden (not `display:none`)".
- **TS 7 source:** The spine's TS 7 source is the June 2026 RC article. TS 7.0.2 has been stable since 2026-07-08. Cite the stable release and the vue-tsc status instead, and re-check when vue-tsc moves off `@volar/typescript 2.4.x`.
- **oxlint pin:** `~1.82` holds oxlint at 1.82 while 1.86 is out. Fine if deliberate (it pairs with `eslint-plugin-oxlint ~1.82.0`), but say so.

## Sources consulted (2026-10-02)

- npm registry via `npm view` (versions, dist-tags, deprecated, peerDependencies, publish times); `pnpm-lock.yaml`; `node_modules/vite/dist/node/chunks` (default build target); `node_modules/vue-router` 5.3.1 type declarations
- MDN browser-compat-data 8.1.4, `data.json` from unpkg: `css.types.length.viewport_percentage_units_*`, `css.properties.position.sticky`, `css.properties.overflow.clip`, `css.at-rules.container`
- WAI-ARIA 1.2, log role: https://www.w3.org/TR/wai-aria-1.2/#log
- ARIA in HTML: https://www.w3.org/TR/html-aria/ (`el-ol`, `el-ul`, `fieldset`)
- MDN log role: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role
- Roselli, Live Region Support (2026-01), which does not cover `role="log"`: https://adrianroselli.com/2026/01/live-region-support.html
- WAI APG radio group: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- MDN `position`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position
- WCAG 2.2 Understanding 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Vue Router nested routes: https://router.vuejs.org/guide/essentials/nested-routes.html
- Vue Router navigation guards: https://router.vuejs.org/guide/advanced/navigation-guards.html
- Vue Router v4→v5 migration: https://router.vuejs.org/guide/migration/v4-to-v5.html
- TypeScript 7 / Vue status [D]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ and https://www.techtimes.com/articles/320049/20260710/typescript-7-now-stable-10-faster-builds-not-vue-svelte-yet.htm
