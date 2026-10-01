---
id: SPEC-mugloar-game-client
companions:
  - api-contract.md
  - observed-values.md
  - game-flow.md
  - risk-cues.md
  - design-assets.md
  - ../architecture-mugloar-game-client/architecture-mugloar-game-client.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Dragons of Mugloar Game Client

## Why

A vision to realize: a playable browser UI for the Dragons of Mugloar game API (https://dragonsofmugloar.com/doc/#api-Game) in which a human player picks which ads to solve and what to buy. The UI should let the player judge risk and reward at a glance, and the codebase is also a showcase of Vue best practices, SOLID, and KISS. Large parts of the API are undocumented, so the client records what it observes instead of trusting guesses.

## Capabilities

- **CAP-1**
  - **intent:** Player starts a new game from a start screen and lands on the game screen.
  - **success:** Clicking start calls `game/start` once and shows a game screen with lives, gold, level, score, and turn from the response.
- **CAP-2**
  - **intent:** Player sees every ad currently on the message board.
  - **success:** The board shows each ad's message, reward, expiresIn, and probability, with encrypted ads decoded. It refreshes after every action that consumes a turn.
- **CAP-3**
  - **intent:** Player picks an ad to solve and learns the outcome.
  - **success:** Picking an ad calls `solve/:adId` with the decoded adId. The client shows the response `message` and whether it succeeded, updates lives, gold, score, and turn, and refreshes the board.
- **CAP-4**
  - **intent:** Player buys items from the shop.
  - **success:** The shop lists each item's name, cost, and its verified effect from `observed-values.md` (+1 or +2 level, or +1 life). An item with no recorded effect shows none. Buying calls `shop/buy/:itemId`, shows success or failure, and updates gold, lives, level, and turn. When gold is known and below the cost, the buy control is disabled and shows the shortfall, because a failed buy still costs a turn [V].
- **CAP-5**
  - **intent:** Player sees their reputation with people, the state, and the underworld.
  - **success:** When the player asks, the client calls `investigate/reputation` and shows all three values, labelled as costing one turn.
- **CAP-6**
  - **intent:** The player can read the risk and reward of every choice before reading any text.
  - **success:** Each ad visibly encodes its risk tier, its reward rank, and its urgency. Each shop item visibly shows whether it is affordable (gold ≥ cost). The mapping is in `risk-cues.md`.
- **CAP-7**
  - **intent:** When no lives remain, the player sees the game end and can restart.
  - **success:** Once lives reach 0, an end screen shows the final score and turn. Restart starts a new game directly (CAP-1), with no state left over from the previous game.
- **CAP-8**
  - **intent:** Player can play on mobile and desktop in common browsers.
  - **success:** Every flow can be completed without horizontal scroll at 360 px and at 1440 px widths, in the current and previous major versions of Chrome, Firefox, Safari (macOS and iOS), and Edge.
- **CAP-9**
  - **intent:** The client keeps working when the API returns a value not yet in `observed-values.md`.
  - **success:** An ad with an unlisted `probability` or `encrypted` value still renders, with neutral styling. In dev builds, a console warning names the field and the value so the registry can be updated.
- **CAP-10**
  - **intent:** Player sees their own best scores.
  - **success:** Each finished game's score is kept on the device. The list, best first, is visible on the start and end screens and survives a reload. A game that expires while idle, with a known score, is recorded once and labelled as expired.
- **CAP-11**
  - **intent:** A game in progress survives a page reload.
  - **success:** After a reload mid-game, the same gameId and stats come back and play continues. If the API rejects the saved gameId, the save is cleared and the start screen is shown.
- **CAP-12**
  - **intent:** The player sees what happened on the last turn.
  - **success:** After every action that consumes a turn (solve, buy, reputation), a summary shows the action taken (which ad or item), the API result message, and how lives, gold, score, level, and turn changed (for example −1 life, +251 gold). The summary is still shown after a reload (CAP-11).
- **CAP-13**
  - **intent:** The player is never misled by a board that failed to refresh.
  - **success:** When the board can't be refreshed, the client retries it automatically at most twice. Solving stays disabled until a refresh succeeds; the shop stays usable. If the retries fail, the board shows a tavern-voice notice (for example *"The barman went to put up new posters. Come back later, or have a beer."*) with a plainly labelled retry button.
- **CAP-14**
  - **intent:** The player can continue a game on another device through its link.
  - **success:** Opening `/game/<gameId>/…` on a device with no save for that game shows the board and the shop. The stats show as unknown until the next action. A game that has ended or expired shows a notice and returns to the start screen.

## Constraints

- The API contract follows the live API, which differs from its docs. See `api-contract.md`.
- Undocumented, enum-like fields are documented only from observation, in `observed-values.md`, with source and date. Nothing is added from memory or guesswork.
- Every factual claim about the API or third-party assets, in this spec and its companions, carries a tag: **[V]** verified (with source and date), **[D]** stated in the docs but not observed, or **[U]** unverified. Untagged statements are design decisions. Verified facts in this kernel: the encryption schemes, `highScore` staying 0, open CORS.
- `investigate/reputation` and `shop/buy` each consume a turn, so they age the ads. Reputation is therefore fetched only when the player asks, never automatically on each loop.
- Encrypted ads are decoded before display. `encrypted: 1` is base64 and `encrypted: 2` is ROT13, applied to `adId`, `message`, and `probability`. Both schemes were verified, and the solve endpoint accepts the decoded adId.
- The API's `highScore` field isn't used: it stayed at 0 in every probe game. High scores (CAP-10) are kept by the client.
- Keep API calls to a minimum, out of courtesy to a free third-party provider. Never poll. Refetch messages only after an action that consumes a turn. The only automatic retry is the board refetch in CAP-13: at most 2 retries, for network errors, 5xx, and 429, never for 404. Fetch the shop list once per game: it didn't change across 23 level-ups or 3 reputation checks [V], though it's untested beyond that range [U].
- CORS is open (`*`), so the client calls `https://dragonsofmugloar.com/api/v2` directly with no proxy.
- The stack is Vue 3 Composition API, TypeScript, Pinia, and vue-router, as already in the repo. Only a single service module talks to the API. Components are presentational, and game state lives in a store that is mirrored to `localStorage` (SOLID: single responsibility, dependency inversion).
- Root font size is reset to 10px (62.5%), and sizes use `rem`. `px` is used only where `rem` is unsuitable, such as hairline borders.
- Accessibility from the start: WCAG 2.2 AA, semantic HTML, every action keyboard-operable, and reduced-motion preferences respected.
- Every player-facing error, notice, and empty state uses in-world tavern voice. Each one still says what happened and what to do, and button labels state the plain action.
- Architecture rules (layering, state ownership, the turn pipeline, persistence, routes) are in the adopted architecture companion. Its `AD-n` ids are stable and may be cited.

## Non-goals

- Move recommendations or hints, including gold-per-turn advice on which items to buy. These need a separate backend and integration, and go in a later spec.
- Auto-play or a bot.
- A victory screen or end state at 1000 points.
- Accounts, server-side leaderboards, and syncing saved state between devices. A game link continues play on another device (CAP-14), but stats aren't carried over.
- Showing reputation automatically each turn (see Constraints).

## Success signal

- On a phone and on a desktop browser, a human player starts a game and reaches a score of at least 1000 through the UI alone. Reaching 1000 shows that the game works; scores have no upper limit. A reload partway through resumes the same game. Losing all lives shows the end screen with the score added to the player's high scores, and restart begins a new game.

## Open Questions

These don't block the UI, but they decide whether buying items is worth it. Recorded for later probes and for the recommendations spec.

- Does dragon level affect solve success? [U] The A/B test was inconclusive. There's weak evidence that it doesn't: moderate ads won 82% at level 0 and 79% at levels 24–45. Rewards grow with turns even at level 0 [V], so level isn't needed to explain them. If level has no effect, every item except `hpot` is wasted gold.
- Do boards get harder because of turn count, or because the safe ads get used up? [U] That they get harder is [V]: at level 0, safe ads fell from 37% of the board to 0% by turn 50 (`observed-values.md`). The risk cues (CAP-6) matter most in the late game.

## Assumptions

- Risk tiers in `risk-cues.md` come from measured win rates [V], but the sample is small (about 15 attempts per label, mostly at level 0). Sure thing's "safe" tier carries an unresolved contradiction.
- Each cue pairs colour with an icon or shape so that meaning never depends on colour alone.
