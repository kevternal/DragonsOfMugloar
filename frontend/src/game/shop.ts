import type { Deltas } from './types'
import { warnUnlisted } from './warn'

export interface ItemEffect {
    level?: number
    lives?: number
}

// Copied from observed-values.md, "Shop items" [V 2026-10-01].
const EFFECTS: Record<string, ItemEffect> = {
    hpot: { lives: 1 },
    cs: { level: 1 },
    gas: { level: 1 },
    wax: { level: 1 },
    tricks: { level: 1 },
    wingpot: { level: 1 },
    ch: { level: 2 },
    rf: { level: 2 },
    iron: { level: 2 },
    mtrix: { level: 2 },
    wingpotmax: { level: 2 },
}

export function itemEffect(itemId: string): ItemEffect | null {
    const effect = EFFECTS[itemId]
    if (!effect) {
        warnUnlisted('shop item id', itemId)
        return null
    }
    return effect
}

export function affordability(
    gold: number | null,
    cost: number,
): { state: 'yes' | 'no' | 'unknown'; shortfall: number | null } {
    if (gold === null) {
        return { state: 'unknown', shortfall: null }
    }
    return gold >= cost
        ? { state: 'yes', shortfall: null }
        : { state: 'no', shortfall: cost - gold }
}

/**
 * AD-4: which stat a buy raised, from its deltas: level, else lives; `null` when neither rose
 * (a delta of 0, or unknown stats). Shared by the bought row and the stat emphasis (CAP-4).
 */
export function raisedStat(deltas: Deltas): 'level' | 'lives' | null {
    if ((deltas.level ?? 0) > 0) {
        return 'level'
    }
    if ((deltas.lives ?? 0) > 0) {
        return 'lives'
    }
    return null
}
