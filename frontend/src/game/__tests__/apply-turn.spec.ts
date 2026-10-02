import { describe, expect, it } from 'vitest'
import { applyTurn } from '../apply-turn'
import type { Stats } from '../types'

const prev: Stats = { lives: 3, gold: 100, level: 0, score: 50, turn: 4 }

describe('applyTurn', () => {
    it('merges present fields and computes deltas', () => {
        const { stats, deltas } = applyTurn(prev, { lives: 2, gold: 351, score: 80, turn: 5 })
        expect(stats).toEqual({ lives: 2, gold: 351, level: 0, score: 80, turn: 5 })
        expect(deltas).toEqual({ lives: -1, gold: 251, score: 30, turn: 1 })
    })

    it('leaves absent fields unchanged, never null (buy has no score)', () => {
        const { stats, deltas } = applyTurn(prev, { gold: 0, lives: 3, level: 1, turn: 5 })
        expect(stats.score).toBe(50)
        expect(deltas.score).toBeUndefined()
        expect(deltas.level).toBe(1)
    })

    it('omits deltas where the previous value is unknown', () => {
        const unknown: Stats = { lives: null, gold: null, level: null, score: null, turn: null }
        const { stats, deltas } = applyTurn(unknown, { lives: 3, gold: 5 })
        expect(stats.lives).toBe(3)
        expect(deltas).toEqual({})
    })

    it('increments turn locally when asked and known', () => {
        expect(applyTurn(prev, {}, true).stats.turn).toBe(5)
        expect(applyTurn(prev, {}, true).deltas).toEqual({ turn: 1 })
        expect(applyTurn({ ...prev, turn: null }, {}, true).stats.turn).toBeNull()
    })
})
