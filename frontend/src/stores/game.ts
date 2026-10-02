import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/client'
import { ApiError } from '@/api/client'
import { applyTurn } from '@/game/apply-turn'
import { decodeAd } from '@/game/decode'
import { affordability } from '@/game/shop'
import type {
    Ad,
    GameError,
    GameStatus,
    LastTurn,
    LastTurnInfo,
    Reputation,
    ShopItem,
    Stats,
    TurnResponse,
} from '@/game/types'

// AD-18: automatic board-refetch retries, after 2 s and then 5 s.
export const BOARD_RETRY_DELAYS_MS = [2000, 5000]

const emptyStats = (): Stats => ({ lives: null, gold: null, level: null, score: null, turn: null })

function toError(e: unknown): GameError {
    if (e instanceof ApiError) return { kind: e.kind, status: e.status }
    return { kind: 'network', status: null }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const useGameStore = defineStore('game', () => {
    const gameId = ref<string | null>(null)
    const status = ref<GameStatus>('idle')
    const stats = ref<Stats>(emptyStats())
    const board = ref<Ad[]>([])
    const boardStale = ref(false)
    const shop = ref<ShopItem[]>([])
    const shopFailed = ref(false)
    const reputation = ref<Reputation | null>(null)
    const lastTurn = ref<LastTurn | null>(null)
    const pending = ref(false)
    const error = ref<GameError | null>(null)
    const expiredNotice = ref(false)

    // Guards start/load, which have no gameId to compare before their first response.
    let epoch = 0

    function reset(): void {
        epoch += 1
        gameId.value = null
        status.value = 'idle'
        stats.value = emptyStats()
        board.value = []
        boardStale.value = false
        shop.value = []
        shopFailed.value = false
        reputation.value = null
        lastTurn.value = null
        pending.value = false
        error.value = null
    }

    function markExpired(): void {
        status.value = 'expired'
        expiredNotice.value = true
    }

    /** AD-18. Returns early without touching state if the game changed under it. */
    async function refreshBoard(id: string): Promise<void> {
        for (let attempt = 0; ; attempt += 1) {
            try {
                const ads = await api.getMessages(id)
                if (gameId.value !== id) return
                board.value = ads.map(decodeAd)
                boardStale.value = false
                return
            } catch (e) {
                if (gameId.value !== id) return
                const err = toError(e)
                if (err.kind === 'not-found') {
                    markExpired()
                    return
                }
                boardStale.value = true
                const delay = BOARD_RETRY_DELAYS_MS[attempt]
                if (delay === undefined) return
                await sleep(delay)
                if (gameId.value !== id) return
            }
        }
    }

    /** Fetches the shop, then the board, one request at a time (AD-13). */
    async function loadShopAndBoard(id: string, token: number): Promise<void> {
        try {
            const items = await api.getShop(id)
            if (epoch !== token) return
            shop.value = items
            shopFailed.value = false
        } catch (e) {
            if (epoch !== token) return
            error.value = toError(e)
            shopFailed.value = true
        }
        await refreshBoard(id)
        if (epoch !== token) return
        if (status.value === 'loading') status.value = 'playing'
        pending.value = false
    }

    async function start(): Promise<void> {
        if (pending.value) return
        reset()
        expiredNotice.value = false
        const token = epoch
        pending.value = true
        status.value = 'loading'
        let id: string
        try {
            const game = await api.startGame()
            if (epoch !== token) return
            id = game.gameId
            gameId.value = id
            stats.value = {
                lives: game.lives,
                gold: game.gold,
                level: game.level,
                score: game.score,
                turn: game.turn,
            }
        } catch (e) {
            if (epoch !== token) return
            error.value = toError(e)
            status.value = 'idle'
            pending.value = false
            return
        }
        await loadShopAndBoard(id, token)
    }

    async function load(id: string): Promise<void> {
        if (gameId.value === id && ['playing', 'over', 'loading'].includes(status.value)) return
        reset()
        const token = epoch
        gameId.value = id
        status.value = 'loading'
        pending.value = true
        await loadShopAndBoard(id, token)
    }

    /** AD-7: the one pipeline behind solve, buy, and reputation. */
    async function runTurn<R extends object>(
        call: () => Promise<R>,
        describe: (response: R) => LastTurnInfo,
        incrementTurn = false,
    ): Promise<R | null> {
        if (pending.value || gameId.value === null) return null
        const id = gameId.value
        pending.value = true
        error.value = null
        const prev = { ...stats.value }
        let result: R | null = null
        try {
            const response = await call()
            if (gameId.value !== id) return null
            const { stats: next, deltas } = applyTurn(prev, response as TurnResponse, incrementTurn)
            stats.value = next
            lastTurn.value = { ...describe(response), deltas } as LastTurn
            if (next.lives === 0) status.value = 'over'
            result = response
        } catch (e) {
            if (gameId.value === id) error.value = toError(e)
        } finally {
            if (gameId.value === id && status.value === 'playing') await refreshBoard(id)
            if (gameId.value === id) pending.value = false
        }
        return result
    }

    async function solve(adId: string): Promise<void> {
        const id = gameId.value
        const ad = board.value.find((a) => a.adId === adId)
        if (id === null || !ad?.solvable || boardStale.value || status.value !== 'playing') return
        await runTurn(
            () => api.solveAd(id, ad.adId),
            (r) => ({
                kind: 'solve',
                adMessage: ad.message,
                success: r.success,
                message: r.message,
            }),
        )
    }

    async function buy(itemId: string): Promise<void> {
        const id = gameId.value
        const item = shop.value.find((i) => i.id === itemId)
        if (id === null || !item || status.value !== 'playing') return
        if (affordability(stats.value.gold, item.cost).state === 'no') return
        await runTurn(
            () => api.buyItem(id, item.id),
            (r) => ({ kind: 'buy', itemName: item.name, success: r.shoppingSuccess }),
        )
    }

    async function investigateReputation(): Promise<void> {
        const id = gameId.value
        if (id === null || status.value !== 'playing') return
        const result = await runTurn(
            () => api.investigateReputation(id),
            (r) => ({ kind: 'reputation', reputation: r }),
            true,
        )
        if (result !== null && gameId.value === id) reputation.value = result
    }

    /** Player-triggered retry of a failed shop fetch; never automatic (AD-13). */
    async function refreshShop(): Promise<void> {
        const id = gameId.value
        if (pending.value || id === null || status.value !== 'playing') return
        pending.value = true
        error.value = null
        try {
            const items = await api.getShop(id)
            if (gameId.value !== id) return
            shop.value = items
            shopFailed.value = false
        } catch (e) {
            if (gameId.value !== id) return
            const err = toError(e)
            if (err.kind === 'not-found') markExpired()
            else error.value = err
        } finally {
            if (gameId.value === id) pending.value = false
        }
    }

    /** Player-triggered retry of the board fetch (AD-18). */
    async function refreshMessages(): Promise<void> {
        const id = gameId.value
        if (pending.value || id === null || status.value !== 'playing') return
        pending.value = true
        error.value = null
        try {
            await refreshBoard(id)
        } finally {
            if (gameId.value === id) pending.value = false
        }
    }

    return {
        gameId,
        status,
        stats,
        board,
        boardStale,
        shop,
        shopFailed,
        reputation,
        lastTurn,
        pending,
        error,
        expiredNotice,
        start,
        load,
        solve,
        buy,
        investigateReputation,
        refreshMessages,
        refreshShop,
    }
})
