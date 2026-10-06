import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LIVE_SHOP, liveItem } from '@/__tests__/stub-api'
import { BOARD_RETRY_DELAYS_MS, useGameStore } from '../game'

type Handler = () => Response | Promise<Response>
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const html404 = () => new Response('<html>Not Found</html>', { status: 404 })

const ads = [
    {
        adId: 'a1',
        message: 'Job one',
        reward: 10,
        expiresIn: 2,
        encrypted: null,
        probability: 'Sure thing',
    },
    {
        adId: 'a2',
        message: 'Job two',
        reward: 20,
        expiresIn: 3,
        encrypted: 9,
        probability: 'Risky',
    },
]
const items = [
    { id: 'hpot', name: 'Healing potion', cost: 50 },
    { id: 'cs', name: 'Claw Sharpening', cost: 100 },
]
const startBody = { gameId: 'g1', lives: 3, gold: 0, level: 0, score: 0, highScore: 0, turn: 0 }

/** Routes fetch calls by "METHOD path". Records every call. */
function stubApi(routes: Record<string, Handler>) {
    const calls: string[] = []
    const fn = vi.fn<typeof fetch>((input, init) => {
        const url = String(input).replace('https://dragonsofmugloar.com/api/v2', '')
        const key = `${init?.method ?? 'GET'} ${url}`
        calls.push(key)
        const handler = routes[key]
        if (!handler) {
            throw new Error(`No stub for ${key}`)
        }
        return Promise.resolve(handler())
    })
    vi.stubGlobal('fetch', fn)
    return calls
}

const base = {
    'POST /game/start': () => json(startBody),
    'GET /g1/shop': () => json(items),
    'GET /g1/messages': () => json(ads),
}

describe('game store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('start: one POST, then shop and messages, stats shown', async () => {
        const calls = stubApi(base)
        const game = useGameStore()
        await Promise.all([game.start(), game.start()]) // double click
        expect(calls).toEqual(['POST /game/start', 'GET /g1/shop', 'GET /g1/messages'])
        expect(game.status).toBe('playing')
        expect(game.gameId).toBe('g1')
        expect(game.stats).toEqual({ lives: 3, gold: 0, level: 0, score: 0, turn: 0 })
        expect(game.shop).toHaveLength(2)
        expect(game.pending).toBe(false)
    })

    it('keeps an unlisted-encryption ad but refuses to solve it', async () => {
        const calls = stubApi(base)
        const game = useGameStore()
        await game.start()
        expect(game.board[1]?.solvable).toBe(false)
        await game.solve('a2')
        expect(calls.some((c) => c.includes('/solve/'))).toBe(false)
    })

    it('solve success merges stats, appends to the log, refetches the board', async () => {
        const calls = stubApi({
            ...base,
            'POST /g1/solve/a1': () =>
                json({
                    success: true,
                    lives: 3,
                    gold: 251,
                    score: 30,
                    highScore: 0,
                    turn: 1,
                    message: 'Done!',
                }),
        })
        const game = useGameStore()
        await game.start()
        await game.solve('a1')
        expect(game.stats).toMatchObject({ gold: 251, score: 30, turn: 1, level: 0 })
        expect(game.log).toEqual([
            {
                seq: 1,
                turn: 1,
                kind: 'solve',
                adMessage: 'Job one',
                success: true,
                message: 'Done!',
                deltas: { lives: 0, gold: 251, score: 30, turn: 1 },
            },
        ])
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(2)
        expect(game.pending).toBe(false)
    })

    it('solve decoded adId is sent', async () => {
        const calls = stubApi({
            ...base,
            'GET /g1/messages': () =>
                json([
                    {
                        adId: 'nop',
                        message: 'Fgrny',
                        reward: 1,
                        expiresIn: 1,
                        encrypted: 2,
                        probability: 'Evfxl',
                    },
                ]),
            'POST /g1/solve/abc': () =>
                json({
                    success: true,
                    lives: 3,
                    gold: 1,
                    score: 1,
                    highScore: 0,
                    turn: 1,
                    message: 'ok',
                }),
        })
        const game = useGameStore()
        await game.start()
        await game.solve('abc')
        expect(calls).toContain('POST /g1/solve/abc')
    })

    it('game over: lives 0 sets over and skips the board refetch', async () => {
        const calls = stubApi({
            ...base,
            'POST /g1/solve/a1': () =>
                json({
                    success: false,
                    lives: 0,
                    gold: 0,
                    score: 77,
                    highScore: 0,
                    turn: 9,
                    message: 'Defeated',
                }),
        })
        const game = useGameStore()
        await game.start()
        await game.solve('a1')
        expect(game.status).toBe('over')
        expect(game.stats).toMatchObject({ score: 77, turn: 9 })
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(1)
    })

    it('buy: omitted score stays; doomed buy is blocked with no request', async () => {
        const calls = stubApi({
            ...base,
            'POST /g1/shop/buy/hpot': () =>
                json({ shoppingSuccess: true, gold: 0, lives: 3, level: 0, turn: 1 }),
        })
        const game = useGameStore()
        await game.start()
        game.stats.gold = 10
        await game.buy('hpot')
        expect(calls.some((c) => c.includes('/shop/buy/'))).toBe(false)
        game.stats.gold = 50
        game.stats.score = 12
        await game.buy('hpot')
        expect(game.stats.score).toBe(12)
        expect(game.stats.gold).toBe(0)
        expect(game.log).toHaveLength(1)
        expect(game.log[0]).toMatchObject({
            seq: 1,
            turn: 1,
            kind: 'buy',
            itemName: 'Healing potion',
            success: true,
        })
    })

    it('reputation: shown together with its log entry, before the board refetch', async () => {
        let releaseBoard: (r: Response) => void = () => undefined
        let messageCalls = 0
        stubApi({
            ...base,
            'GET /g1/messages': () =>
                messageCalls++ === 0
                    ? json(ads)
                    : new Promise<Response>((resolve) => (releaseBoard = resolve)),
            'POST /g1/investigate/reputation': () => json({ people: 1, state: 2, underworld: 3 }),
        })
        const game = useGameStore()
        await game.start()
        const turn = game.investigateReputation()
        await vi.waitFor(() => expect(messageCalls).toBe(2))
        expect(game.log).toHaveLength(1)
        expect(game.reputation).toEqual({ people: 1, state: 2, underworld: 3 })
        releaseBoard(json(ads))
        await turn
    })

    it('reputation: stores values and increments turn locally', async () => {
        stubApi({
            ...base,
            'POST /g1/investigate/reputation': () =>
                json({ people: 4.9, state: -4, underworld: 0 }),
        })
        const game = useGameStore()
        await game.start()
        await game.investigateReputation()
        expect(game.reputation).toEqual({ people: 4.9, state: -4, underworld: 0 })
        expect(game.stats.turn).toBe(1)
        expect(game.log).toEqual([
            {
                seq: 1,
                turn: 1,
                kind: 'reputation',
                reputation: { people: 4.9, state: -4, underworld: 0 },
                deltas: { turn: 1 },
            },
        ])
    })

    it('solve 404 is not expiry; the refetch decides', async () => {
        stubApi({ ...base, 'POST /g1/solve/a1': () => html404() })
        const game = useGameStore()
        await game.start()
        await game.solve('a1')
        expect(game.status).toBe('playing')
        expect(game.error).toEqual({ kind: 'not-found', status: 404 })
        expect(game.log).toEqual([])
    })

    it('messages 404 after a turn means expired', async () => {
        let messageCalls = 0
        stubApi({
            ...base,
            'GET /g1/messages': () => (messageCalls++ === 0 ? json(ads) : html404()),
            'POST /g1/solve/a1': () =>
                json({
                    success: true,
                    lives: 3,
                    gold: 1,
                    score: 1,
                    highScore: 0,
                    turn: 1,
                    message: 'ok',
                }),
        })
        const game = useGameStore()
        await game.start()
        await game.solve('a1')
        expect(game.status).toBe('expired')
        expect(game.expiredNotice).toBe(true)
    })

    it('board refetch failure: retries at 2 s and 5 s, then stays stale until retry works', async () => {
        vi.useFakeTimers()
        let fail = false
        const calls = stubApi({
            ...base,
            'GET /g1/messages': () => (fail ? new Response('x', { status: 503 }) : json(ads)),
            'POST /g1/solve/a1': () =>
                json({
                    success: true,
                    lives: 3,
                    gold: 1,
                    score: 1,
                    highScore: 0,
                    turn: 1,
                    message: 'ok',
                }),
        })
        const game = useGameStore()
        await game.start()
        fail = true
        const turn = game.solve('a1')
        await vi.advanceTimersByTimeAsync(BOARD_RETRY_DELAYS_MS[0] ?? 0)
        expect(game.boardStale).toBe(true)
        expect(game.pending).toBe(true)
        await vi.advanceTimersByTimeAsync(BOARD_RETRY_DELAYS_MS[1] ?? 0)
        await turn
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(4) // 1 + original + 2 retries
        expect(game.boardStale).toBe(true)
        expect(game.pending).toBe(false)

        const before = calls.length
        await game.solve('a1') // blocked while stale
        expect(calls).toHaveLength(before)

        fail = false
        await game.refreshMessages()
        expect(game.boardStale).toBe(false)
    })

    it('load of a fresh game URL fetches shop and board, stats unknown', async () => {
        const calls = stubApi(base)
        const game = useGameStore()
        await game.load('g1')
        expect(calls).toEqual(['GET /g1/shop', 'GET /g1/messages'])
        expect(game.status).toBe('playing')
        expect(game.stats).toEqual({
            lives: null,
            gold: null,
            level: null,
            score: null,
            turn: null,
        })
        await game.load('g1') // no-op
        expect(calls).toHaveLength(2)
    })

    it('load of an expired game sets expired', async () => {
        stubApi({ ...base, 'GET /g1/messages': () => html404() })
        const game = useGameStore()
        await game.load('g1')
        expect(game.status).toBe('expired')
        expect(game.expiredNotice).toBe(true)
    })

    it('start failure returns to idle with an error and a retryable start', async () => {
        stubApi({ 'POST /game/start': () => new Response('x', { status: 500 }) })
        const game = useGameStore()
        await game.start()
        expect(game.status).toBe('idle')
        expect(game.error).toEqual({ kind: 'http', status: 500 })
        expect(game.pending).toBe(false)
    })

    it('ignores a response for a game that was replaced', async () => {
        let release: (r: Response) => void = () => undefined
        stubApi({
            ...base,
            'GET /g1/messages': () => json(ads),
            'POST /g1/solve/a1': () => new Promise<Response>((resolve) => (release = resolve)),
            'GET /g2/shop': () => json([]),
            'GET /g2/messages': () => json([]),
        })
        const game = useGameStore()
        await game.start()
        const solving = game.solve('a1')
        const loading = game.load('g2')
        release(
            json({
                success: true,
                lives: 1,
                gold: 999,
                score: 999,
                highScore: 0,
                turn: 9,
                message: 'late',
            }),
        )
        await Promise.all([solving, loading])
        expect(game.gameId).toBe('g2')
        expect(game.stats.gold).toBeNull()
        expect(game.log).toEqual([])
    })

    it('shop failure sets shopFailed; refreshShop retries and clears it', async () => {
        let fail = true
        const calls = stubApi({
            ...base,
            'GET /g1/shop': () => (fail ? new Response('x', { status: 500 }) : json(items)),
        })
        const game = useGameStore()
        await game.start()
        expect(game.shopFailed).toBe(true)
        expect(game.shop).toHaveLength(0)
        fail = false
        await game.refreshShop()
        expect(game.shopFailed).toBe(false)
        expect(game.shop).toHaveLength(2)
        expect(game.pending).toBe(false)
        expect(calls.filter((c) => c === 'GET /g1/shop')).toHaveLength(2)
    })

    it('refreshShop is a no-op while pending and a 404 is an error, not expiry (AD-5)', async () => {
        let fail = true
        const calls = stubApi({
            ...base,
            'GET /g1/shop': () => (fail ? new Response('x', { status: 500 }) : html404()),
        })
        const game = useGameStore()
        await game.start()
        game.pending = true
        await game.refreshShop()
        expect(calls.filter((c) => c === 'GET /g1/shop')).toHaveLength(1)
        game.pending = false
        fail = false
        await game.refreshShop()
        expect(game.status).toBe('playing')
        expect(game.error).toEqual({ kind: 'not-found', status: 404 })
        expect(game.pending).toBe(false)
    })

    describe('activity log (AD-7)', () => {
        const solveOk = (turn: number, message: string) => () =>
            json({
                success: true,
                lives: 3,
                gold: turn * 10,
                score: turn,
                highScore: 0,
                turn,
                message,
            })

        it('appends one entry per turn with seq and the turn from the response', async () => {
            let turn = 8
            stubApi({ ...base, 'POST /g1/solve/a1': () => solveOk(++turn, `msg ${turn}`)() })
            const game = useGameStore()
            await game.start()
            await game.solve('a1')
            await game.solve('a1')
            expect(game.log.map((e) => [e.seq, e.turn, e.kind])).toEqual([
                [1, 9, 'solve'],
                [2, 10, 'solve'],
            ])
            expect(game.log[1]).toMatchObject({ message: 'msg 10', adMessage: 'Job one' })
        })

        it('keeps turn null when the turn is unknown', async () => {
            stubApi({
                ...base,
                'POST /g1/investigate/reputation': () =>
                    json({ people: 1, state: 2, underworld: 3 }),
            })
            const game = useGameStore()
            await game.load('g1') // no save: stats unknown
            await game.investigateReputation()
            expect(game.log).toHaveLength(1)
            expect(game.log[0]).toMatchObject({ seq: 1, turn: null, kind: 'reputation' })
        })

        it('a failed turn appends nothing and sets the error', async () => {
            stubApi({ ...base, 'POST /g1/solve/a1': () => new Response('x', { status: 500 }) })
            const game = useGameStore()
            await game.start()
            await game.solve('a1')
            expect(game.log).toEqual([])
            expect(game.error).toEqual({ kind: 'http', status: 500 })
        })

        it('start() and load() of another id clear the log and restart seq', async () => {
            let starts = 0
            stubApi({
                ...base,
                'POST /game/start': () =>
                    json({ ...startBody, gameId: starts++ === 0 ? 'g1' : 'g2' }),
                'GET /g2/shop': () => json(items),
                'GET /g2/messages': () => json(ads),
                'GET /g3/shop': () => json(items),
                'GET /g3/messages': () => json(ads),
                'POST /g1/solve/a1': solveOk(1, 'one'),
                'POST /g2/solve/a1': solveOk(1, 'two'),
                'POST /g3/solve/a1': solveOk(1, 'three'),
            })
            const game = useGameStore()
            await game.start()
            await game.solve('a1')
            expect(game.log).toHaveLength(1)

            await game.start()
            expect(game.gameId).toBe('g2')
            expect(game.log).toEqual([])
            await game.solve('a1')
            expect(game.log.map((e) => e.seq)).toEqual([1])

            await game.load('g3')
            expect(game.log).toEqual([])
            await game.solve('a1')
            expect(game.log.map((e) => e.seq)).toEqual([1])
        })
    })

    describe('state estimate and ranked jobs (AD-6, AD-7, CAP-16)', () => {
        const kindAds = [
            {
                adId: 'inf',
                message: 'Infiltrate the guild',
                reward: 10,
                expiresIn: 2,
                encrypted: null,
                probability: 'Sure thing',
            },
            {
                adId: 'st',
                message: 'Steal a goat from Ann',
                reward: 90,
                expiresIn: 2,
                encrypted: null,
                probability: 'Sure thing',
            },
            {
                adId: 'job',
                message: 'Help the baker',
                reward: 5,
                expiresIn: 2,
                encrypted: null,
                probability: 'Gamble',
            },
        ]
        const solveResult = (success: boolean) =>
            json({
                success,
                lives: 3,
                gold: 100,
                score: 1,
                highScore: 0,
                turn: 1,
                message: success ? 'Done' : 'Failed',
            })
        const solveWon = () => solveResult(true)
        const solveLost = () => solveResult(false)

        it('a successful infiltrate +2, a failed steal unchanged, a reading replaces it', async () => {
            let messageCalls = 0
            let release: () => void = () => undefined
            stubApi({
                ...base,
                // The first refetch after the infiltrate is held, to see the estimate change
                // in the same step as the log entry, before the refetch returns.
                'GET /g1/messages': () =>
                    messageCalls++ === 1
                        ? new Promise<Response>(
                              (resolve) => (release = () => resolve(json(kindAds))),
                          )
                        : json(kindAds),
                'POST /g1/solve/inf': solveWon,
                'POST /g1/solve/st': solveLost,
                'POST /g1/investigate/reputation': () =>
                    json({ people: 1, state: -3, underworld: 0 }),
            })
            const game = useGameStore()
            await game.start()
            expect(game.stateEstimate).toBe(0)

            const turn = game.solve('inf')
            await vi.waitFor(() => expect(game.log).toHaveLength(1))
            expect(game.pending).toBe(true)
            expect(game.stateEstimate).toBe(2)
            release()
            await turn

            await game.solve('st')
            expect(game.log).toHaveLength(2)
            expect(game.stateEstimate).toBe(2)

            await game.investigateReputation()
            expect(game.stateEstimate).toBe(-3)
        })

        it('a successful steal −2; a failed API call changes nothing', async () => {
            let attempts = 0
            stubApi({
                ...base,
                'GET /g1/messages': () => json(kindAds),
                'POST /g1/solve/st': () =>
                    attempts++ === 0 ? new Response('x', { status: 500 }) : solveWon(),
            })
            const game = useGameStore()
            await game.start()
            await game.solve('st')
            expect(game.stateEstimate).toBe(0)
            await game.solve('st')
            expect(game.stateEstimate).toBe(-2)
        })

        it('start() and load() of another id reset the estimate to 0', async () => {
            let starts = 0
            const withKinds = (id: string) => ({
                [`GET /${id}/shop`]: () => json(items),
                [`GET /${id}/messages`]: () => json(kindAds),
                [`POST /${id}/solve/inf`]: solveWon,
            })
            stubApi({
                ...base,
                ...withKinds('g1'),
                ...withKinds('g2'),
                ...withKinds('g3'),
                'POST /game/start': () =>
                    json({ ...startBody, gameId: starts++ === 0 ? 'g1' : 'g2' }),
            })
            const game = useGameStore()
            await game.start()
            await game.solve('inf')
            expect(game.stateEstimate).toBe(2)

            await game.start()
            expect(game.stateEstimate).toBe(0)
            await game.solve('inf')
            expect(game.stateEstimate).toBe(2)

            await game.load('g3')
            expect(game.stateEstimate).toBe(0)
        })

        it('rankedJobs follows the board and a reputation reading', async () => {
            stubApi({
                ...base,
                'GET /g1/messages': () => json(kindAds),
                'POST /g1/investigate/reputation': () =>
                    json({ people: 0, state: -7, underworld: 0 }),
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 500 // above the potion, so no broke exception
            const order = () => game.rankedJobs.map((j) => j.ad.adId)
            expect(order()).toEqual(['st', 'inf', 'job'])
            expect(game.rankedJobs.find((j) => j.best)?.ad.adId).toBe('st')

            await game.investigateReputation()
            expect(game.stateEstimate).toBe(-7)
            expect(order()).toEqual(['inf', 'job', 'st'])
            expect(game.rankedJobs.find((j) => j.ad.adId === 'st')?.flag).toBe('state-risk')
            expect(game.rankedJobs.find((j) => j.best)?.ad.adId).toBe('inf')
        })

        it('rankedJobs uses the gold and the shop: broke picks the safest ad', async () => {
            const board = [
                { ...kindAds[2], adId: 'top', reward: 900, probability: 'Walk in the park' },
                { ...kindAds[2], adId: 'safe', reward: 5, probability: 'Piece of cake' },
            ]
            stubApi({ ...base, 'GET /g1/messages': () => json(board) })
            const game = useGameStore()
            await game.start() // gold 0, potion 50
            expect(game.rankedJobs.find((j) => j.best)?.ad.adId).toBe('safe')
            game.stats.gold = 50
            expect(game.rankedJobs.find((j) => j.best)?.ad.adId).toBe('top')
        })

        it('rankedJobs with unknown gold has no broke exception', async () => {
            const board = [
                { ...kindAds[2], adId: 'top', reward: 900, probability: 'Walk in the park' },
                { ...kindAds[2], adId: 'safe', reward: 5, probability: 'Piece of cake' },
            ]
            stubApi({ ...base, 'GET /g1/messages': () => json(board) })
            const game = useGameStore()
            await game.load('g1') // no save: stats unknown
            expect(game.stats.gold).toBeNull()
            expect(game.rankedJobs.find((j) => j.best)?.ad.adId).toBe('top')
        })
    })

    describe('purchases, recommendedItem and the buy result (AD-6, AD-7, CAP-4, CAP-17)', () => {
        const shopItems = ['hpot', 'cs', 'ch', 'rf'].map(liveItem)
        const deadlyAds = [{ ...ads[0], adId: 'd1', probability: 'Playing with fire' }]
        // From the start's 3 lives and level 0 with 900 gold: a buy changes gold and level only.
        const bought = () => json({ shoppingSuccess: true, gold: 600, lives: 3, level: 2, turn: 1 })
        // A failed buy keeps gold, lives and level; it still costs a turn [V].
        const failedBuy = () =>
            json({ shoppingSuccess: false, gold: 900, lives: 3, level: 0, turn: 1 })
        const shopBase = {
            ...base,
            'GET /g1/shop': () => json(shopItems),
            'GET /g1/messages': () => json(deadlyAds),
        }

        it('a successful buy counts the item with its log entry, before the board refetch', async () => {
            let release: () => void = () => undefined
            let messageCalls = 0
            stubApi({
                ...shopBase,
                'GET /g1/messages': () =>
                    messageCalls++ === 1
                        ? new Promise<Response>(
                              (resolve) => (release = () => resolve(json(deadlyAds))),
                          )
                        : json(deadlyAds),
                'POST /g1/shop/buy/ch': () => bought(),
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 900
            expect(game.purchases).toEqual({})

            const turn = game.buy('ch')
            await vi.waitFor(() => expect(game.log).toHaveLength(1))
            expect(game.pending).toBe(true)
            expect(game.purchases).toEqual({ ch: 1 })
            release()
            await turn
            await game.buy('ch')
            expect(game.purchases).toEqual({ ch: 2 })
        })

        it('a failed buy or a failed API call counts nothing', async () => {
            let attempts = 0
            stubApi({
                ...shopBase,
                'POST /g1/shop/buy/ch': () =>
                    attempts++ === 0 ? new Response('x', { status: 500 }) : failedBuy(),
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 900
            await game.buy('ch')
            await game.buy('ch')
            expect(game.log).toHaveLength(1)
            expect(game.purchases).toEqual({})
        })

        it('recommendedItem rotates the +2 items by purchases and follows lives and gold', async () => {
            stubApi({
                ...shopBase,
                'POST /g1/shop/buy/ch': () => bought(),
            })
            const game = useGameStore()
            await game.start()
            expect(game.recommendedItem).toBeNull() // 3 lives, 0 gold
            game.stats.gold = 900
            expect(game.recommendedItem).toEqual({ itemId: 'ch', reason: 'level-up' })
            await game.buy('ch') // gold 600
            expect(game.recommendedItem).toEqual({ itemId: 'rf', reason: 'level-up' })
            game.stats.lives = 1
            expect(game.recommendedItem).toEqual({ itemId: 'hpot', reason: 'low-lives' })
            game.stats.gold = null
            expect(game.recommendedItem).toBeNull()
        })

        it('purchases is read-only outside the store', async () => {
            stubApi(shopBase)
            const game = useGameStore()
            await game.start()
            // Vue's read-only warning goes to the console.warn spy set up in beforeEach.
            ;(game.purchases as Record<string, number>).ch = 5
            expect(game.purchases).toEqual({})
        })

        it('start() and load() of another id empty purchases', async () => {
            let starts = 0
            const forGame = (id: string) => ({
                [`GET /${id}/shop`]: () => json(shopItems),
                [`GET /${id}/messages`]: () => json(deadlyAds),
                [`POST /${id}/shop/buy/ch`]: () => bought(),
            })
            stubApi({
                ...forGame('g1'),
                ...forGame('g2'),
                ...forGame('g3'),
                'POST /game/start': () =>
                    json({ ...startBody, gameId: starts++ === 0 ? 'g1' : 'g2' }),
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 900
            await game.buy('ch')
            expect(game.purchases).toEqual({ ch: 1 })

            await game.start()
            expect(game.purchases).toEqual({})
            game.stats.gold = 900
            await game.buy('ch')
            expect(game.purchases).toEqual({ ch: 1 })

            await game.load('g3')
            expect(game.purchases).toEqual({})
        })

        it('lastBuy holds the buy until the next action starts, even if that one fails', async () => {
            let releaseSolve: (r: Response) => void = () => undefined
            let solves = 0
            stubApi({
                ...shopBase,
                'POST /g1/shop/buy/ch': () => bought(),
                'POST /g1/solve/d1': () =>
                    solves++ === 0
                        ? new Promise<Response>((resolve) => (releaseSolve = resolve))
                        : json({
                              success: true,
                              lives: 2,
                              gold: 650,
                              score: 5,
                              turn: 3,
                              message: 'ok',
                          }),
            })
            const game = useGameStore()
            await game.start()
            expect(game.lastBuy).toBeNull()
            game.stats.gold = 900
            await game.buy('ch')
            expect(game.lastBuy).toMatchObject({
                kind: 'buy',
                itemId: 'ch',
                itemName: 'Claw Honing',
                success: true,
                deltas: { level: 2, gold: -300 },
            })

            const turn = game.solve('d1')
            expect(game.lastBuy).toBeNull() // the next action has started
            releaseSolve(new Response('x', { status: 500 }))
            await turn
            expect(game.error).not.toBeNull()
            expect(game.lastBuy).toBeNull()

            await game.solve('d1')
            expect(game.lastBuy).toBeNull()
        })

        it('lastBuy holds a failed buy too', async () => {
            stubApi({
                ...shopBase,
                'POST /g1/shop/buy/ch': failedBuy,
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 900
            await game.buy('ch')
            expect(game.lastBuy).toMatchObject({ kind: 'buy', itemId: 'ch', success: false })
            expect(game.stats).toMatchObject({ gold: 900, lives: 3, level: 0 })
        })

        it('lastBuy is cleared by the shop and board retries, which start an action too', async () => {
            stubApi({
                ...shopBase,
                'POST /g1/shop/buy/ch': () => bought(),
            })
            const game = useGameStore()
            await game.start()
            game.stats.gold = 900
            await game.buy('ch')
            expect(game.lastBuy).not.toBeNull()
            await game.refreshShop()
            expect(game.lastBuy).toBeNull()

            await game.buy('ch')
            expect(game.lastBuy).not.toBeNull()
            await game.refreshMessages()
            expect(game.lastBuy).toBeNull()
        })

        it('shopHint: Low on lives at 1 life even when broke, else the recommendation', async () => {
            stubApi(shopBase)
            const game = useGameStore()
            await game.start()
            expect(game.shopHint).toBeNull() // 3 lives, 0 gold
            game.stats.gold = 900
            expect(game.shopHint).toBe('level-up')
            Object.assign(game.stats, { lives: 1, gold: 10 })
            expect(game.shopHint).toBe('low-lives')
            game.stats.lives = null
            expect(game.shopHint).toBeNull()
        })

        it('recommendedItem feeds the state estimate to the guard: a safe steal at −7 is left out', async () => {
            const board = [
                { ...ads[0], adId: 's1', message: 'Steal a goat', probability: 'Sure thing' },
                { ...ads[0], adId: 'm1', probability: 'Walk in the park' },
            ]
            stubApi({
                ...shopBase,
                'GET /g1/shop': () => json([...LIVE_SHOP]),
                'GET /g1/messages': () => json(board),
                'POST /g1/investigate/reputation': () =>
                    json({ people: 0, state: -7, underworld: 0 }),
            })
            const game = useGameStore()
            await game.start()
            Object.assign(game.stats, { lives: 2, gold: 350 })
            expect(game.recommendedItem).toBeNull() // the steal is playable and safe
            await game.investigateReputation()
            expect(game.stateEstimate).toBe(-7)
            expect(game.recommendedItem).toEqual({ itemId: 'ch', reason: 'level-up' })
        })
    })
})
