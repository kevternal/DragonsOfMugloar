import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adKind, rankJobs, stateDelta, type JobsInput } from '../recommendations'
import type { Ad, ShopItem } from '../types'

let next = 0
function ad(probability: string, reward: number, fields: Partial<Ad> = {}): Ad {
    next += 1
    return {
        adId: `ad${next}`,
        message: 'Help the baker',
        reward,
        expiresIn: 5,
        probability,
        solvable: true,
        ...fields,
    }
}

const BAIT = 'Steal super awesome diamond spoon from Bob'
const potion: ShopItem = { id: 'hpot', name: 'Healing potion', cost: 50 }
const claws: ShopItem = { id: 'cs', name: 'Claw Sharpening', cost: 30 }

function rank(board: Ad[], input: Partial<JobsInput> = {}) {
    return rankJobs({ gold: 500, board, shop: [potion], stateEstimate: 0, ...input })
}
const ids = (jobs: ReturnType<typeof rank>) => jobs.map((j) => j.ad.adId)
const best = (jobs: ReturnType<typeof rank>) => jobs.filter((j) => j.best).map((j) => j.ad.adId)
const flags = (jobs: ReturnType<typeof rank>) =>
    Object.fromEntries(jobs.map((j) => [j.ad.adId, j.flag]))
const values = (jobs: ReturnType<typeof rank>) =>
    Object.fromEntries(jobs.map((j) => [j.ad.adId, j.value]))

beforeEach(() => {
    next = 0
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('adKind and stateDelta (recommendations.md, "Ad kinds")', () => {
    it('recognises bait in any case, then steal, infiltrate and investigate by prefix', () => {
        expect(adKind({ message: BAIT })).toBe('bait')
        expect(adKind({ message: 'Steal SUPER Awesome Diamond pants from Ann' })).toBe('bait')
        expect(adKind({ message: 'Steal a goat from Ann' })).toBe('steal')
        expect(adKind({ message: 'Infiltrate the guild' })).toBe('infiltrate')
        expect(adKind({ message: 'Investigate the mill' })).toBe('investigate')
        expect(adKind({ message: 'Help Steal nothing' })).toBe('other')
        expect(adKind({ message: 'steal a goat' })).toBe('other')
    })

    it('moves state by message prefix: −2, +2, +1 or 0', () => {
        expect(stateDelta('Steal a goat from Ann')).toBe(-2)
        expect(stateDelta('Infiltrate the guild')).toBe(2)
        expect(stateDelta('Investigate the mill')).toBe(1)
        expect(stateDelta('Help the baker')).toBe(0)
        expect(stateDelta('steal a goat')).toBe(0)
    })

    it('bait follows its prefix too', () => {
        expect(stateDelta(BAIT)).toBe(-2)
        expect(stateDelta('Investigate the super awesome diamond mine')).toBe(1)
        expect(stateDelta('Rescue the super awesome diamond cat')).toBe(0)
    })
})

describe('rankJobs (recommendations.md, "Jobs")', () => {
    it('value sort: value, then win %, then expiry, then adId; the first is Best pick', () => {
        const cake = ad('Piece of cake', 10, { adId: 'cake' }) // 950 − 425 = 525
        const walk = ad('Walk in the park', 100, { adId: 'walk' }) // 8700 − 1105 = 7595
        const gamble = ad('Gamble', 200, { adId: 'gamble' }) // 11000 − 3825 = 7175
        const suicide = ad('Suicide mission', 500, { adId: 'suicide' }) // 3000 − 7990 = −4990
        const sure = ad('Sure thing', 5, { adId: 'sure' }) // 500
        const likely = ad('Quite likely', 40, { adId: 'likely' }) // 2880 − 2380 = 500
        const soon = ad('Walk in the park', 100, { adId: 'zz-soon', expiresIn: 1 }) // = walk
        const twinB = ad('Gamble', 200, { adId: 'twin-b' })
        const twinA = ad('Gamble', 200, { adId: 'twin-a' })
        const jobs = rank([suicide, cake, likely, gamble, twinB, sure, walk, soon, twinA])
        expect(ids(jobs)).toEqual([
            'zz-soon',
            'walk',
            'gamble',
            'twin-a',
            'twin-b',
            'cake',
            'sure',
            'likely',
            'suicide',
        ])
        expect(jobs.map((j) => j.value)).toEqual([
            7595, 7595, 7175, 7175, 7175, 525, 500, 500, -4990,
        ])
        expect(best(jobs)).toEqual(['zz-soon'])
        expect(jobs.every((j) => j.flag === null)).toBe(true)
    })

    it('loss cost is 75 plus the best safe playable reward, 0 with no safe ad', () => {
        const risky = ad('Risky', 300, { adId: 'risky' })
        expect(rank([risky])[0]?.value).toBe(41 * 300 - 59 * 75)
        const safe = ad('Sure thing', 60, { adId: 'safe' })
        expect(values(rank([risky, safe])).risky).toBe(41 * 300 - 59 * 135)
    })

    it('bait: a trap with no value, last, never Best pick; every steal is state-risk', () => {
        const bait = ad('Sure thing', 1000, { adId: 'bait', message: BAIT })
        const steal = ad('Sure thing', 900, { adId: 'steal', message: 'Steal a goat from Ann' })
        const steal2 = ad('Gamble', 50, { adId: 'steal2', message: 'Steal a cart' })
        const plain = ad('Gamble', 20, { adId: 'plain' })
        const jobs = rank([bait, steal, plain, steal2])
        expect(ids(jobs)).toEqual(['plain', 'steal', 'steal2', 'bait'])
        expect(flags(jobs)).toEqual({
            plain: null,
            steal: 'state-risk',
            steal2: 'state-risk',
            bait: 'trap',
        })
        expect(best(jobs)).toEqual(['plain'])
        // Only playable safe ads set the loss cost: neither the safe bait nor the safe steal.
        expect(values(jobs)).toEqual({
            plain: 55 * 20 - 45 * 75,
            steal: 100 * 900,
            steal2: 55 * 50 - 45 * 75,
            bait: null,
        })
    })

    it('bait alone is still never Best pick', () => {
        const jobs = rank([ad('Sure thing', 1000, { message: BAIT })])
        expect(jobs[0]?.flag).toBe('trap')
        expect(best(jobs)).toEqual([])
    })

    it('left-out steals sort by value, not adId', () => {
        const low = ad('Gamble', 10, { adId: 'a-low', message: 'Steal a hat' })
        const high = ad('Gamble', 90, { adId: 'b-high', message: 'Steal a cart' })
        const plain = ad('Impossible', 1, { adId: 'plain' })
        const jobs = rank([low, high, plain], { stateEstimate: -7 })
        expect(ids(jobs)).toEqual(['plain', 'b-high', 'a-low'])
    })

    it('unknown odds and traps each sort by expiry, then adId', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const plain = ad('Impossible', 1, { adId: 'plain' })
        const unknownLate = ad('Maybe?', 900, { adId: 'u-a', expiresIn: 6 })
        const unknownB = ad('Perhaps', 1, { adId: 'u-c', expiresIn: 2 })
        const unknownA = ad('Perhaps', 1, { adId: 'u-b', expiresIn: 2 })
        const trapLate = ad('Sure thing', 900, { adId: 't-a', message: BAIT, expiresIn: 6 })
        const trapB = ad('Gamble', 1, { adId: 't-c', message: BAIT, expiresIn: 2 })
        const trapA = ad('Gamble', 1, { adId: 't-b', message: BAIT, expiresIn: 2 })
        const jobs = rank([trapLate, unknownLate, trapB, unknownB, plain, trapA, unknownA])
        expect(ids(jobs)).toEqual(['plain', 'u-b', 'u-c', 'u-a', 't-b', 't-c', 't-a'])
    })

    it('state guard: at −7 a steal is state-risk and sorts after the playable ads', () => {
        const steal = ad('Sure thing', 900, { adId: 'steal', message: 'Steal a goat' })
        const plain = ad('Risky', 20, { adId: 'plain' })
        const guarded = rank([steal, plain], { stateEstimate: -7 })
        expect(ids(guarded)).toEqual(['plain', 'steal'])
        expect(flags(guarded)).toEqual({ plain: null, steal: 'state-risk' })
        expect(best(guarded)).toEqual(['plain'])
    })

    it('state guard: at −6 a steal lands exactly on −8 and stays playable', () => {
        const steal = ad('Sure thing', 900, { adId: 'steal', message: 'Steal a goat' })
        const plain = ad('Risky', 20, { adId: 'plain' })
        const open = rank([steal, plain], { stateEstimate: -6 })
        expect(ids(open)).toEqual(['steal', 'plain'])
        expect(flags(open)).toEqual({ plain: null, steal: null })
        expect(best(open)).toEqual(['steal'])
    })

    it('state guard: an unknown-label steal keeps its state-risk flag', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const steal = ad('Maybe?', 900, { adId: 'steal', message: 'Steal a goat' })
        const plain = ad('Risky', 20, { adId: 'plain' })
        const jobs = rank([steal, plain], { stateEstimate: -7 })
        expect(ids(jobs)).toEqual(['plain', 'steal'])
        expect(jobs[1]).toMatchObject({ flag: 'state-risk', winPct: null, value: null })
    })

    it('only steals under the state guard: they stay playable, unflagged, best by value', () => {
        const a = ad('Gamble', 100, { adId: 'a', message: 'Steal a goat' })
        const b = ad('Sure thing', 10, { adId: 'b', message: 'Steal a hat' })
        const jobs = rank([b, a], { stateEstimate: -7 })
        expect(flags(jobs)).toEqual({ a: null, b: null })
        // lossCost 85: a = 5500 − 3825 = 1675, b = 1000.
        expect(best(jobs)).toEqual(['a'])
    })

    it('only steals beside bait: they stay playable, unflagged, best by value', () => {
        const a = ad('Gamble', 100, { adId: 'a', message: 'Steal a goat' })
        const b = ad('Sure thing', 10, { adId: 'b', message: 'Steal a hat' })
        const bait = ad('Sure thing', 1, { adId: 'bait', message: BAIT })
        const jobs = rank([bait, b, a])
        expect(flags(jobs)).toEqual({ a: null, b: null, bait: 'trap' })
        expect(ids(jobs)).toEqual(['a', 'b', 'bait'])
        expect(best(jobs)).toEqual(['a'])
    })

    it('broke: Best pick is the safest playable ad (tier, reward, expiry, adId)', () => {
        const walk = ad('Walk in the park', 300, { adId: 'walk' }) // top value
        const cakeLow = ad('Piece of cake', 10, { adId: 'cake-low' })
        const sureHigh = ad('Sure thing', 20, { adId: 'sure-high', expiresIn: 6 })
        const sureSoon = ad('Sure thing', 20, { adId: 'z-sure-soon', expiresIn: 2 })
        const board = [walk, cakeLow, sureHigh, sureSoon]
        const rich = rank(board, { gold: 50 })
        expect(best(rich)).toEqual(['walk'])
        const broke = rank(board, { gold: 49 })
        expect(best(broke)).toEqual(['z-sure-soon'])
        expect(ids(broke)).toEqual(ids(rich)) // the order itself is still by value
    })

    it('broke: tier beats reward, from moderate down to deadly', () => {
        const moderate = ad('Walk in the park', 900, { adId: 'moderate' })
        const risky = ad('Gamble', 2000, { adId: 'risky' })
        const deadly = ad('Impossible', 5000, { adId: 'deadly' })
        expect(best(rank([deadly, risky, moderate], { gold: 0 }))).toEqual(['moderate'])
        expect(best(rank([deadly, risky], { gold: 0 }))).toEqual(['risky'])
    })

    it('broke: a playable unknown-odds ad is the least safe', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const unknown = ad('Maybe?', 5000, { adId: 'unknown' })
        const deadly = ad('Impossible', 1, { adId: 'deadly' })
        expect(best(rank([unknown, deadly], { gold: 0 }))).toEqual(['deadly'])
    })

    it('broke: adId breaks a full tie', () => {
        const b = ad('Risky', 10, { adId: 'b' })
        const a = ad('Risky', 10, { adId: 'a' })
        expect(best(rank([b, a], { gold: 0 }))).toEqual(['a'])
    })

    it('broke uses the cheapest potion price, not the cheapest item', () => {
        const walk = ad('Walk in the park', 300, { adId: 'walk' })
        const cake = ad('Piece of cake', 10, { adId: 'cake' })
        expect(best(rank([walk, cake], { gold: 40, shop: [claws, potion] }))).toEqual(['cake'])
        const cheapPotion = { ...potion, id: 'hpot', cost: 30 }
        expect(best(rank([walk, cake], { gold: 40, shop: [potion, claws, cheapPotion] }))).toEqual([
            'walk',
        ])
    })

    it('broke never picks a steal left out by the guard, nor a trap', () => {
        const steal = ad('Sure thing', 900, { adId: 'steal', message: 'Steal a goat' })
        const plain = ad('Gamble', 20, { adId: 'plain' })
        expect(best(rank([steal, plain], { gold: 0, stateEstimate: -8 }))).toEqual(['plain'])
    })

    it('unknown gold: no broke exception; Best pick is the top value', () => {
        const walk = ad('Walk in the park', 300, { adId: 'walk' })
        const cake = ad('Piece of cake', 10, { adId: 'cake' })
        expect(best(rank([walk, cake], { gold: null }))).toEqual(['walk'])
    })

    it('no potion in the shop: no broke exception', () => {
        const walk = ad('Walk in the park', 300, { adId: 'walk' })
        const cake = ad('Piece of cake', 10, { adId: 'cake' })
        expect(best(rank([walk, cake], { gold: 0, shop: [claws] }))).toEqual(['walk'])
    })

    it('unknown label: unknown odds, after the flagged steals, before the traps; warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const odd = ad('Odd label', 5000, { adId: 'odd' })
        const bait = ad('Sure thing', 1, { adId: 'bait', message: BAIT })
        const steal = ad('Impossible', 1, { adId: 'steal', message: 'Steal a goat' })
        const plain = ad('Impossible', 1, { adId: 'plain' })
        const jobs = rank([bait, odd, steal, plain])
        expect(ids(jobs)).toEqual(['plain', 'steal', 'odd', 'bait'])
        const unknown = jobs.find((j) => j.ad.adId === 'odd')
        expect(unknown).toMatchObject({ winPct: null, value: null, tier: 'unknown', flag: null })
        expect(best(jobs)).toEqual(['plain'])
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Odd label'))
    })

    it('unknown odds only: the first one by expiry is Best pick', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const late = ad('Maybe?', 500, { adId: 'late', expiresIn: 7 })
        const soon = ad('Perhaps', 5, { adId: 'soon', expiresIn: 1 })
        const jobs = rank([late, soon])
        expect(ids(jobs)).toEqual(['soon', 'late'])
        expect(best(jobs)).toEqual(['soon'])
    })

    it('unsolvable: sorts as unknown odds, never Best pick, no flag', () => {
        const locked = ad('Fher guvat', 9000, { adId: 'locked', solvable: false })
        const plain = ad('Impossible', 1, { adId: 'plain' })
        const bait = ad('Sure thing', 1, { adId: 'bait', message: BAIT })
        const jobs = rank([locked, bait, plain])
        expect(ids(jobs)).toEqual(['plain', 'locked', 'bait'])
        expect(jobs[1]).toMatchObject({ winPct: null, tier: 'unknown', flag: null, best: false })
        expect(best(rank([locked]))).toEqual([])
    })

    it('empty board: no rows and no Best pick', () => {
        expect(rank([])).toEqual([])
    })

    it('never filters: every ad on the board is returned once', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const board = [
            ad('Sure thing', 1, { message: BAIT }),
            ad('Gamble', 5, { message: 'Steal a cart' }),
            ad('Nope', 5),
            ad('Risky', 5, { solvable: false }),
            ad('Walk in the park', 5),
        ]
        const jobs = rank(board)
        expect(jobs).toHaveLength(board.length)
        expect(new Set(jobs.map((j) => j.ad))).toEqual(new Set(board))
    })
})
