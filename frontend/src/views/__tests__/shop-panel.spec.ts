import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { items, json, liveItem, stubApi, startBody } from '@/__tests__/stub-api'
import { useGameStore } from '@/stores/game'
import ShopPanel from '../ShopPanel.vue'

// The live shop, shuffled to check the shelf order.
const SHOP = [
    'ch',
    'hpot',
    'cs',
    'gas',
    'rf',
    'wax',
    'tricks',
    'wingpot',
    'iron',
    'mtrix',
    'wingpotmax',
].map(liveItem)
const board = [
    {
        adId: 'm1',
        message: 'Help the baker',
        reward: 40,
        expiresIn: 4,
        encrypted: null,
        probability: 'Walk in the park',
    },
]
const BADGES = ['Buy next', 'Low on lives', 'Not worth it']

type Wrapper = ReturnType<typeof mount>
type Routes = Record<string, () => Response | Promise<Response>>

/** Plays a started g1 with the full shop; `routes` adds or overrides stubs. */
async function openShop(routes: Routes = {}) {
    stubApi({
        'POST /game/start': () => json(startBody('g1')),
        'GET /g1/shop': () => json(SHOP),
        'GET /g1/messages': () => json(board),
        ...routes,
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const game = useGameStore()
    await game.start()
    const wrapper = mount(ShopPanel, { global: { plugins: [pinia] } })
    return { game, wrapper }
}

/** A button's accessible name: its content without aria-hidden parts. */
function accessibleName(el: Element): string {
    const content = el.cloneNode(true) as Element
    content.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (content.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The item buttons in display order, with their accessible names. */
const itemButtons = (wrapper: Wrapper) =>
    wrapper.findAll('li button').map((b) => ({ button: b, name: accessibleName(b.element) }))

/** A row's button by the start of its accessible name (the item name). */
function itemButton(wrapper: Wrapper, itemName: string) {
    const found = itemButtons(wrapper).find((b) => b.name.startsWith(`${itemName},`))
    if (!found) {
        throw new Error(`No item named ${itemName}`)
    }
    return found
}
const nameOf = (wrapper: Wrapper, itemName: string) => itemButton(wrapper, itemName).name
const badgeIn = (name: string) => BADGES.find((badge) => name.includes(`, ${badge},`)) ?? null
const badgeOf = (wrapper: Wrapper, itemName: string) => badgeIn(nameOf(wrapper, itemName))
/** What a row shows beside its button: the buy result and any shortfall. */
function besideRowButton(li: Element): string {
    const row = li.cloneNode(true) as Element
    row.querySelector('button')?.remove()
    return (row.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const besideButton = (wrapper: Wrapper, itemName: string) =>
    besideRowButton(itemButton(wrapper, itemName).button.element.closest('li')!)
const badges = (wrapper: Wrapper) =>
    Object.fromEntries(itemButtons(wrapper).map(({ name }) => [name.split(',')[0], badgeIn(name)]))

describe('ShopPanel', () => {
    it('shows a notice and a retry button after a failed fetch, hiding the empty text', async () => {
        let fail = true
        const calls = stubApi({
            'GET /g1/messages': () => json([]),
            'GET /g1/shop': () => (fail ? new Response('x', { status: 500 }) : json(items)),
            'POST /game/start': () => json(startBody('g1')),
        })
        const pinia = createPinia()
        setActivePinia(pinia)
        await useGameStore().start()
        const wrapper = mount(ShopPanel, { global: { plugins: [pinia] } })
        expect(wrapper.text()).not.toContain('The shelves are empty')
        const button = wrapper.get('button')
        expect(button.text()).toBe('Check the shop again')
        fail = false
        await button.trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('Healing potion')
        expect(wrapper.text()).not.toContain('Check the shop again')
        expect(calls.filter((c) => c === 'GET /g1/shop')).toHaveLength(2)
    })

    it('a flavour line follows the heading', async () => {
        const { wrapper } = await openShop()
        expect(wrapper.get('h1').element.nextElementSibling?.textContent).toBe(
            'Wares for your dragon, cheapest on the top shelf. Pay at the counter.',
        )
    })

    it('lists all items on cheapest-first shelves, API order within a cost, planks between costs', async () => {
        const { wrapper } = await openShop()
        const rows = wrapper.get('ul').findAll('li')
        expect(itemButtons(wrapper).map(({ name }) => name.split(',')[0])).toEqual([
            'Healing potion',
            'Claw Sharpening',
            'Gasoline',
            'Copper Plating',
            'Book of Tricks',
            'Potion of Stronger Wings',
            'Claw Honing',
            'Rocket Fuel',
            'Iron Plating',
            'Book of Megatricks',
            'Potion of Awesome Wings',
        ])
        expect(rows.flatMap((li, i) => (li.classes('plank') ? [i] : []))).toEqual([1, 6])
    })

    it('marks every +1 item Not worth it, in any state', async () => {
        const { game, wrapper } = await openShop()
        for (const stats of [
            { lives: 3, gold: 0 },
            { lives: 1, gold: 1000 },
            { lives: 3, gold: 400 },
        ]) {
            Object.assign(game.stats, stats)
            await flushPromises()
            for (const name of [
                'Claw Sharpening',
                'Gasoline',
                'Copper Plating',
                'Book of Tricks',
                'Potion of Stronger Wings',
            ]) {
                expect(badgeOf(wrapper, name)).toBe('Not worth it')
            }
        }
    })

    it('low on lives: the potion gets Low on lives, and nothing else is recommended', async () => {
        const { game, wrapper } = await openShop()
        Object.assign(game.stats, { lives: 1, gold: 400 })
        await flushPromises()
        const notWorth = 'Not worth it'
        expect(badges(wrapper)).toEqual({
            'Healing potion': 'Low on lives',
            'Claw Sharpening': notWorth,
            Gasoline: notWorth,
            'Copper Plating': notWorth,
            'Book of Tricks': notWorth,
            'Potion of Stronger Wings': notWorth,
            'Claw Honing': null,
            'Rocket Fuel': null,
            'Iron Plating': null,
            'Book of Megatricks': null,
            'Potion of Awesome Wings': null,
        })
    })

    it('broke at 1 life: no badge on the potion, which is disabled with its shortfall', async () => {
        const { game, wrapper } = await openShop()
        Object.assign(game.stats, { lives: 1, gold: 20 })
        await flushPromises()
        expect(badgeOf(wrapper, 'Healing potion')).toBeNull()
        const potion = itemButton(wrapper, 'Healing potion').button
        expect(potion.attributes('disabled')).toBeDefined()
        expect(wrapper.get(`#${potion.attributes('aria-describedby')}`).text()).toBe(
            'You need 30 more gold.',
        )
    })

    it('proactive: Buy next on the least-bought +2 item, rotating after a buy', async () => {
        const { game, wrapper } = await openShop({
            'POST /g1/shop/buy/ch': () =>
                json({ shoppingSuccess: true, gold: 600, lives: 3, level: 2, turn: 1 }),
        })
        Object.assign(game.stats, { lives: 3, gold: 900 })
        await flushPromises()
        expect(badgeOf(wrapper, 'Claw Honing')).toBe('Buy next')
        await itemButton(wrapper, 'Claw Honing').button.trigger('click')
        await flushPromises()
        expect(badgeOf(wrapper, 'Claw Honing')).toBeNull()
        expect(badgeOf(wrapper, 'Rocket Fuel')).toBe('Buy next')
    })

    it('a successful buy: owned ×1, the row states the effect, other rows stay quiet', async () => {
        const { game, wrapper } = await openShop({
            'POST /g1/shop/buy/rf': () =>
                json({ shoppingSuccess: true, gold: 0, lives: 3, level: 2, turn: 1 }),
        })
        game.stats.gold = 300
        await flushPromises()
        expect(itemButtons(wrapper).filter(({ name }) => name.includes('owned'))).toEqual([])
        await itemButton(wrapper, 'Rocket Fuel').button.trigger('click')
        await flushPromises()
        expect(nameOf(wrapper, 'Rocket Fuel')).toMatch(/, owned 1, buy \(costs one turn\)$/)
        expect(besideButton(wrapper, 'Rocket Fuel')).toMatch(/^\+2 levels/)
        const others = itemButtons(wrapper)
            .map(({ name }) => name.split(',')[0]!)
            .filter((n) => n !== 'Rocket Fuel')
        // At 0 gold every other row shows only its shortfall.
        for (const other of others) {
            expect(besideButton(wrapper, other)).toMatch(/^(You need \d+ more gold\.)?$/)
        }
        expect(game.log[game.log.length - 1]).toMatchObject({ kind: 'buy', itemId: 'rf' })
    })

    it('the result goes on the bought item by id, even when names repeat', async () => {
        const twin = { id: 'iron', name: 'Rocket Fuel', cost: 300 }
        const { game, wrapper } = await openShop({
            'GET /g1/shop': () => json([liveItem('rf'), twin]),
            'POST /g1/shop/buy/iron': () =>
                json({ shoppingSuccess: true, gold: 0, lives: 3, level: 2, turn: 1 }),
        })
        game.stats.gold = 300
        await flushPromises()
        const [first, second] = wrapper.findAll('li')
        await second!.get('button').trigger('click')
        await flushPromises()
        expect(accessibleName(second!.get('button').element)).toContain('owned 1')
        expect(besideRowButton(second!.element)).toMatch(/^\+2 levels/)
        expect(accessibleName(first!.get('button').element)).not.toContain('owned')
        expect(besideRowButton(first!.element)).toBe('You need 300 more gold.')
    })

    it('disables every row while an action is pending', async () => {
        let release: (r: Response) => void = () => undefined
        const { game, wrapper } = await openShop({
            'POST /g1/shop/buy/hpot': () => new Promise<Response>((resolve) => (release = resolve)),
        })
        game.stats.gold = 1000
        await flushPromises()
        const enabled = () =>
            itemButtons(wrapper).filter(({ button }) => !button.element.hasAttribute('disabled'))
        expect(enabled()).toHaveLength(11)
        void game.buy('hpot')
        await flushPromises()
        expect(enabled()).toHaveLength(0)
        release(json({ shoppingSuccess: true, gold: 950, lives: 4, level: 0, turn: 1 }))
        await flushPromises()
        expect(enabled()).toHaveLength(11)
    })

    it('a failed buy: the count is unchanged and the row says so', async () => {
        const { game, wrapper } = await openShop({
            'POST /g1/shop/buy/rf': () =>
                json({ shoppingSuccess: false, gold: 300, lives: 3, level: 0, turn: 1 }),
        })
        game.stats.gold = 300
        await flushPromises()
        await itemButton(wrapper, 'Rocket Fuel').button.trigger('click')
        await flushPromises()
        expect(nameOf(wrapper, 'Rocket Fuel')).not.toContain('owned')
        expect(besideButton(wrapper, 'Rocket Fuel')).toBe(
            'The shopkeeper fumbled the sale. Nothing was bought.',
        )
    })
})
