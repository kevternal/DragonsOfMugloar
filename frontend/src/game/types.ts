// Domain types (AD-6, AD-7, AD-11). Names follow the API's camelCase.

export interface Ad {
    adId: string
    message: string
    reward: number
    expiresIn: number
    probability: string
    /** False when `encrypted` held a value outside the registry (AD-3). */
    solvable: boolean
}

export interface ShopItem {
    id: string
    name: string
    cost: number
}

export type StatKey = 'lives' | 'gold' | 'level' | 'score' | 'turn'

/** `null` means unknown until a response carries the field (AD-11). */
export type Stats = Record<StatKey, number | null>

export interface Reputation {
    people: number
    state: number
    underworld: number
}

export type Deltas = Partial<Record<StatKey, number>>

/** `Omit` applied to each member of a union, so the members stay distinct. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** What happened on one turn, without the log bookkeeping (AD-7). */
type TurnOutcome =
    | { kind: 'solve'; adMessage: string; success: boolean; message: string; deltas: Deltas }
    | { kind: 'buy'; itemId: string; itemName: string; success: boolean; deltas: Deltas }
    | { kind: 'reputation'; reputation: Reputation; deltas: Deltas }

/**
 * One activity-log entry (AD-7). `seq` is a per-game counter used as the list key;
 * `turn` is the turn after the action, `null` when unknown (AD-11).
 */
export type TurnRecord = { seq: number; turn: number | null } & TurnOutcome

/** A buy's log entry: the buy feedback reads it (CAP-4). */
export type BuyRecord = Extract<TurnRecord, { kind: 'buy' }>

/** The display part of a turn that an action describes; the store adds deltas and bookkeeping. */
export type TurnInfo = DistributiveOmit<TurnOutcome, 'deltas'>

export type GameStatus = 'idle' | 'loading' | 'playing' | 'over' | 'expired'

export interface GameError {
    kind: 'not-found' | 'network' | 'http'
    status: number | null
}

/** The fields of a turn response that may carry stats; absent fields stay unchanged. */
export type TurnResponse = Partial<Record<StatKey, number>>

/** Risk tier from the `probability` label (risk-cues.md). */
export type RiskTier = 'safe' | 'moderate' | 'risky' | 'deadly' | 'unknown'

/** How big a job's reward looks (`rewardTier`). */
export type RewardTier = 'small' | 'medium' | 'large'

/** How close an ad is to expiring (`urgency`). */
export type Urgency = 'critical' | 'soon' | 'normal'

/** A row flag (CAP-16): bait, or a steal left out by the state guard. */
export type JobFlag = 'trap' | 'state-risk'

/**
 * One jobs-board row in display order (AD-4, `rankJobs`). `value` is `null` when the win
 * rate is unknown; `tier` and `winPct` are carried so the row never re-derives them.
 */
export interface RankedJob {
    ad: Ad
    tier: RiskTier
    winPct: number | null
    value: number | null
    flag: JobFlag | null
    best: boolean
}

/**
 * The recommended shop item (AD-4, `recommendItem`): the healing potion at 1 life, or the
 * least-bought +2 item under steps 2–4 (recommendations.md, "Shop (CAP-17)").
 */
export interface ItemRecommendation {
    itemId: string
    reason: 'low-lives' | 'level-up'
}

/** What the shop says about an item regardless of the board (CAP-17): +1 items are not worth it. */
export type ItemAdvice = 'plus2' | 'plus1-not-worth' | 'potion'

/** The one hint the Shop tab shows (CAP-17); `null` for none. */
export type ShopHint = ItemRecommendation['reason'] | null
