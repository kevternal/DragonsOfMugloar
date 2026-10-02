import { describe, expect, it } from 'vitest'
import { affordability } from '../shop'

describe('affordability', () => {
    it('reports yes, no with shortfall, and unknown', () => {
        expect(affordability(100, 100)).toEqual({ state: 'yes', shortfall: null })
        expect(affordability(40, 100)).toEqual({ state: 'no', shortfall: 60 })
        expect(affordability(null, 100)).toEqual({ state: 'unknown', shortfall: null })
    })
})
