import { afterEach, describe, expect, it, vi } from 'vitest'
import { adRiskTier, labelOdds, riskTier, winPct } from '../risk'
import type { Ad } from '../types'

const ad = (probability: string, solvable = true): Ad => ({
    adId: 'a',
    message: 'Help the baker',
    reward: 10,
    expiresIn: 3,
    probability,
    solvable,
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('riskTier and winPct (recommendations.md, "Win rate per label")', () => {
    const table = [
        { label: 'Sure thing', tier: 'safe', pct: 100 },
        { label: 'Piece of cake', tier: 'safe', pct: 95 },
        { label: 'Walk in the park', tier: 'moderate', pct: 87 },
        { label: 'Quite likely', tier: 'moderate', pct: 72 },
        { label: 'Hmmm....', tier: 'moderate', pct: 63 },
        { label: 'Gamble', tier: 'risky', pct: 55 },
        { label: 'Risky', tier: 'risky', pct: 41 },
        { label: 'Rather detrimental', tier: 'risky', pct: 37 },
        { label: 'Playing with fire', tier: 'deadly', pct: 31 },
        { label: 'Suicide mission', tier: 'deadly', pct: 6 },
        { label: 'Impossible', tier: 'deadly', pct: 0 },
    ]

    it.each(table)('$label is $tier at $pct percent', ({ label, tier, pct }) => {
        expect(riskTier(label)).toBe(tier)
        expect(labelOdds(ad(label))).toEqual({ tier, winPct: pct })
        expect(winPct(ad(label))).toBe(pct)
    })

    it('an unlisted label is unknown, has no win rate, and warns in dev (CAP-9)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        expect(riskTier('Maybe?')).toBe('unknown')
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ad.probability'))
        expect(winPct(ad('Maybe?'))).toBeNull()
    })

    it('warns once per unlisted label, however often it is looked up', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        for (let i = 0; i < 3; i += 1) {
            labelOdds(ad('Once only'))
        }
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('does not match a prototype key or a near miss', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        expect(riskTier('toString')).toBe('unknown')
        expect(riskTier('sure thing')).toBe('unknown')
    })

    it('an unsolvable ad is unknown with no win rate, without a second warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        expect(adRiskTier(ad('Fher guvat', false))).toBe('unknown')
        expect(labelOdds(ad('Fher guvat', false))).toEqual({ tier: 'unknown', winPct: null })
        expect(adRiskTier(ad('Sure thing', false))).toBe('unknown')
        expect(winPct(ad('Sure thing', false))).toBeNull()
        expect(warn).not.toHaveBeenCalled()
    })
})
