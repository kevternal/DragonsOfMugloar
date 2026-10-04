# API contract

**Tags:** **[V]** means verified against the live API, with the probe date. **[D]** means stated in the docs (https://dragonsofmugloar.com/doc/) but not observed. **[U]** means unverified. Where the live API and the docs disagree, the live API wins.

The base URL is `https://dragonsofmugloar.com/api/v2`. [V 2026-10-01]

| Call | Method + path | Response | Consumes turn |
|---|---|---|---|
| Start game | `POST /game/start` | `{gameId, lives, gold, level, score, highScore, turn}` [V] | — |
| Messages | `GET /:gameId/messages` | `Ad[]` as a bare array [V]. The docs claim `{messages: []}`. | No [V] |
| Solve | `POST /:gameId/solve/:adId` | `{success, lives, gold, score, highScore, turn, message}` [V] | Yes, +1 [V] |
| Shop | `GET /:gameId/shop` | `Item[]` as a bare array [V]. The docs claim `{items: []}`. | No [U] |
| Buy | `POST /:gameId/shop/buy/:itemId` | `{shoppingSuccess, gold, lives, level, turn}` [V] | Yes, even when the purchase fails [V] |
| Reputation | `POST /:gameId/investigate/reputation` | `{people, state, underworld}` [V] | Yes [V]. Inferred: the turn went 0 → 2 after one investigate and one buy. |

## `Ad` fields

`Ad` = `{adId: string, message: string, reward: number, expiresIn: number, encrypted: number | null, probability: string}` [V]

- `reward` is a number in the live API. The docs say it's a string. [V]
- `encrypted` and `probability` are undocumented. Their values are in `observed-values.md`. [V]
- When `encrypted` is non-null, `adId`, `message`, and `probability` are encoded. The decoded adId is accepted by solve. [V]
- `expiresIn` is the number of turns until the ad becomes unavailable. [D]

## `Item` fields

`Item` = `{id: string, name: string, cost: number}` [V]. The observed list is in `observed-values.md`.

## Other behaviour

- `level` appears only in the start and buy responses. The solve response doesn't include it. [V]
- The API returns 403 to Python urllib's default User-Agent; curl's is accepted. This matters for scripts and Node tests. [V] Browsers are unaffected. [U]
- CORS: `access-control-allow-origin: *`. [V]

## Game lifetime

- `POST /game/start` takes no gameId. The path form returns "Cannot POST", and a `gameId` in the body is ignored, so a new game is returned. [V]
- Starting a new game doesn't end games that are already running. [V]
- Games expire when idle. [V] Game A (2 lives) returned 404 about 40 minutes after its last action. Game `lce6tyQC` was alive 5 minutes after its start and returned 404 about 97 minutes after its last read. The exact timeout, somewhere between 5 and about 40 minutes, is [U], as is whether a free `GET` resets the idle timer.

## Errors

- An unknown `gameId` returns 404 with an HTML body, not JSON. [V] A finished game also returns 404 "Not Found" on `GET messages`. [V] A route that doesn't exist returns 404 "Cannot GET …". [V]
- There's no endpoint that reads stats (lives, gold, level, score, turn) without taking an action. `GET /:gameId`, `/game/:gameId`, and `/:gameId/game` all return 404. [V] Only start, solve, and buy return stats, and only solve returns score.
- The client treats any non-2xx response as an error state and doesn't crash.
- A buy with an unknown itemId returns 200 and still consumes a turn. [V] Response body not inspected.
- Solving an ad that is no longer on the server: the response is [U]. Ads expire by turns [D], and turns advance only on player actions [V], so this happens only with a stale board: a failed refetch after a turn, or the same game played from another tab or device. The client shows the error, refreshes the board, and play continues.

## Game over

The client treats `lives === 0` in a solve or buy response as game over. This is a client rule. A response with `lives: 0` was observed [V], and a later `GET messages` on that finished game returned 404 "Not Found" [V]. Responses from the other endpoints on a finished game are [U].
