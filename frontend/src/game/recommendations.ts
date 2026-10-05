// CAP-16 and CAP-17: decision tree v3.4, ported from backend `npc/game/Strategy.java` and
// `AdKind.java` as pure functions (AD-4). Rules and evidence: recommendations.md, "Ad kinds",
// "Jobs" and "Shop"; findings in shared-mugloar-game/strategy-findings.md.
import { labelOdds } from './risk'
import { itemEffect } from './shop'
import type {
    Ad,
    ItemAdvice,
    ItemRecommendation,
    JobFlag,
    RankedJob,
    RiskTier,
    ShopHint,
    ShopItem,
} from './types'

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

/*
 * Shop step numbers are the spec's (recommendations.md, "Shop (CAP-17)"): steps 1–4 there are
 * `Strategy.decide` steps 3–6 in the backend.
 */

/** Step 1: heal only at 1 life (strategy-findings.md, "The decision tree"). */
const LOW_LIVES = 1

/** Step 2 applies at exactly this many lives. */
const TWO_LIVES = 2

/** Steps 3 and 4 apply from this many lives: a +2 item only with a life to spare. */
const MIN_LIVES_LEVEL_UP = 2

/** Step 2: at 2 lives with no safe ad, a +2 item from this much gold (never a +1). */
const GOLD_TWO_LIVES_PLUS2 = 350

/** Step 3: a +2 item from this much gold while some playable ad is not safe. */
const GOLD_PROACTIVE_PLUS2 = 400

/**
 * Step 4: on an all-deadly board, a +2 item from 350 gold keeps 50 for a potion [V, n=1]
 * (strategy-findings.md, "Tree v3.1: best run").
 */
const GOLD_DEADLY_PLUS2 = 350

/**
 * Only +2 items are worth buying: +1 items ease about 3% of ads against about 25% for +2, and
 * every losing probe game bought 7–22 of them [V, 11 games] (strategy-findings.md, "Loss
 * penalty and +1 items").
 */
const LEVELS_WORTH_BUYING = 2

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

/** What its message and label say about each ad on the board. */
function toJobs(board: Ad[]): Job[] {
    return board.map((ad) => ({ ad, kind: adKind(ad), ...labelOdds(ad) }))
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
    const jobs = toJobs(board)
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

// ---- Shop (CAP-17) ----------------------------------------------------------

/** AD-4: the shelves, cheapest first; equal costs keep the API order (the sort is stable). */
export function shelfOrder(items: readonly ShopItem[]): ShopItem[] {
    return [...items].sort((a, b) => a.cost - b.cost)
}

/** AD-4: potion, +2 item or +1 item (not worth buying), from the item's effect; `null` if unlisted. */
export function itemAdvice(itemId: string): ItemAdvice | null {
    const effect = itemEffect(itemId)
    if ((effect?.lives ?? 0) > 0) {
        return 'potion'
    }
    if (effect?.level === LEVELS_WORTH_BUYING) {
        return 'plus2'
    }
    if (effect?.level === 1) {
        return 'plus1-not-worth'
    }
    return null
}

export interface ShopInput {
    /** `null` while unknown: then nothing is recommended (AD-4). */
    lives: number | null
    gold: number | null
    board: Ad[]
    shop: ShopItem[]
    /** Successful buys per item id this game. */
    purchases: Readonly<Record<string, number>>
    /** The state reputation estimate; treated as 0 while unknown, as the tree does. */
    stateEstimate: number
}

/**
 * `Strategy.levelItem`: among the affordable +2 items, the one bought least this game. Ties go
 * to the first in shelf order, as the spec says; the backend uses API order. The two are the
 * same in the live shop, where every +2 item costs 300 [V] (observed-values.md, "Shop items").
 */
function leastBoughtPlus2(
    shop: ShopItem[],
    purchases: Readonly<Record<string, number>>,
    gold: number,
): ShopItem | null {
    const bought = (item: ShopItem) => purchases[item.id] ?? 0
    let pick: ShopItem | null = null
    for (const item of shelfOrder(shop)) {
        const worthIt = itemAdvice(item.id) === 'plus2' && item.cost <= gold
        if (worthIt && (pick === null || bought(item) < bought(pick))) {
            pick = item
        }
    }
    return pick
}

/**
 * CAP-17: the recommended item, by the spec's steps 1–4 (`Strategy.decide` steps 3–6); the
 * first match wins.
 *
 * 1. At 1 life with the potion affordable: the potion.
 * 2. At 2 lives with no safe playable ad and 350+ gold: the least-bought +2 item.
 * 3. At 2+ lives with some playable ad not safe and 400+ gold: the same.
 * 4. At 2+ lives on an all-deadly board with 350+ gold: the same.
 *
 * Steps 2–4 need at least one playable ad: a purchase can't help an empty board.
 */
export function recommendItem({
    lives,
    gold,
    board,
    shop,
    purchases,
    stateEstimate,
}: ShopInput): ItemRecommendation | null {
    if (lives === null || gold === null) {
        return null
    }

    // Step 1, before the playable-ad check: the potion helps even on an empty board.
    const potion = cheapestPotion(shop)
    if (lives === LOW_LIVES && potion !== null && potion.cost <= gold) {
        return { itemId: potion.id, reason: 'low-lives' }
    }

    const playable = playableJobs(toJobs(board), stateEstimate)
    if (playable.length === 0) {
        return null
    }

    const isSafe = (job: Job) => job.tier === 'safe'
    const isDeadly = (job: Job) => job.tier === 'deadly'
    const anySafe = playable.some(isSafe)
    // Unknown odds count as not safe, as in the backend.
    const anyNotSafe = !playable.every(isSafe)
    const allDeadly = playable.every(isDeadly)
    const spareLife = lives >= MIN_LIVES_LEVEL_UP
    const levelUpSteps = [
        { applies: lives === TWO_LIVES && !anySafe, minGold: GOLD_TWO_LIVES_PLUS2 },
        { applies: spareLife && anyNotSafe, minGold: GOLD_PROACTIVE_PLUS2 },
        { applies: spareLife && allDeadly, minGold: GOLD_DEADLY_PLUS2 },
    ]
    if (!levelUpSteps.some((step) => step.applies && gold >= step.minGold)) {
        return null
    }

    const item = leastBoughtPlus2(shop, purchases, gold)
    return item === null ? null : { itemId: item.id, reason: 'level-up' }
}

/**
 * CAP-17: the Shop tab's one hint. "Low on lives" at 1 life, even when the potion is
 * unaffordable; otherwise the recommendation's reason (none while gold is unknown). Unknown
 * lives mean no hint.
 */
export function shopHint(
    lives: number | null,
    recommendation: ItemRecommendation | null,
): ShopHint {
    if (lives === null) {
        return null
    }
    if (lives === LOW_LIVES) {
        return 'low-lives'
    }
    return recommendation?.reason ?? null
}
