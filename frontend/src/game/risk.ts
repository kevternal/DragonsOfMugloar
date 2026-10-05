import type { Ad, RiskTier } from './types'
import { warnUnlisted } from './warn'

/** A label's tier and measured win rate; `winPct` is `null` when the odds are unknown. */
export interface LabelOdds {
    tier: RiskTier
    /** Integer percent, so comparisons have no float ties. */
    winPct: number | null
}

const UNKNOWN: LabelOdds = { tier: 'unknown', winPct: null }

// recommendations.md, "Win rate per label": 5,257 non-bait live solves [V, 2026-10-04].
// Tiers from risk-cues.md: membership is measured [V], the boundaries are design choices.
const LABELS = new Map<string, LabelOdds>([
    ['Sure thing', { tier: 'safe', winPct: 100 }],
    ['Piece of cake', { tier: 'safe', winPct: 95 }],
    ['Walk in the park', { tier: 'moderate', winPct: 87 }],
    ['Quite likely', { tier: 'moderate', winPct: 72 }],
    ['Hmmm....', { tier: 'moderate', winPct: 63 }],
    ['Gamble', { tier: 'risky', winPct: 55 }],
    ['Risky', { tier: 'risky', winPct: 41 }],
    ['Rather detrimental', { tier: 'risky', winPct: 37 }],
    ['Playing with fire', { tier: 'deadly', winPct: 31 }],
    ['Suicide mission', { tier: 'deadly', winPct: 6 }],
    ['Impossible', { tier: 'deadly', winPct: 0 }],
])

/** The registry lookup; an unlisted label is unknown and warns (CAP-9). */
function oddsOf(probability: string): LabelOdds {
    const odds = LABELS.get(probability)
    if (!odds) {
        warnUnlisted('Ad.probability', probability)
        return UNKNOWN
    }
    return odds
}

/**
 * AD-4: an ad's tier and win rate in one lookup. An unsolvable ad's label is still encoded,
 * so its odds are unknown (AD-3); decoding already warned, so this doesn't.
 */
export function labelOdds(ad: Ad): LabelOdds {
    return ad.solvable ? oddsOf(ad.probability) : UNKNOWN
}

/** AD-4: the tier for a `probability` label. */
export function riskTier(probability: string): RiskTier {
    return oddsOf(probability).tier
}

/** AD-4: an ad's tier; `unknown` for an unlisted label or an unsolvable ad. */
export function adRiskTier(ad: Ad): RiskTier {
    return labelOdds(ad).tier
}

/** AD-4: the measured win rate in integer percent; `null` for an unknown label or an unsolvable ad. */
export function winPct(ad: Ad): number | null {
    return labelOdds(ad).winPct
}
