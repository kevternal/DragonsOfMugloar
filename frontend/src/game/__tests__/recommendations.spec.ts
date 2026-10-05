import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    adKind,
    itemAdvice,
    rankJobs,
    recommendItem,
    shelfOrder,
    shopHint,
    stateDelta,
    type JobsInput,
    type ShopInput,
} from '../recommendations'
import { raisedStat } from '../shop'
import type { Ad, ShopItem } from '../types'
import { LIVE_SHOP } from '@/__tests__/stub-api'

vi.mock('../shop', async (importOriginal) => {
    const real = await importOriginal<typeof import('../shop')>()
    // A second item that grants a life, so potion detection by effect can be told from by id.
    const itemEffect = (id: string) => (id === 'elixir' ? { lives: 1 } : real.itemEffect(id))
    return { ...real, itemEffect }
})

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

describe('shop (recommendations.md, "Shop (CAP-17)")', () => {
    const SHOP = [...LIVE_SHOP]
    const safe = () => ad('Piece of cake', 30)
    const moderate = () => ad('Walk in the park', 60)
    const deadly = () => ad('Playing with fire', 200)
    const noPotion = SHOP.filter((item) => item.id !== 'hpot')

    function recommend(input: Partial<ShopInput>) {
        return recommendItem({
            lives: 3,
            gold: 0,
            board: [safe()],
            shop: SHOP,
            purchases: {},
            stateEstimate: 0,
            ...input,
        })
    }

    describe('step 1: low on lives', () => {
        it('at 1 life with 50 gold, recommends the potion; the tab says Low on lives', () => {
            const rec = recommend({ lives: 1, gold: 50, board: [deadly()] })
            expect(rec).toEqual({ itemId: 'hpot', reason: 'low-lives' })
            expect(shopHint(1, rec)).toBe('low-lives')
        })

        it('at 1 life with 49 gold, recommends nothing; the tab still says Low on lives', () => {
            const rec = recommend({ lives: 1, gold: 49 })
            expect(rec).toBeNull()
            expect(shopHint(1, rec)).toBe('low-lives')
        })

        it('at 1 life with 400 gold and a deadly board, still the potion, never a +2 item', () => {
            expect(recommend({ lives: 1, gold: 400, board: [deadly()] })).toEqual({
                itemId: 'hpot',
                reason: 'low-lives',
            })
        })

        it('comes before the playable-ad check: an empty or bait-only board still gets the potion', () => {
            const bait = ad('Playing with fire', 100, { message: BAIT })
            for (const board of [[], [bait]]) {
                expect(recommend({ lives: 1, gold: 50, board })).toEqual({
                    itemId: 'hpot',
                    reason: 'low-lives',
                })
            }
        })

        it('picks the cheapest item that grants a life', () => {
            const shop = [{ id: 'hpot', name: 'Big potion', cost: 80 }, ...SHOP.slice(1)]
            expect(recommend({ lives: 1, gold: 80, shop })?.itemId).toBe('hpot')
            expect(recommend({ lives: 1, gold: 79, shop })).toBeNull()
        })

        it('finds the potion by its effect, not its id; a cost tie keeps API order', () => {
            // `elixir` grants a life in this file's itemEffect mock.
            const elixir = { id: 'elixir', name: 'Elixir', cost: 50 }
            expect(recommend({ lives: 1, gold: 50, shop: [elixir, ...SHOP] })?.itemId).toBe(
                'elixir',
            )
            expect(recommend({ lives: 1, gold: 50, shop: [...SHOP, elixir] })?.itemId).toBe('hpot')
            const cheaper = { ...elixir, cost: 40 }
            expect(recommend({ lives: 1, gold: 40, shop: [...noPotion, cheaper] })?.itemId).toBe(
                'elixir',
            )
        })
    })

    describe('step 2: 2 lives, no safe playable ad, 350+ gold', () => {
        it('recommends the least-bought +2 item; the tab says Level up', () => {
            const rec = recommend({ lives: 2, gold: 350, board: [moderate()] })
            expect(rec).toEqual({ itemId: 'ch', reason: 'level-up' })
            expect(shopHint(2, rec)).toBe('level-up')
        })

        it('needs 350 gold', () => {
            expect(recommend({ lives: 2, gold: 349, board: [moderate()] })).toBeNull()
        })

        it('a safe ad on the board means step 3 decides, at 400 gold', () => {
            const board = [safe(), moderate()]
            expect(recommend({ lives: 2, gold: 399, board })).toBeNull()
            expect(recommend({ lives: 2, gold: 400, board })?.itemId).toBe('ch')
        })

        it('only at exactly 2 lives: at 3 lives, 350 gold on a moderate board is no reason', () => {
            expect(recommend({ lives: 3, gold: 350, board: [moderate()] })).toBeNull()
        })

        it('reuses the playable set: a safe steal left out by bait does not count as safe', () => {
            const steal = ad('Sure thing', 40, { message: 'Steal a goat from Ann' })
            const bait = ad('Sure thing', 900, { message: BAIT })
            const board = [steal, moderate(), bait]
            expect(recommend({ lives: 2, gold: 350, board })?.itemId).toBe('ch')
            // Without the bait the steal is playable and safe, so step 2 does not apply.
            expect(recommend({ lives: 2, gold: 350, board: [steal, moderate()] })).toBeNull()
        })

        it('reuses the state guard: at state −7 a safe steal is left out, so step 2 applies', () => {
            const steal = ad('Sure thing', 40, { message: 'Steal a goat from Ann' })
            const board = [steal, moderate()]
            expect(recommend({ lives: 2, gold: 350, board, stateEstimate: -7 })?.itemId).toBe('ch')
            expect(recommend({ lives: 2, gold: 350, board, stateEstimate: -6 })).toBeNull()
        })
    })

    describe('step 3: proactive, 2+ lives, some playable ad not safe, 400+ gold', () => {
        it('at 3 lives and 400 gold with a moderate ad among safe ones, recommends a +2 item', () => {
            const rec = recommend({ lives: 3, gold: 400, board: [safe(), moderate()] })
            expect(rec).toEqual({ itemId: 'ch', reason: 'level-up' })
            expect(shopHint(3, rec)).toBe('level-up')
        })

        it('needs 400 gold', () => {
            expect(recommend({ lives: 3, gold: 399, board: [safe(), moderate()] })).toBeNull()
        })

        it('needs 2 lives: at 1 life with no potion in the shop, nothing', () => {
            const board = [safe(), moderate()]
            expect(recommend({ lives: 1, gold: 1000, board, shop: noPotion })).toBeNull()
        })

        it('unknown odds count as not safe, as in the backend', () => {
            vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            const odd = ad('Odd label', 50)
            expect(recommend({ lives: 3, gold: 400, board: [safe(), odd] })?.itemId).toBe('ch')
        })
    })

    describe('step 4: 2+ lives, an all-deadly playable board, 350+ gold', () => {
        it.each([2, 3, 5])('at %i lives and 350 gold recommends a +2 item', (lives) => {
            expect(recommend({ lives, gold: 350, board: [deadly(), deadly()] })).toEqual({
                itemId: 'ch',
                reason: 'level-up',
            })
        })

        it('at 399 gold too, below the proactive threshold', () => {
            expect(recommend({ lives: 3, gold: 399, board: [deadly()] })?.itemId).toBe('ch')
        })

        it('needs 350 gold, and every playable ad deadly', () => {
            expect(recommend({ lives: 3, gold: 349, board: [deadly()] })).toBeNull()
            expect(recommend({ lives: 3, gold: 350, board: [deadly(), moderate()] })).toBeNull()
        })

        it('needs 2 lives: at 1 life with no potion in the shop, nothing', () => {
            expect(recommend({ lives: 1, gold: 399, board: [deadly()], shop: noPotion })).toBeNull()
        })
    })

    describe('no recommendation', () => {
        it('at 3 lives and 400 gold when every playable ad is safe', () => {
            const rec = recommend({ lives: 3, gold: 400, board: [safe(), safe()] })
            expect(rec).toBeNull()
            expect(shopHint(3, rec)).toBeNull()
        })

        it('steps 2–4 need a playable ad: an empty board, or only bait', () => {
            expect(recommend({ lives: 2, gold: 1000, board: [] })).toBeNull()
            const bait = ad('Playing with fire', 100, { message: BAIT })
            expect(recommend({ lives: 2, gold: 1000, board: [bait] })).toBeNull()
        })

        it('when no +2 item is in the shop', () => {
            const shop = SHOP.filter((item) => item.cost < 300)
            expect(recommend({ lives: 2, gold: 1000, board: [deadly()], shop })).toBeNull()
        })

        it.each([
            { lives: null, gold: 500 },
            { lives: 1, gold: null },
            { lives: 2, gold: null },
        ])('with lives $lives and gold $gold (unknown stats)', ({ lives, gold }) => {
            expect(recommend({ lives, gold, board: [deadly()] })).toBeNull()
        })

        it('the tab hint: none while lives are unknown; Low on lives at 1 life whatever the gold', () => {
            expect(shopHint(null, { itemId: 'ch', reason: 'level-up' })).toBeNull()
            expect(shopHint(1, null)).toBe('low-lives')
            expect(shopHint(2, null)).toBeNull()
        })
    })

    describe('least-bought +2 item', () => {
        it('rotates: with ch bought twice and the rest once, the first other one in shelf order', () => {
            const purchases = { ch: 2, rf: 1, iron: 1, mtrix: 1, wingpotmax: 1, cs: 0 }
            expect(recommend({ lives: 3, gold: 400, board: [moderate()], purchases })?.itemId).toBe(
                'rf',
            )
        })

        it('picks the fewest buys, ignoring +1 items and the potion', () => {
            const purchases = { ch: 3, rf: 2, iron: 1, mtrix: 2, wingpotmax: 1, cs: 0, hpot: 0 }
            expect(recommend({ lives: 3, gold: 400, board: [moderate()], purchases })?.itemId).toBe(
                'iron',
            )
        })

        it('a tie goes to shelf order (cheapest first), not API order', () => {
            const shop = [
                { id: 'ch', name: 'Claw Honing', cost: 360 },
                { id: 'rf', name: 'Rocket Fuel', cost: 300 },
            ]
            expect(recommend({ lives: 2, gold: 400, board: [deadly()], shop })?.itemId).toBe('rf')
        })

        it('only among affordable +2 items; equal costs keep API order', () => {
            const shop = [
                { id: 'mtrix', name: 'Book of Megatricks', cost: 300 },
                { id: 'ch', name: 'Claw Honing', cost: 360 },
                { id: 'rf', name: 'Rocket Fuel', cost: 300 },
            ]
            const input = { lives: 2, board: [deadly()], shop }
            expect(recommend({ ...input, gold: 359 })?.itemId).toBe('mtrix')
            // ch, never bought, is out of reach at 359 gold.
            expect(recommend({ ...input, gold: 359, purchases: { mtrix: 1, rf: 1 } })?.itemId).toBe(
                'mtrix',
            )
            expect(recommend({ ...input, gold: 360, purchases: { mtrix: 1, rf: 1 } })?.itemId).toBe(
                'ch',
            )
            expect(recommend({ ...input, gold: 359, purchases: { mtrix: 1 } })?.itemId).toBe('rf')
        })
    })

    it('itemAdvice: potion, +2 items, and +1 items marked not worth it', () => {
        expect(SHOP.map((item) => [item.id, itemAdvice(item.id)])).toEqual([
            ['hpot', 'potion'],
            ['cs', 'plus1-not-worth'],
            ['gas', 'plus1-not-worth'],
            ['wax', 'plus1-not-worth'],
            ['tricks', 'plus1-not-worth'],
            ['wingpot', 'plus1-not-worth'],
            ['ch', 'plus2'],
            ['rf', 'plus2'],
            ['iron', 'plus2'],
            ['mtrix', 'plus2'],
            ['wingpotmax', 'plus2'],
        ])
    })

    it('itemAdvice: an unlisted item has no advice and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        expect(itemAdvice('dragonfruit')).toBeNull()
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('dragonfruit'))
    })

    it('shelfOrder: cost ascending, then API order; never grouped by effect; input untouched', () => {
        const shop = [SHOP[6]!, SHOP[1]!, SHOP[0]!, SHOP[7]!, SHOP[2]!]
        expect(shelfOrder(shop).map((item) => item.id)).toEqual(['hpot', 'cs', 'gas', 'ch', 'rf'])
        expect(shop.map((item) => item.id)).toEqual(['ch', 'cs', 'hpot', 'rf', 'gas'])
    })
})

describe('raisedStat (CAP-4)', () => {
    it('level first, then lives; a change of 0 or no change raises nothing', () => {
        expect(raisedStat({ level: 2, gold: -300 })).toBe('level')
        expect(raisedStat({ lives: 1, gold: -50 })).toBe('lives')
        expect(raisedStat({ level: 0, gold: -300 })).toBeNull()
        expect(raisedStat({ level: -1, lives: 0 })).toBeNull()
        expect(raisedStat({})).toBeNull()
    })
})
