// Display cues for a job row (AD-4). The thresholds are design choices, approved by the user
// from a preview [V 2026-10-05].
import type { RewardTier, Urgency } from './types'

/** The smallest reward shown as a pile of coins. */
const MEDIUM_REWARD = 100
/** The smallest reward shown as a treasure chest. */
const LARGE_REWARD = 1000

/** The last turns an ad is "soon" to expire; at 1 turn left it is critical. */
const SOON_TURNS = 3
const CRITICAL_TURNS = 1

/** AD-4: how big a reward looks: under 100 small, 100 to 999 medium, 1000 and up large. */
export function rewardTier(reward: number): RewardTier {
    if (reward >= LARGE_REWARD) {
        return 'large'
    }
    if (reward >= MEDIUM_REWARD) {
        return 'medium'
    }
    return 'small'
}

/** AD-4: how close an ad is to expiring: 1 turn or less critical, 2 to 3 soon, else normal. */
export function urgency(expiresIn: number): Urgency {
    if (expiresIn <= CRITICAL_TURNS) {
        return 'critical'
    }
    if (expiresIn <= SOON_TURNS) {
        return 'soon'
    }
    return 'normal'
}
