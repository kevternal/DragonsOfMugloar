import { computed, readonly, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/client'
import { ApiError } from '@/api/client'
import type { AdDto, ItemDto, StartDto } from '@/api/types'
import { applyTurn } from '@/game/apply-turn'
import { decodeAd } from '@/game/decode'
import { rankJobs, recommendItem, shopHint as hintFor, stateDelta } from '@/game/recommendations'
import { affordability } from '@/game/shop'
import type {
    Ad,
    BuyRecord,
    GameError,
    GameStatus,
    Reputation,
    ShopItem,
    Stats,
    TurnInfo,
    TurnRecord,
    TurnResponse,
} from '@/game/types'

// AD-18: automatic board-refetch retries, after 2 s and then 5 s.
export const BOARD_RETRY_DELAYS_MS = [2000, 5000]

/** Outcome of one board fetch: `failed` means the board is stale and worth another try. */
type BoardFetch = 'settled' | 'failed'

const emptyStats = (): Stats => ({ lives: null, gold: null, level: null, score: null, turn: null })

const statsFromStart = (started: StartDto): Stats => ({
    lives: started.lives,
    gold: started.gold,
    level: started.level,
    score: started.score,
    turn: started.turn,
})

function toError(e: unknown): GameError {
    if (e instanceof ApiError) {
        return { kind: e.kind, status: e.status }
    }

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
    const log = ref<TurnRecord[]>([])
    const pending = ref(false)
    const error = ref<GameError | null>(null)
    const expiredNotice = ref(false)
    // AD-6: sum of stateDelta over this game's successful solves, replaced by each reputation
    // reading. Never persisted; 0 while unknown, as the tree treats it.
    const stateEstimate = ref(0)
    // AD-6: successful buys per item id this game, for the +2 rotation. Never persisted.
    const purchases = ref<Record<string, number>>({})
    // AD-6: the latest buy's log entry, for the buy feedback (CAP-4). Set with the entry,
    // cleared when the next action starts or the game resets.
    const lastBuy = ref<BuyRecord | null>(null)

    // AD-6, AD-4: the jobs board in display order, with flags and the best pick.
    const rankedJobs = computed(() =>
        rankJobs({
            gold: stats.value.gold,
            board: board.value,
            shop: shop.value,
            stateEstimate: stateEstimate.value,
        }),
    )

    // AD-6, AD-4: the shop's recommended item, if any.
    const recommendedItem = computed(() =>
        recommendItem({
            lives: stats.value.lives,
            gold: stats.value.gold,
            board: board.value,
            shop: shop.value,
            purchases: purchases.value,
            stateEstimate: stateEstimate.value,
        }),
    )

    // AD-6, AD-4: the Shop tab's one hint.
    // CAP-17 matrix "Unknown stats": no tab hint while lives or gold is unknown.
    const shopHint = computed(() => {
        if (stats.value.gold === null) {
            return null
        }

        return hintFor(stats.value.lives, recommendedItem.value)
    })

    // Guards start/load, which have no gameId to compare before their first response.
    let epoch = 0
    // AD-7: per-game counter for log entries, used as the list key. Reset with the game.
    let seq = 0

    // ---- Guards -------------------------------------------------------------

    /** False once the player has moved on to another game; its late responses are dropped. */
    function isCurrent(id: string): boolean {
        return gameId.value === id
    }

    /** Same as `isCurrent`, for start/load, which begin before a gameId is known. */
    function isCurrentEpoch(token: number): boolean {
        return epoch === token
    }

    /** The open game's id when the player may act now: playing, nothing in flight. */
    function idleGameId(): string | null {
        if (pending.value || status.value !== 'playing') {
            return null
        }

        return gameId.value
    }

    /** True when this game is already on screen, so loading it again would waste requests. */
    function holdsGame(id: string): boolean {
        return isCurrent(id) && ['playing', 'over', 'loading'].includes(status.value)
    }

    // ---- State changes ------------------------------------------------------

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
        log.value = []
        seq = 0
        stateEstimate.value = 0
        purchases.value = {}
        lastBuy.value = null
        pending.value = false
        error.value = null
    }

    /** An action starts: one at a time, and the previous result and error are cleared. */
    function beginAction(): void {
        pending.value = true
        error.value = null
        lastBuy.value = null
    }

    function beginLoading(): void {
        status.value = 'loading'
        pending.value = true
    }

    function markExpired(): void {
        status.value = 'expired'
        expiredNotice.value = true
    }

    function showBoard(ads: AdDto[]): void {
        board.value = ads.map(decodeAd)
        boardStale.value = false
    }

    function showShop(items: ItemDto[]): void {
        shop.value = items
        shopFailed.value = false
    }

    /** Applies a turn response to the stats and appends it to the activity log (AD-7). */
    function recordTurn(
        before: Stats,
        response: object,
        info: TurnInfo,
        { incrementTurn = false, stateChange = 0 }: TurnEffects,
    ): void {
        const { stats: next, deltas } = applyTurn(before, response as TurnResponse, incrementTurn)
        seq += 1
        const record: TurnRecord = { seq, turn: next.turn, ...info, deltas }

        stats.value = next
        log.value.push(record)

        // The top bar shows the new values together with the log entry, not after the refetch.
        // A reading replaces the state estimate; any other turn adds its change.
        if (info.kind === 'reputation') {
            reputation.value = info.reputation
            stateEstimate.value = info.reputation.state
        } else {
            stateEstimate.value += stateChange
        }

        if (record.kind === 'buy') {
            lastBuy.value = record
            if (record.success) {
                purchases.value[record.itemId] = (purchases.value[record.itemId] ?? 0) + 1
            }
        }

        if (next.lives === 0) {
            status.value = 'over'
        }
    }

    /** What a turn changes besides its log entry (AD-7 step 5). */
    interface TurnEffects {
        /** Reputation returns no turn, so it adds +1 locally when the turn is known. */
        incrementTurn?: boolean
        /** The state estimate change of this response; applied with the log entry. */
        stateChange?: number
    }

    // ---- Board (AD-18) ------------------------------------------------------

    /** One board fetch. A 404 means the game is gone; any other failure leaves the board stale. */
    async function fetchBoard(id: string): Promise<BoardFetch> {
        try {
            const ads = await api.getMessages(id)

            if (isCurrent(id)) {
                showBoard(ads)
            }

            return 'settled'
        } catch (e) {
            if (!isCurrent(id)) {
                return 'settled'
            }

            if (toError(e).kind === 'not-found') {
                markExpired()
                return 'settled'
            }

            boardStale.value = true
            return 'failed'
        }
    }

    /** AD-18. Tries once, then once more after each retry delay while the board stays stale. */
    async function refreshBoard(id: string): Promise<void> {
        let outcome = await fetchBoard(id)

        for (const delay of BOARD_RETRY_DELAYS_MS) {
            if (outcome !== 'failed') {
                return
            }

            await sleep(delay)

            if (!isCurrent(id)) {
                return
            }

            outcome = await fetchBoard(id)
        }
    }

    // ---- Start and load -----------------------------------------------------

    async function loadShop(id: string, token: number): Promise<void> {
        try {
            const items = await api.getShop(id)

            if (isCurrentEpoch(token)) {
                showShop(items)
            }
        } catch (e) {
            if (isCurrentEpoch(token)) {
                error.value = toError(e)
                shopFailed.value = true
            }
        }
    }

    /** Fetches the shop, then the board, one request at a time (AD-13). */
    async function loadShopAndBoard(id: string, token: number): Promise<void> {
        await loadShop(id, token)
        await refreshBoard(id)

        if (!isCurrentEpoch(token)) {
            return
        }

        if (status.value === 'loading') {
            status.value = 'playing'
        }

        pending.value = false
    }

    /** Returns the new game's id, or null when the start failed or was superseded. */
    async function createGame(token: number): Promise<string | null> {
        try {
            const started = await api.startGame()

            if (!isCurrentEpoch(token)) {
                return null
            }

            gameId.value = started.gameId
            stats.value = statsFromStart(started)
            return started.gameId
        } catch (e) {
            if (isCurrentEpoch(token)) {
                error.value = toError(e)
                status.value = 'idle'
                pending.value = false
            }

            return null
        }
    }

    async function start(): Promise<void> {
        if (pending.value) {
            return
        }

        reset()
        expiredNotice.value = false
        const token = epoch
        beginLoading()

        const id = await createGame(token)

        if (id !== null) {
            await loadShopAndBoard(id, token)
        }
    }

    async function load(id: string): Promise<void> {
        if (holdsGame(id)) {
            return
        }

        reset()
        const token = epoch
        gameId.value = id
        beginLoading()

        await loadShopAndBoard(id, token)
    }

    // ---- Turns (AD-7) -------------------------------------------------------

    /** After every turn: refetch the board while the game goes on, then release the guard. */
    async function finishTurn(id: string): Promise<void> {
        if (isCurrent(id) && status.value === 'playing') {
            await refreshBoard(id)
        }

        if (isCurrent(id)) {
            pending.value = false
        }
    }

    /** AD-7: the one pipeline behind solve, buy, and reputation. */
    async function runTurn<R extends object>(
        call: () => Promise<R>,
        describe: (response: R) => TurnInfo,
        effects: (response: R) => TurnEffects = () => ({}),
    ): Promise<R | null> {
        if (pending.value || gameId.value === null) {
            return null
        }

        const id = gameId.value
        beginAction()
        const before = { ...stats.value }

        try {
            const response = await call()

            if (!isCurrent(id)) {
                return null
            }

            recordTurn(before, response, describe(response), effects(response))
            return response
        } catch (e) {
            if (isCurrent(id)) {
                error.value = toError(e)
            }

            return null
        } finally {
            await finishTurn(id)
        }
    }

    async function solve(adId: string): Promise<void> {
        const id = idleGameId()
        const ad = board.value.find((a) => a.adId === adId)

        if (id === null || !ad?.solvable || boardStale.value) {
            return
        }

        // Captured before the await, like the display text (AD-7).
        const delta = stateDelta(ad.message)

        await runTurn(
            () => api.solveAd(id, ad.adId),
            (r) => ({
                kind: 'solve',
                adMessage: ad.message,
                success: r.success,
                message: r.message,
            }),
            (r) => ({ stateChange: r.success ? delta : 0 }),
        )
    }

    async function buy(itemId: string): Promise<void> {
        const id = idleGameId()
        const item = shop.value.find((i) => i.id === itemId)

        if (id === null || !item) {
            return
        }

        if (affordability(stats.value.gold, item.cost).state === 'no') {
            return
        }

        await runTurn(
            () => api.buyItem(id, item.id),
            (r) => ({
                kind: 'buy',
                itemId: item.id,
                itemName: item.name,
                success: r.shoppingSuccess,
            }),
        )
    }

    async function investigateReputation(): Promise<void> {
        const id = idleGameId()

        if (id === null) {
            return
        }

        await runTurn(
            () => api.investigateReputation(id),
            (r) => ({ kind: 'reputation', reputation: r }),
            () => ({ incrementTurn: true }),
        )
    }

    // ---- Player-triggered retries -------------------------------------------

    /** Player-triggered retry of a failed shop fetch; never automatic (AD-13). */
    async function refreshShop(): Promise<void> {
        const id = idleGameId()

        if (id === null) {
            return
        }

        beginAction()

        try {
            const items = await api.getShop(id)

            if (isCurrent(id)) {
                showShop(items)
            }
        } catch (e) {
            if (!isCurrent(id)) {
                return
            }

            // AD-5: only a board 404 means the game is gone; the next board read decides.
            error.value = toError(e)
        } finally {
            if (isCurrent(id)) {
                pending.value = false
            }
        }
    }

    /** Player-triggered retry of the board fetch (AD-18). */
    async function refreshMessages(): Promise<void> {
        const id = idleGameId()

        if (id === null) {
            return
        }

        beginAction()

        try {
            await refreshBoard(id)
        } finally {
            if (isCurrent(id)) {
                pending.value = false
            }
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
        log,
        pending,
        error,
        expiredNotice,
        // Read-only outside the store: only turns change it (AD-7).
        stateEstimate: readonly(stateEstimate),
        purchases: readonly(purchases),
        lastBuy: readonly(lastBuy),
        rankedJobs,
        recommendedItem,
        shopHint,
        start,
        load,
        solve,
        buy,
        investigateReputation,
        refreshMessages,
        refreshShop,
    }
})
