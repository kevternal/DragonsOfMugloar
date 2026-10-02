import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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
        if (!handler) throw new Error(`No stub for ${key}`)
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
        const store = useGameStore()
        await Promise.all([store.start(), store.start()]) // double click
        expect(calls).toEqual(['POST /game/start', 'GET /g1/shop', 'GET /g1/messages'])
        expect(store.status).toBe('playing')
        expect(store.gameId).toBe('g1')
        expect(store.stats).toEqual({ lives: 3, gold: 0, level: 0, score: 0, turn: 0 })
        expect(store.shop).toHaveLength(2)
        expect(store.pending).toBe(false)
    })

    it('keeps an unlisted-encryption ad but refuses to solve it', async () => {
        const calls = stubApi(base)
        const store = useGameStore()
        await store.start()
        expect(store.board[1]?.solvable).toBe(false)
        await store.solve('a2')
        expect(calls.some((c) => c.includes('/solve/'))).toBe(false)
    })

    it('solve success merges stats, sets lastTurn, refetches the board', async () => {
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
        const store = useGameStore()
        await store.start()
        await store.solve('a1')
        expect(store.stats).toMatchObject({ gold: 251, score: 30, turn: 1, level: 0 })
        expect(store.lastTurn).toEqual({
            kind: 'solve',
            adMessage: 'Job one',
            success: true,
            message: 'Done!',
            deltas: { lives: 0, gold: 251, score: 30, turn: 1 },
        })
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(2)
        expect(store.pending).toBe(false)
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
        const store = useGameStore()
        await store.start()
        await store.solve('abc')
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
        const store = useGameStore()
        await store.start()
        await store.solve('a1')
        expect(store.status).toBe('over')
        expect(store.stats).toMatchObject({ score: 77, turn: 9 })
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(1)
    })

    it('buy: omitted score stays; doomed buy is blocked with no request', async () => {
        const calls = stubApi({
            ...base,
            'POST /g1/shop/buy/hpot': () =>
                json({ shoppingSuccess: true, gold: 0, lives: 3, level: 0, turn: 1 }),
        })
        const store = useGameStore()
        await store.start()
        store.stats.gold = 10
        await store.buy('hpot')
        expect(calls.some((c) => c.includes('/shop/buy/'))).toBe(false)
        store.stats.gold = 50
        store.stats.score = 12
        await store.buy('hpot')
        expect(store.stats.score).toBe(12)
        expect(store.stats.gold).toBe(0)
        expect(store.lastTurn).toMatchObject({
            kind: 'buy',
            itemName: 'Healing potion',
            success: true,
        })
    })

    it('reputation: stores values and increments turn locally', async () => {
        stubApi({
            ...base,
            'POST /g1/investigate/reputation': () =>
                json({ people: 4.9, state: -4, underworld: 0 }),
        })
        const store = useGameStore()
        await store.start()
        await store.investigateReputation()
        expect(store.reputation).toEqual({ people: 4.9, state: -4, underworld: 0 })
        expect(store.stats.turn).toBe(1)
        expect(store.lastTurn).toMatchObject({ kind: 'reputation', deltas: { turn: 1 } })
    })

    it('solve 404 is not expiry; the refetch decides', async () => {
        stubApi({ ...base, 'POST /g1/solve/a1': () => html404() })
        const store = useGameStore()
        await store.start()
        await store.solve('a1')
        expect(store.status).toBe('playing')
        expect(store.error).toEqual({ kind: 'not-found', status: 404 })
        expect(store.lastTurn).toBeNull()
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
        const store = useGameStore()
        await store.start()
        await store.solve('a1')
        expect(store.status).toBe('expired')
        expect(store.expiredNotice).toBe(true)
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
        const store = useGameStore()
        await store.start()
        fail = true
        const turn = store.solve('a1')
        await vi.advanceTimersByTimeAsync(BOARD_RETRY_DELAYS_MS[0] ?? 0)
        expect(store.boardStale).toBe(true)
        expect(store.pending).toBe(true)
        await vi.advanceTimersByTimeAsync(BOARD_RETRY_DELAYS_MS[1] ?? 0)
        await turn
        expect(calls.filter((c) => c === 'GET /g1/messages')).toHaveLength(4) // 1 + original + 2 retries
        expect(store.boardStale).toBe(true)
        expect(store.pending).toBe(false)

        const before = calls.length
        await store.solve('a1') // blocked while stale
        expect(calls).toHaveLength(before)

        fail = false
        await store.refreshMessages()
        expect(store.boardStale).toBe(false)
    })

    it('load of a fresh game URL fetches shop and board, stats unknown', async () => {
        const calls = stubApi(base)
        const store = useGameStore()
        await store.load('g1')
        expect(calls).toEqual(['GET /g1/shop', 'GET /g1/messages'])
        expect(store.status).toBe('playing')
        expect(store.stats).toEqual({
            lives: null,
            gold: null,
            level: null,
            score: null,
            turn: null,
        })
        await store.load('g1') // no-op
        expect(calls).toHaveLength(2)
    })

    it('load of an expired game sets expired', async () => {
        stubApi({ ...base, 'GET /g1/messages': () => html404() })
        const store = useGameStore()
        await store.load('g1')
        expect(store.status).toBe('expired')
        expect(store.expiredNotice).toBe(true)
    })

    it('start failure returns to idle with an error and a retryable start', async () => {
        stubApi({ 'POST /game/start': () => new Response('x', { status: 500 }) })
        const store = useGameStore()
        await store.start()
        expect(store.status).toBe('idle')
        expect(store.error).toEqual({ kind: 'http', status: 500 })
        expect(store.pending).toBe(false)
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
        const store = useGameStore()
        await store.start()
        const solving = store.solve('a1')
        const loading = store.load('g2')
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
        expect(store.gameId).toBe('g2')
        expect(store.stats.gold).toBeNull()
        expect(store.lastTurn).toBeNull()
    })

    it('shop failure sets shopFailed; refreshShop retries and clears it', async () => {
        let fail = true
        const calls = stubApi({
            ...base,
            'GET /g1/shop': () => (fail ? new Response('x', { status: 500 }) : json(items)),
        })
        const store = useGameStore()
        await store.start()
        expect(store.shopFailed).toBe(true)
        expect(store.shop).toHaveLength(0)
        fail = false
        await store.refreshShop()
        expect(store.shopFailed).toBe(false)
        expect(store.shop).toHaveLength(2)
        expect(store.pending).toBe(false)
        expect(calls.filter((c) => c === 'GET /g1/shop')).toHaveLength(2)
    })

    it('refreshShop is a no-op while pending and 404 means expired', async () => {
        let fail = true
        const calls = stubApi({
            ...base,
            'GET /g1/shop': () => (fail ? new Response('x', { status: 500 }) : html404()),
        })
        const store = useGameStore()
        await store.start()
        store.pending = true
        await store.refreshShop()
        expect(calls.filter((c) => c === 'GET /g1/shop')).toHaveLength(1)
        store.pending = false
        fail = false
        await store.refreshShop()
        expect(store.status).toBe('expired')
        expect(store.pending).toBe(false)
    })
})
