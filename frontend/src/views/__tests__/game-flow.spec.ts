import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ads, html404, items, json, liveItem, startBody, stubApi } from '@/__tests__/stub-api'
import App from '@/App.vue'
import { routes } from '@/router'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

type DOMWrapperLike = { attributes: (name: string) => string | undefined; element: Element }

/** A button's accessible name: its aria-label, else its content without aria-hidden parts. */
function accessibleName(b: DOMWrapperLike): string {
    const label = b.attributes('aria-label')
    if (label !== undefined) {
        return label
    }
    const content = b.element.cloneNode(true) as Element
    content.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (content.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function mountAt(path: string, pinia = createPinia()) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    await flushPromises()
    return { router, wrapper }
}

const solveDead = () =>
    json({
        gold: 0,
        highScore: 0,
        lives: 0,
        message: 'Defeated',
        score: 77,
        success: false,
        turn: 9,
    })

describe('game flow', () => {
    it('Start pushes /game/<id>/ads', async () => {
        stubApi({
            'GET /g1/messages': () => json(ads),
            'GET /g1/shop': () => json(items),
            'POST /game/start': () => json(startBody('g1')),
        })
        const { router, wrapper } = await mountAt('/')
        await wrapper.get('button').trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.fullPath).toBe('/game/g1/ads')
    })

    it('redirects /game/g1 to /game/g1/ads', async () => {
        stubApi({ 'GET /g1/messages': () => json(ads), 'GET /g1/shop': () => json(items) })
        const { router } = await mountAt('/game/g1')
        expect(router.currentRoute.value.fullPath).toBe('/game/g1/ads')
    })

    it('game over lands on /over with final stats; Play again starts a new game', async () => {
        let starts = 0
        stubApi({
            'GET /g1/messages': () => json(ads),
            'GET /g1/shop': () => json(items),
            'GET /g2/messages': () => json(ads),
            'GET /g2/shop': () => json(items),
            'POST /g1/solve/a1': solveDead,
            'POST /game/start': () => json(startBody(starts++ === 0 ? 'g1' : 'g2')),
        })
        const { router, wrapper } = await mountAt('/')
        await wrapper.get('button').trigger('click')
        await flushPromises()
        const solve = wrapper.findAll('button').find((b) => accessibleName(b).startsWith('Solve'))
        await solve?.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('over')
        expect(wrapper.get('h1').text()).toBe('Game over')
        expect(wrapper.text()).toContain('77')
        expect(wrapper.text()).toContain('9')
        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Play again')
            ?.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.fullPath).toBe('/game/g2/ads')
    })

    it('an expired game returns to / with the notice', async () => {
        stubApi({ 'GET /g1/messages': html404, 'GET /g1/shop': () => json(items) })
        const { router, wrapper } = await mountAt('/game/g1/ads')
        expect(router.currentRoute.value.fullPath).toBe('/')
        expect(wrapper.text()).toContain('This game has gone cold')
    })

    it('a fresh /over URL redirects to / without any request', async () => {
        const calls = stubApi({})
        const { router } = await mountAt('/game/g1/over')
        expect(router.currentRoute.value.fullPath).toBe('/')
        expect(calls).toHaveLength(0)
    })

    describe('routed panels and layout shell (AD-10, AD-14)', () => {
        type Wrapper = Awaited<ReturnType<typeof mountAt>>['wrapper']
        const h1s = (w: Wrapper) => w.findAll('h1').map((h) => h.text())
        const button = (w: Wrapper, name: string) => {
            const found = w.findAll('button').find((b) => accessibleName(b).startsWith(name))
            if (!found) {
                throw new Error(`No button named ${name}`)
            }
            return found
        }
        const logEntries = (w: Wrapper) => w.get('[role="log"]').findAll('li')
        const solveOk = () =>
            json({
                gold: 82,
                highScore: 0,
                lives: 3,
                message: 'Well done',
                score: 5,
                success: true,
                turn: 9,
            })
        const boardAndShop = (extra: Record<string, () => Response | Promise<Response>> = {}) =>
            stubApi({
                'GET /g1/messages': () => json(ads),
                'GET /g1/shop': () => json(items),
                ...extra,
            })

        /** Mounts attached to the document (for focus); unmounted after each test. */
        const attached: Wrapper[] = []
        async function mountAttached(path: string, pinia = createPinia()) {
            const router = createRouter({ history: createMemoryHistory(), routes })
            await router.push(path)
            const wrapper = mount(App, {
                attachTo: document.body,
                global: { plugins: [pinia, router] },
            })
            attached.push(wrapper)
            await flushPromises()
            return { router, wrapper }
        }
        afterEach(() => {
            attached.splice(0).forEach((w) => w.unmount())
        })

        /** Plays g1 to game over with a lives-0 solve; returns the pinia holding it. */
        async function playToGameOver() {
            boardAndShop({ 'POST /g1/solve/a1': solveDead })
            const pinia = createPinia()
            const { router, wrapper } = await mountAt('/game/g1/ads', pinia)
            await button(wrapper, 'Solve').trigger('click')
            await flushPromises()
            expect(router.currentRoute.value.name).toBe('over')
            return { pinia, wrapper }
        }

        it('/shop renders only the shop, and the Shop link is the current page', async () => {
            boardAndShop()
            const { wrapper } = await mountAt('/game/g1/shop')
            expect(h1s(wrapper)).toEqual(['Shop'])
            expect(wrapper.text()).toContain('Healing potion')
            expect(wrapper.text()).not.toContain('Job one')
            const nav = wrapper.get('nav[aria-label="Game sections"]')
            const link = (name: string) => nav.findAll('a').find((a) => a.text() === name)
            expect(link('Shop')?.attributes('aria-current')).toBe('page')
            expect(link('Message board')?.attributes('aria-current')).toBeUndefined()
        })

        it('/ads renders only the jobs board', async () => {
            boardAndShop()
            const { wrapper } = await mountAt('/game/g1/ads')
            expect(h1s(wrapper)).toEqual(['Message board'])
            expect(wrapper.text()).toContain('Job one')
            expect(wrapper.text()).not.toContain('Healing potion')
        })

        it('shows reputation in the top bar after investigating, and logs it', async () => {
            boardAndShop({
                'POST /g1/investigate/reputation': () =>
                    json({ people: 4.9, state: -4, underworld: 7 }),
            })
            const { wrapper } = await mountAt('/game/g1/ads')
            await button(wrapper, 'Investigate reputation').trigger('click')
            await flushPromises()
            const values = wrapper
                .get('[aria-label="Reputation"]')
                .findAll('dd')
                .map((dd) => dd.text())
            expect(values).toEqual(['4.9', '-4', '7'])
            expect(logEntries(wrapper)).toHaveLength(1)
            expect(logEntries(wrapper)[0]?.text()).not.toMatch(/succeeded|failed/)
        })

        it('a solve appends a log entry carrying the API message', async () => {
            boardAndShop({ 'POST /g1/solve/a1': solveOk })
            const { wrapper } = await mountAt('/game/g1/ads')
            await button(wrapper, 'Solve').trigger('click')
            await flushPromises()
            expect(logEntries(wrapper)).toHaveLength(1)
            expect(logEntries(wrapper)[0]?.text()).toContain('T9')
            expect(logEntries(wrapper)[0]?.text()).toContain('Well done')
        })

        it('a failed turn shows the error alert in the game screen and logs nothing', async () => {
            boardAndShop({ 'POST /g1/solve/a1': () => new Response('x', { status: 500 }) })
            const { wrapper } = await mountAt('/game/g1/ads')
            await button(wrapper, 'Solve').trigger('click')
            await flushPromises()
            expect(wrapper.get('[role="alert"]').text()).toContain('The tavern is in an uproar')
            expect(logEntries(wrapper)).toHaveLength(0)
        })

        it('a reload starts with an empty log', async () => {
            boardAndShop({ 'POST /g1/solve/a1': solveOk })
            const first = await mountAt('/game/g1/ads')
            await button(first.wrapper, 'Solve').trigger('click')
            await flushPromises()
            expect(logEntries(first.wrapper)).toHaveLength(1)
            first.wrapper.unmount()

            const { wrapper } = await mountAt('/game/g1/ads') // fresh pinia = reload
            expect(logEntries(wrapper)).toHaveLength(0)
            expect(wrapper.text()).toContain('Nothing has happened yet.')
        })

        describe('shop tab hint and buy feedback (CAP-4, CAP-17)', () => {
            const shopItems = ['hpot', 'cs', 'rf'].map(liveItem)
            const moderateAd = { ...ads[0], adId: 'm1', probability: 'Walk in the park' }
            const shopLink = (w: Wrapper) =>
                w
                    .get('nav[aria-label="Game sections"]')
                    .findAll('a')
                    .find((a) => a.text().startsWith('Shop'))!

            it.each([
                { lives: 1, gold: 60, board: ads, name: 'Shop, Low on lives' },
                { lives: 1, gold: 10, board: ads, name: 'Shop, Low on lives' },
                { lives: 2, gold: 350, board: [moderateAd], name: 'Shop, Level up' },
                { lives: 3, gold: 400, board: [moderateAd], name: 'Shop, Level up' },
                { lives: 3, gold: 400, board: ads, name: 'Shop' },
                { lives: 1, gold: null, board: ads, name: 'Shop' },
                { lives: null, gold: 400, board: [moderateAd], name: 'Shop' },
            ])(
                'at $lives lives and $gold gold the Shop link reads $name',
                async ({ lives, gold, board, name }) => {
                    stubApi({
                        'GET /g1/messages': () => json(board),
                        'GET /g1/shop': () => json(shopItems),
                    })
                    const pinia = createPinia()
                    const { wrapper } = await mountAt('/game/g1/ads', pinia)
                    setActivePinia(pinia)
                    Object.assign(useGameStore().stats, { lives, gold })
                    await flushPromises()
                    expect(accessibleName(shopLink(wrapper))).toBe(name)
                },
            )

            it('a buy shows its effect on the row, emphasises the stat and logs it, until the next action', async () => {
                stubApi({
                    'GET /g1/messages': () => json(ads),
                    'GET /g1/shop': () => json(shopItems),
                    'POST /g1/shop/buy/rf': () =>
                        json({ shoppingSuccess: true, gold: 0, lives: 3, level: 2, turn: 1 }),
                    'POST /g1/shop/buy/hpot': () =>
                        json({ shoppingSuccess: true, gold: 0, lives: 4, level: 2, turn: 2 }),
                    'POST /g1/solve/a1': solveOk,
                })
                const pinia = createPinia()
                const { wrapper } = await mountAt('/game/g1/shop', pinia)
                setActivePinia(pinia)
                const game = useGameStore()
                Object.assign(game.stats, { lives: 3, gold: 300, level: 0 })
                await flushPromises()
                const emphasised = () =>
                    wrapper.findAll('.stats .changed dt').map((dt) => dt.text())
                const filledStatuses = () =>
                    wrapper
                        .findAll('.shop-row .status')
                        .map((el) => el.text())
                        .filter(Boolean)
                expect(emphasised()).toEqual([])

                await button(wrapper, 'Rocket Fuel').trigger('click')
                await flushPromises()
                expect(filledStatuses()).toEqual(['+2 levels'])
                expect(emphasised()).toEqual(['Level'])
                expect(accessibleName(button(wrapper, 'Rocket Fuel'))).toMatch(
                    /, owned 1, buy \(costs one turn\)$/,
                )
                expect(accessibleName(logEntries(wrapper)[logEntries(wrapper).length - 1]!)).toBe(
                    'Turn 1, succeeded: Bought Rocket Fuel, +2 levels, −300 gold',
                )

                game.stats.gold = 50
                await flushPromises()
                await button(wrapper, 'Healing potion').trigger('click')
                await flushPromises()
                expect(filledStatuses()).toEqual(['+1 life'])
                expect(emphasised()).toEqual(['Lives'])

                await game.solve('a1')
                await flushPromises()
                expect(filledStatuses()).toEqual([])
                expect(emphasised()).toEqual([])
            })
        })

        it('the credits name each icon author, the site and the licence', async () => {
            boardAndShop()
            const { wrapper } = await mountAt('/game/g1/ads')
            const credits = wrapper.get('.credits').text()
            for (const part of ['Lorc', 'Delapouite', 'Sbed', 'game-icons.net', 'CC BY 3.0']) {
                expect(credits).toContain(part)
            }
        })

        it('the jobs board lists ranked rows with Best pick, Trap and state-risk badges', async () => {
            const board = [
                {
                    adId: 'bait',
                    message: 'Steal super awesome diamond ring from Bob',
                    reward: 900,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Sure thing',
                },
                {
                    adId: 'steal',
                    message: 'Steal a goat from Ann',
                    reward: 300,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Piece of cake',
                },
                {
                    adId: 'low',
                    message: 'Mend the fence',
                    reward: 5,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Gamble',
                },
                {
                    adId: 'top',
                    message: 'Escort the mayor',
                    reward: 80,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Walk in the park',
                },
                {
                    adId: 'odd',
                    message: 'Count the sheep',
                    reward: 70,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Maybe?',
                },
                {
                    adId: 'locked',
                    message: 'Fher gur oevqtr',
                    reward: 40,
                    expiresIn: 3,
                    encrypted: 9,
                    probability: 'Evfxl',
                },
            ]
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            boardAndShop({ 'GET /g1/messages': () => json(board) })
            const { wrapper } = await mountAt('/game/g1/ads')
            const list = wrapper.get('section[aria-labelledby="ads-heading"] [role="list"]')
            const rows = list.findAll('li').map((li) => accessibleName(li.get('button')))
            expect(rows).toEqual([
                'Solve: moderate, Walk in the park, 87%, 80 gold, Best pick. Escort the mayor. 3 turns left',
                'Solve: risky, Gamble, 55%, 5 gold. Mend the fence. 3 turns left',
                'Solve: safe, Piece of cake, 95%, 300 gold, Angers the state. Steal a goat from Ann. 3 turns left',
                'Solve: unknown risk, Evfxl, unknown odds, 40 gold. Fher gur oevqtr. 3 turns left',
                'Solve: unknown risk, Maybe?, unknown odds, 70 gold. Count the sheep. 3 turns left',
                'Solve: safe, Sure thing, 100%, 900 gold, Trap. Steal super awesome diamond ring from Bob. 3 turns left',
            ])
            const locked = list.findAll('li')[3]!
            expect(locked.get('button').attributes('disabled')).toBeDefined()
            const noteId = locked.get('button').attributes('aria-describedby')
            expect(locked.get(`#${noteId}`).text()).toContain('cannot be solved')
            expect(list.findAll('li')[4]!.get('button').attributes('disabled')).toBeUndefined()
            expect(wrapper.text()).toContain('Best jobs first.')
            warn.mockRestore()
        })

        it('a reputation reading at state −7 flags a steal as angering the state', async () => {
            const board = [
                {
                    adId: 'steal',
                    message: 'Steal a goat from Ann',
                    reward: 300,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Piece of cake',
                },
                {
                    adId: 'plain',
                    message: 'Mend the fence',
                    reward: 5,
                    expiresIn: 3,
                    encrypted: null,
                    probability: 'Gamble',
                },
            ]
            boardAndShop({
                'GET /g1/messages': () => json(board),
                'POST /g1/investigate/reputation': () =>
                    json({ people: 0, state: -7, underworld: 0 }),
            })
            const { wrapper } = await mountAt('/game/g1/ads')
            const names = () =>
                wrapper
                    .get('[role="list"]')
                    .findAll('li')
                    .map((li) => accessibleName(li.get('button')))
            expect(names()[0]).toContain('Steal a goat')
            expect(names().join()).not.toContain('Angers the state')
            await button(wrapper, 'Investigate reputation').trigger('click')
            await flushPromises()
            expect(names()[0]).toContain('Mend the fence')
            expect(names()[1]).toContain('Angers the state. Steal a goat from Ann.')
        })

        it('solving a row sends that ad', async () => {
            const calls = boardAndShop({ 'POST /g1/solve/a1': solveOk })
            const { wrapper } = await mountAt('/game/g1/ads')
            const row = wrapper
                .findAll('button')
                .find((b) => accessibleName(b).includes('. Job one. '))
            await row?.trigger('click')
            await flushPromises()
            expect(calls).toContain('POST /g1/solve/a1')
        })

        it('/over hides the top bar but keeps the log', async () => {
            const { wrapper } = await playToGameOver()
            expect(h1s(wrapper)).toEqual(['Game over'])
            expect(wrapper.find('[aria-label="Your dragon"]').exists()).toBe(false)
            expect(wrapper.find('[aria-label="Reputation"]').exists()).toBe(false)
            expect(wrapper.find('nav').exists()).toBe(false)
            expect(logEntries(wrapper)).toHaveLength(1)
        })

        it('/ads for a game the store holds as over redirects to /over', async () => {
            const { pinia, wrapper: before } = await playToGameOver()
            before.unmount()
            const { router, wrapper } = await mountAt('/game/g1/ads', pinia)
            expect(router.currentRoute.value.name).toBe('over')
            expect(h1s(wrapper)).toEqual(['Game over'])
        })

        it('shows the credits line exactly once on every screen', async () => {
            const credits = (w: Wrapper) => w.text().split(copy.credits).length - 1
            const { wrapper: over } = await playToGameOver()
            expect(credits(over)).toBe(1)
            for (const path of ['/', '/game/g1/ads', '/game/g1/shop']) {
                const { wrapper } = await mountAt(path)
                expect(credits(wrapper)).toBe(1)
            }
        })

        it('measures the bars for scroll-padding and clears them on unmount', async () => {
            boardAndShop()
            const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                configurable: true,
                get(this: HTMLElement) {
                    return this.tagName === 'HEADER' ? 160 : 80
                },
            })
            try {
                const { wrapper } = await mountAt('/game/g1/ads')
                const root = document.documentElement.style
                const top = root.getPropertyValue('--top-bar-height')
                const bottom = root.getPropertyValue('--bottom-bar-height')
                expect(top).toMatch(/^[\d.]+rem$/)
                expect(bottom).toMatch(/^[\d.]+rem$/)
                expect(parseFloat(top)).toBe(2 * parseFloat(bottom))
                wrapper.unmount()
                expect(root.getPropertyValue('--top-bar-height')).toBe('')
                expect(root.getPropertyValue('--bottom-bar-height')).toBe('')
            } finally {
                if (original) {
                    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
                }
            }
        })

        describe('focus after a turn (AD-15)', () => {
            it('moves to the panel h1 when the focused Solve button was removed', async () => {
                let messageCalls = 0
                boardAndShop({
                    // After the turn the board no longer holds a1, so its button goes away.
                    'GET /g1/messages': () =>
                        json(messageCalls++ === 0 ? ads : [{ ...ads[0], adId: 'a9' }]),
                    'POST /g1/solve/a1': solveOk,
                })
                const { wrapper } = await mountAttached('/game/g1/ads')
                expect(document.activeElement).toBe(document.body) // not on first load
                const solve = button(wrapper, 'Solve')
                ;(solve.element as HTMLElement).focus()
                expect(document.activeElement).toBe(solve.element)
                await solve.trigger('click')
                await flushPromises()
                expect(document.activeElement?.tagName).toBe('H1')
                expect(document.activeElement?.textContent).toContain('Message board')
            })

            it('keeps focus on a control that is still there and enabled', async () => {
                boardAndShop({ 'POST /g1/solve/a1': solveOk })
                const { wrapper } = await mountAttached('/game/g1/ads')
                const solve = button(wrapper, 'Solve')
                ;(solve.element as HTMLElement).focus()
                await solve.trigger('click')
                await flushPromises()
                expect(logEntries(wrapper)).toHaveLength(1)
                expect(document.activeElement).toBe(solve.element)
            })

            it('moves to the Shop h1 when a buy dropped focus', async () => {
                let release: (r: Response) => void = () => undefined
                boardAndShop({
                    'POST /g1/shop/buy/hpot': () =>
                        new Promise<Response>((resolve) => (release = resolve)),
                })
                const { wrapper } = await mountAttached('/game/g1/shop')
                const buy = button(wrapper, 'Healing potion')
                // A browser may drop focus from a button once it is disabled; jsdom cannot
                // blur a disabled element, so drop it just before the click instead.
                ;(buy.element as HTMLElement).focus()
                ;(buy.element as HTMLElement).blur()
                await buy.trigger('click')
                await flushPromises()
                release(json({ shoppingSuccess: true, gold: 0, lives: 4, level: 0, turn: 1 }))
                await flushPromises()
                expect(document.activeElement?.tagName).toBe('H1')
                expect(document.activeElement?.textContent).toContain('Shop')
            })

            it('does not move focus when the game is switched mid-turn', async () => {
                let release: (r: Response) => void = () => undefined
                boardAndShop({
                    'POST /g1/solve/a1': () =>
                        new Promise<Response>((resolve) => (release = resolve)),
                    'GET /g2/messages': () => json(ads),
                    'GET /g2/shop': () => json(items),
                })
                const pinia = createPinia()
                await mountAttached('/game/g1/ads', pinia)
                setActivePinia(pinia)
                const game = useGameStore()
                const turn = game.solve('a1')
                await flushPromises()
                const switching = game.load('g2')
                release(solveOk())
                await Promise.all([turn, switching])
                await flushPromises()
                expect(game.gameId).toBe('g2')
                expect(document.activeElement).toBe(document.body)
            })
        })
    })
})
