// CAP-16: the job half of decision tree v3.4, ported from backend `npc/game/Strategy.java` and
// `AdKind.java` as pure functions (AD-4). Rules and evidence: recommendations.md, "Ad kinds" and
// "Jobs"; findings in shared-mugloar-game/strategy-findings.md.
import { labelOdds } from './risk'
import { itemEffect } from './shop'
import type { Ad, JobFlag, RankedJob, RiskTier, ShopItem } from './types'

export type AdKind = 'bait' | 'steal' | 'infiltrate' | 'investigate' | 'other'

/**
 * Bait is worded "Steal super awesome diamond <thing> from <person>"; all 21 attempts failed and
 * cost a life [V] (strategy-findings.md, "Bait ads"). Matched in any case.
 */
const BAIT_MARKER = 'super awesome diamond'

/**
 * How one successful solve moves the state reputation, by message prefix. Exact over 183
 * reading intervals; failed solves change nothing [V] (strategy-findings.md, "Why the tree
 * looks like this").
 */
const STATE_DELTA = { Steal: -2, Infiltrate: 2, Investigate: 1 } as const

/**
 * Bait has only been seen at state −10; the guard keeps the estimate at −8 or higher [V]
 * (strategy-findings.md, "Bait ads").
 */
const STATE_FLOOR = -8

/**
 * The base cost of a lost life (a potion and more), plus the turn, valued at the best safe
 * reward. 75 had the best results in a few live probe games; the ranking between bases is [U]
 * (strategy-findings.md, "Loss penalty and +1 items").
 */
const LOSS_BASE = 75

/** Safest first, unknown last (the backend's `Risk.Tier` order). */
const TIER_ORDER: readonly RiskTier[] = ['safe', 'moderate', 'risky', 'deadly', 'unknown']

/** Display groups, in order. */
const GROUP = { playable: 0, leftOutSteal: 1, unknownOdds: 2, trap: 3 } as const
type Group = (typeof GROUP)[keyof typeof GROUP]

/** What an ad's message says about it (recommendations.md, "Ad kinds"). */
export function adKind(ad: Pick<Ad, 'message'>): AdKind {
    const { message } = ad
    if (message.toLowerCase().includes(BAIT_MARKER)) {
        return 'bait'
    }
    if (message.startsWith('Steal')) {
        return 'steal'
    }
    if (message.startsWith('Infiltrate')) {
        return 'infiltrate'
    }
    if (message.startsWith('Investigate')) {
        return 'investigate'
    }
    return 'other'
}

/**
 * The state change of one successful solve, by message prefix, as `AdKind.stateDelta(message)`:
 * steal −2 (bait worded "Steal …" too), infiltrate +2, investigate +1, anything else 0.
 */
export function stateDelta(message: string): -2 | 2 | 1 | 0 {
    const prefixes = Object.keys(STATE_DELTA) as (keyof typeof STATE_DELTA)[]
    const prefix = prefixes.find((p) => message.startsWith(p))
    return prefix === undefined ? 0 : STATE_DELTA[prefix]
}

/** `winPct × reward − (100 − winPct) × lossCost`, integer maths. */
function jobValue(pct: number, reward: number, lossCost: number): number {
    return pct * reward - (100 - pct) * lossCost
}

/** The cheapest item that grants a life; ties keep shop (API) order. */
function cheapestPotion(shop: ShopItem[]): ShopItem | null {
    let potion: ShopItem | null = null
    for (const item of shop) {
        const grantsLife = (itemEffect(item.id)?.lives ?? 0) > 0
        if (grantsLife && (potion === null || item.cost < potion.cost)) {
            potion = item
        }
    }
    return potion
}

export interface JobsInput {
    /** `null` while unknown: then there is no broke exception (AD-4). */
    gold: number | null
    board: Ad[]
    shop: ShopItem[]
    /** The state reputation estimate; treated as 0 while unknown, as the tree does. */
    stateEstimate: number
}

/** An ad with what its message and label say about it. */
interface Job {
    ad: Ad
    kind: AdKind
    tier: RiskTier
    winPct: number | null
}

interface Row extends Omit<RankedJob, 'best'> {
    group: Group
}

/** A row in a valued group: its win rate and value are known. */
interface ValuedRow extends Row {
    winPct: number
    value: number
}

/** Plain code-unit order, like Java's `String.compareTo`. */
function compareId(a: string, b: string): number {
    if (a < b) {
        return -1
    }
    return a > b ? 1 : 0
}

/** Value (highest first), then win % (highest first), then soonest expiry, then adId. */
function byValue(a: ValuedRow, b: ValuedRow): number {
    return (
        b.value - a.value ||
        b.winPct - a.winPct ||
        a.ad.expiresIn - b.ad.expiresIn ||
        compareId(a.ad.adId, b.ad.adId)
    )
}

/**
 * Unknown odds and traps have no value to sort by. Soonest expiry, then adId: the tie-break the
 * backend reaches when every value is equal.
 */
function byExpiry(a: Row, b: Row): number {
    return a.ad.expiresIn - b.ad.expiresIn || compareId(a.ad.adId, b.ad.adId)
}

/** Broke exception (`SAFEST`): lowest tier (unknown last), then highest reward, expiry, adId. */
function bySafety(a: Job, b: Job): number {
    return (
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
        b.ad.reward - a.ad.reward ||
        a.ad.expiresIn - b.ad.expiresIn ||
        compareId(a.ad.adId, b.ad.adId)
    )
}

function isValued(row: Row): row is ValuedRow {
    return row.winPct !== null && row.value !== null
}

/**
 * `Strategy.playable`: solvable ads that aren't bait. Steals are left out when bait is on the
 * board, or when one more would take the estimate below the floor, unless only steals are left.
 */
function playableJobs(jobs: Job[], stateEstimate: number): Job[] {
    const baitOnBoard = jobs.some((j) => j.kind === 'bait')
    const candidates = jobs.filter((j) => j.ad.solvable && j.kind !== 'bait')
    const guard = baitOnBoard || stateEstimate + STATE_DELTA.Steal < STATE_FLOOR
    if (!guard) {
        return candidates
    }
    const noSteals = candidates.filter((j) => j.kind !== 'steal')
    return noSteals.length > 0 ? noSteals : candidates
}

/** The highest reward among safe playable ads, 0 if none. */
function bestSafeReward(playable: Job[]): number {
    return Math.max(0, ...playable.filter((j) => j.tier === 'safe').map((j) => j.ad.reward))
}

function flagOf(job: Job, playable: Set<Ad>): JobFlag | null {
    if (job.kind === 'bait') {
        return 'trap'
    }
    if (job.ad.solvable && !playable.has(job.ad)) {
        return 'state-risk'
    }
    return null
}

function groupOf(job: Job, flag: JobFlag | null): Group {
    if (flag === 'trap') {
        return GROUP.trap
    }
    if (job.winPct === null) {
        return GROUP.unknownOdds
    }
    if (flag === 'state-risk') {
        return GROUP.leftOutSteal
    }
    return GROUP.playable
}

function sortGroup(rows: Row[], group: Group): Row[] {
    const members = rows.filter((r) => r.group === group)
    if (group === GROUP.playable || group === GROUP.leftOutSteal) {
        return members.filter(isValued).sort(byValue)
    }
    return members.sort(byExpiry)
}

/**
 * CAP-16: every ad on the board, in display order, with its flag and the best pick. Never filters.
 *
 * Mirrors `Strategy.playable`, `bestValue`, `SAFEST` and `value`. The deliberate difference:
 * ads with unknown odds sort in their own group, after the left-out steals, instead of scoring
 * a win rate of 0. The best pick is the first playable ad in that order.
 */
export function rankJobs({ gold, board, shop, stateEstimate }: JobsInput): RankedJob[] {
    const jobs: Job[] = board.map((ad) => ({ ad, kind: adKind(ad), ...labelOdds(ad) }))
    const playable = playableJobs(jobs, stateEstimate)
    const playableAds = new Set(playable.map((j) => j.ad))
    // A loss costs the base plus a turn, valued at the best safe playable reward.
    const lossCost = LOSS_BASE + bestSafeReward(playable)

    const rows: Row[] = jobs.map((job) => {
        const flag = flagOf(job, playableAds)
        const group = groupOf(job, flag)
        // Value is defined for playable ads and left-out steals (whose odds are known by
        // `groupOf`); never for traps or unknown odds.
        const valued = group === GROUP.playable || group === GROUP.leftOutSteal
        const value =
            valued && job.winPct !== null ? jobValue(job.winPct, job.ad.reward, lossCost) : null
        return { ad: job.ad, tier: job.tier, winPct: job.winPct, value, flag, group }
    })

    const ordered = Object.values(GROUP).flatMap((group) => sortGroup(rows, group))

    // Best pick: the first playable ad, or the safest one while gold is below the potion's cost.
    const potion = cheapestPotion(shop)
    const broke = gold !== null && potion !== null && gold < potion.cost
    const bestAd = broke
        ? [...playable].sort(bySafety)[0]?.ad
        : ordered.find((row) => playableAds.has(row.ad))?.ad

    return ordered.map(({ ad, tier, winPct, value, flag }) => ({
        ad,
        tier,
        winPct,
        value,
        flag,
        best: ad === bestAd,
    }))
}
