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

export type LastTurn =
    | { kind: 'solve'; adMessage: string; success: boolean; message: string; deltas: Deltas }
    | { kind: 'buy'; itemName: string; success: boolean; deltas: Deltas }
    | { kind: 'reputation'; reputation: Reputation; deltas: Deltas }

export type LastTurnInfo = LastTurn extends infer T
    ? T extends LastTurn
        ? Omit<T, 'deltas'>
        : never
    : never

export type GameStatus = 'idle' | 'loading' | 'playing' | 'over' | 'expired'

export interface GameError {
    kind: 'not-found' | 'network' | 'http'
    status: number | null
}

/** The fields of a turn response that may carry stats; absent fields stay unchanged. */
export type TurnResponse = Partial<Record<StatKey, number>>
