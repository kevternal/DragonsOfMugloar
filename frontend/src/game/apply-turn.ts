import type { Deltas, StatKey, Stats, TurnResponse } from './types'

const KEYS: StatKey[] = ['lives', 'gold', 'level', 'score', 'turn']

/**
 * AD-7 step 4. Only fields present in the response change. Reputation returns no turn,
 * so `incrementTurn` adds +1 locally when the turn is known. A delta exists only where
 * both sides are numbers.
 */
export function applyTurn(
    prev: Stats,
    response: TurnResponse,
    incrementTurn = false,
): { stats: Stats; deltas: Deltas } {
    const stats: Stats = { ...prev }
    const deltas: Deltas = {}
    for (const key of KEYS) {
        let value = response[key]
        if (value === undefined && key === 'turn' && incrementTurn && prev.turn !== null) {
            value = prev.turn + 1
        }
        if (value === undefined) continue
        stats[key] = value
        const before = prev[key]
        if (before !== null) deltas[key] = value - before
    }
    return { stats, deltas }
}
