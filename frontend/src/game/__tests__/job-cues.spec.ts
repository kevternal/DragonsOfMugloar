import { describe, expect, it } from 'vitest'
import { rewardTier, urgency } from '../job-cues'

describe('rewardTier', () => {
    it.each([
        { reward: 0, tier: 'small' },
        { reward: 99, tier: 'small' },
        { reward: 100, tier: 'medium' },
        { reward: 999, tier: 'medium' },
        { reward: 1000, tier: 'large' },
        { reward: 25000, tier: 'large' },
    ] as const)('a reward of $reward is $tier', ({ reward, tier }) => {
        expect(rewardTier(reward)).toBe(tier)
    })
})

describe('urgency', () => {
    it.each([
        { expiresIn: 0, level: 'critical' },
        { expiresIn: 1, level: 'critical' },
        { expiresIn: 2, level: 'soon' },
        { expiresIn: 3, level: 'soon' },
        { expiresIn: 4, level: 'normal' },
        { expiresIn: 10, level: 'normal' },
    ] as const)('$expiresIn turns left is $level', ({ expiresIn, level }) => {
        expect(urgency(expiresIn)).toBe(level)
    })
})
