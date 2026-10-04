# Review: versions and technical claims

- **Spine:** `architecture-mugloar-game-client.md` (draft, 2026-10-01)
- **Lens:** Was each committed decision checked against reality (npm registry, lockfile, upstream docs, installed source) rather than asserted from memory?
- **Reviewer date:** 2026-10-01. The game API was not called.

## Verdict

**Mostly sound. No blocking version errors.** Every named package exists, none is deprecated, and peer ranges fit together. The Stack table matches `package.json`, and the lockfile resolves inside each range. All the technical claims I checked hold up: rem in media queries, `vi.stubGlobal`, the Vite preview SPA fallback, Pinia setup stores with `watch`, and the game-icons licence.

The gaps are smaller:
- The spine cites no sources (`sources: []`).
- pnpm is not actually pinned.
- Pinia 4 relies on a peer dependency it gets only implicitly.
- AD-16's "a test that reaches the network fails" has nothing enforcing it.
- The game-icons attribution needs to name individual authors.

## Evidence summary (npm registry, 2026-10-01)

| Package | Spine | package.json | Lockfile | npm latest | Deprecated | Peer fit |
| --- | --- | --- | --- | --- | --- | --- |
| vue | ^3.5.42 | ^3.5.42 | 3.5.43 | 3.5.43 | no | — |
| pinia | ^4.0.3 | ^4.0.3 | 4.0.3 | 4.0.3 | no | peers `vue ^3.5.11`, `typescript >=5.6.0` (optional), `@vue/devtools-api ^8.1.5` (**required**). Fits. |
| vue-router | ^5.3.1 | ^5.3.1 | 5.3.1 | 5.3.1 | no | peers `vue ^3.5.34 \|\| ^4`, `vite ^7.3 \|\| ^8` (opt), `pinia ^3.0.4 \|\| ^4.0.2` (opt). Fits. |
| vite | ^8.2.2 | ^8.2.2 | 8.3.1 | 8.3.2 | no | engines `node ^20.19 \|\| >=22.12`. Fits. |
| vitest | ^4.1.11 | ^4.1.11 | 4.1.11 | **5.0.3** (`V4` tag = 4.1.11) | no | peers `vite ^6 \|\| ^7 \|\| ^8`, `jsdom *`. Engines `node ^22.12 \|\| ^24 \|\| >=26`. Fits. |
| typescript | ~6.0 | ~6.0.0 | 6.0.3 | **7.0.2** | no | vue-tsc 3.3.11 peer `>=5.0.0` |
| jsdom | (implied) | ^30.0.1 | 30.1.1 | 30.1.1 | no | — |
| @vue/test-utils | ^2.5 | ^2.5.0 | 2.5.1 | 2.5.1 | no | peer `vue 3.x` |
| oxlint | ~1.82 | ~1.82.0 | 1.82.0 | 1.86.0 | no | — |
| eslint | ^10.10 | ^10.10.0 | 10.11.0 | 10.11.0 | no | — |
| @lucide/vue | 1.49.0 | **absent** | absent | 1.49.0 (published 2026-09-29) | no | peer `vue >=3.0.1` |
| lucide-vue-next | — | — | — | 1.0.0 | **yes**: "Please use @lucide/vue instead." | — |
| @fontsource-variable/fredoka | 5.3.0 | **absent** | absent | 5.3.0, OFL-1.1 | no | — |
| @fontsource-variable/nunito | 5.3.0 | **absent** | absent | 5.3.0, OFL-1.1 | no | — |

These were gathered with `npm view <pkg> version|deprecated|peerDependencies|peerDependenciesMeta|engines|dist-tags|license` and `grep` over `pnpm-lock.yaml`. Locally, Node is v26.10.0 and pnpm is 12.6.0. The lockfile is `lockfileVersion: '9.0'`.

## Findings

### F1 — Medium — The spine records no sources for its version or technical claims

- **Checked:** the frontmatter `sources: []` and the inline citations.
- **Evidence:** The only citation in the spine is `[V, Media Queries 4]` in AD-14. Nothing records the Stack versions, the TS 7 and Vitest 5 deferrals, the Pinia 4 claims, the SPA fallback, or the licence claims as checked. All of them turned out to be correct (see the table above and F2–F9), but a reader can't tell that from the document.
- **Fix:** Fill in `sources:` with the URLs below, or add a "Verified 2026-10-01" note under the Stack table. Give the TS 7 deferral its real reason (F6) rather than only "the template's pins work".

### F2 — Medium — AD-16 "a test that reaches the network fails" is not enforced by anything

- **Checked:** whether `vi.stubGlobal` works in Vitest 4, and whether the current config makes unstubbed network calls fail.
- **Evidence:**
  - `vi.stubGlobal(name, value)` exists in Vitest 4.1.11 (`node_modules/vitest/dist/index.d.ts:588`). It patches `globalThis` and, under jsdom, `window` too (https://vitest.dev/api/vi.html#vi-stubglobal). So stubbing `fetch` works.
  - `vitest.config.ts` sets no `setupFiles` and no `unstubGlobals`. Under the jsdom environment, Node's native `fetch` is still on `globalThis`, so a test that forgets the stub really hits the network.
  - Without `unstubGlobals: true`, the option exists (`vitest/dist/config.d.ts:59`, default false), so stubs also leak between tests in the same file.
- **Fix:** Add a `test.setupFiles` entry that stubs `fetch` with a function that throws ("network disabled in tests"), and set `test.unstubGlobals: true`. Then reword AD-16 to name that mechanism.

### F3 — Low/Medium — pnpm is "per lockfile", but the lockfile doesn't pin pnpm

- **Checked:** the Stack row `pnpm | per lockfile`.
- **Evidence:** `pnpm-lock.yaml` records only `lockfileVersion: '9.0'`, which several pnpm majors share. `package.json` has no `packageManager` field. pnpm 12.6.0 is installed locally.
- **Fix:** Add `"packageManager": "pnpm@12.6.0"` (Corepack) to `package.json`, or `engines.pnpm`. Then cite it in the Stack table.

### F4 — Low/Medium — Pinia 4's required `@vue/devtools-api` peer is satisfied only implicitly

- **Checked:** Pinia 4 peer requirements against `package.json`.
- **Evidence:**
  - The Pinia v4.0.0 release notes say: "upgrading `@vue/devtools-api` which now must be installed alongside pinia" (https://github.com/vuejs/pinia/releases).
  - `npm view pinia@4.0.3 peerDependenciesMeta` lists `'@vue/devtools-api': { optional: false }`.
  - The lockfile resolves it (8.2.1) only through pnpm's auto-installed peers. It is not a direct dependency.
- **Fix:** Add `@vue/devtools-api` (^8.1.5) to `dependencies`, and list it in the Stack table next to Pinia, so the install doesn't depend on the `auto-install-peers` setting.

### F5 — Low — Three Stack entries aren't installed yet, and they use a different pinning style

- **Checked:** the Stack table against `package.json` and the lockfile.
- **Evidence:**
  - `@lucide/vue`, `@fontsource-variable/fredoka`, and `@fontsource-variable/nunito` are in neither `package.json` nor `pnpm-lock.yaml`. Their versions do exist on npm and are current (1.49.0, 5.3.0, 5.3.0).
  - They are written as exact versions, while every other row uses `^` or `~`.
  - All the other rows match `package.json` exactly, and the lockfile resolves within range.
- **Fix:** Either mark them "to add", or install them now with the project's usual `^` prefix so the table and `package.json` agree. Choosing `@lucide/vue` over `lucide-vue-next` is correct, because the latter is deprecated in its favour.

### F6 — Info — The TypeScript 7 and Vitest 5 deferrals are right, but the stated reason is weak

- **Checked:** the "Tooling major upgrades (Vitest 5, TypeScript 7)" deferral.
- **TypeScript evidence:**
  - TS 7.0 (Go native) went GA on 2026-07-08 (`npm view typescript time`: 7.0.2 published on that date).
  - vue-tsc relies on the TS programmatic API, which isn't stable in TS 7. Microsoft ships `@typescript/typescript6` as a bridge, and support is expected in 7.1 at the earliest (https://byteiota.com/typescript-7-go-native-compiler/, https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx).
  - So `~6.0` is required, not just convenient.
- **Vitest evidence:**
  - Vitest 5.0 was released on 2026-09-03 (https://vitest.dev/blog/vitest-5.html).
  - Its breaking changes include `clearMocks` defaulting to true and unawaited async assertions now failing the test.
  - The `V4` dist-tag still points at 4.1.11.
- **Fix:** Reword the deferral along these lines: "TS stays on 6.x until vue-tsc supports TS 7 (expected 7.1+). Vitest 5 is a deliberate later upgrade; note that it changes the `clearMocks` default."

### F7 — Info (confirmed) — rem and em in media queries use the initial font size

- **Checked:** the AD-14 claim.
- **Evidence:** Media Queries Level 4 says: "Relative length units in media queries are based on the initial value, which means that units are never based on results of declarations." Its example: "in HTML, the em unit is relative to the initial value of font-size, defined by the user agent or the user's preferences" (https://www.w3.org/TR/mediaqueries-4/#units).
- **Result:** With `html { font-size: 62.5% }`, `48rem` in a media query is still 768px at the default 16px.
- **Fix:** None needed. Optionally replace "[V, Media Queries 4]" with the URL above.

### F8 — Info (confirmed) — `vite preview` serves `index.html` for unknown paths

- **Checked:** the Deployment claim that the SPA fallback works under `pnpm preview`.
- **Evidence:**
  - Installed Vite 8.3.1 source, `node_modules/vite/dist/node/chunks/node.js:35447`: the preview server runs `htmlFallbackMiddleware(distDir, config.appType === "spa")`.
  - In that middleware (line 16913 onward), a GET request whose Accept header includes text/html, and which isn't an existing `.html` file, is rewritten to `/index.html`.
  - `appType` defaults to `'spa'` (index.d.ts:3650), and `vite.config.ts` doesn't override it.
  - Vite's docs warn that preview is "not designed" to be a production server (https://vite.dev/guide/cli).
- **Result:** Reloading `/game/:id/ads` works under `pnpm dev` and `pnpm preview`. The deferred Docker server still has to be configured for the fallback, as the spine already says.

### F9 — Info (confirmed, with caveats) — Pinia 4 setup stores and `watch`-based localStorage persistence

- **Checked:** AD-12 and the setup-store convention against Pinia 4.
- **Evidence:**
  - Pinia docs: setup stores can use `ref`, `computed`, watchers, and any composable. You "must return all state properties" (https://pinia.vuejs.org/core-concepts/#Setup-Stores).
  - The Pinia 4 release notes list only ESM-only and the devtools-api upgrade as breaking changes. Nothing changes for setup stores or `watch` (https://github.com/vuejs/pinia/releases). Note that pinia.vuejs.org still labels its docs as v3.x.
- **Caveats for the rule text:**
  - The `watch` needs `{ deep: true }`, or a getter that builds the persisted snapshot. Without it, nested mutations to the board or stats won't trigger a write.
  - The key `mugloar:v<N>:game:<gameId>` changes with `gameId`, so the watch has to read `gameId` inside the callback.
  - `pending` and `error` still have to be returned from the store, as Pinia requires, but they are left out of the snapshot.
- **Fix:** Add "deep watch on a snapshot getter" to AD-12.

### F10 — Low — The game-icons.net attribution must name each author, not only the site

- **Checked:** the claim that game-icons.net is CC BY 3.0.
- **Evidence:** https://game-icons.net/about.html says the icons are under CC BY 3.0, and gives the required credit form as "Icons made by {author}. Available on https://game-icons.net". Some "Various artists" icons come from Wikimedia Commons and may have different licences.
- **Fix:** Change the Icons convention to "credited in the footer by author (for example Lorc, Delapouite), with a link to game-icons.net and the CC BY 3.0 licence". Avoid "Various artists" icons, or check their licences one by one. The Fredoka and Nunito Fontsource packages are OFL-1.1, which needs no UI credit, so the fonts convention is fine as written.

### F11 — Info (confirmed) — The engines range fits the toolchain

- **Checked:** the Node `^22.18.0 || >=24.12.0` row.
- **Evidence:**
  - Vite 8 needs `^20.19 || >=22.12`.
  - Vitest 4.1.11 needs `^22.12 || ^24 || >=26`.
  - Both contain the declared range. Local Node is v26.10.0.
- **Result:** No action needed.

## Sources

- npm registry, queried via `npm view` on 2026-10-01: versions, deprecations, peers, engines, dist-tags, licences
- https://www.w3.org/TR/mediaqueries-4/#units
- https://vitest.dev/api/vi.html#vi-stubglobal
- https://vitest.dev/blog/vitest-5.html
- https://vite.dev/guide/cli
- https://pinia.vuejs.org/core-concepts/#Setup-Stores
- https://github.com/vuejs/pinia/releases
- https://game-icons.net/about.html
- https://byteiota.com/typescript-7-go-native-compiler/
- https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx
- Installed source: `node_modules/vite/dist/node/chunks/node.js` (lines 16913 and 35447), `node_modules/vitest/dist/index.d.ts` (line 588), `node_modules/vitest/dist/config.d.ts` (line 59)
