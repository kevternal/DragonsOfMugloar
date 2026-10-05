import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { liveItem } from '@/__tests__/stub-api'
import type { RankedJob, TurnRecord } from '@/game/types'
import ActivityLog from '../ActivityLog.vue'
import BoardNotice from '../BoardNotice.vue'
import GameIcon from '../GameIcon.vue'
import JobRow from '../JobRow.vue'
import ReputationPanel from '../ReputationPanel.vue'
import ShopItem from '../ShopItem.vue'
import StatsBar from '../StatsBar.vue'

const ad = {
    adId: 'a1',
    message: 'Job one',
    reward: 10,
    expiresIn: 2,
    probability: 'Risky',
    solvable: true,
}
const job = (fields: Partial<RankedJob> = {}): RankedJob => ({
    ad,
    tier: 'risky',
    winPct: 41,
    value: 0,
    flag: null,
    best: false,
    ...fields,
})

/** Text a sighted user sees: drops visually hidden text (aria-hidden marks stay). */
function visible(el: Element): string {
    const copyEl = el.cloneNode(true) as Element
    copyEl.querySelectorAll('.visually-hidden').forEach((n) => n.remove())
    return (copyEl.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The visible pieces of the odds line: label, win %, then each badge. */
function oddsParts(el: Element): string[] {
    return [...el.querySelectorAll('.odds > :not(.visually-hidden)')].map((n) => visible(n))
}

/** The only button (role) in a row; its name is computed from its content. */
function rowButton(wrapper: ReturnType<typeof mount>) {
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)
    return buttons[0]!
}

describe('JobRow', () => {
    it('is one button whose content names the odds and gold first, then the job and turns', async () => {
        const wrapper = mount(JobRow, { props: { job: job(), disabled: false } })
        const button = rowButton(wrapper)
        expect(button.attributes('aria-label')).toBeUndefined()
        expect(spoken(button.element)).toBe(
            'Solve: risky, Risky, 41%, 10 gold. Job one. 2 turns left',
        )
        await button.trigger('click')
        expect(wrapper.emitted('solve')).toEqual([['a1']])
    })

    it('shows the label, win %, reward and expiry as visible text', () => {
        const wrapper = mount(JobRow, { props: { job: job(), disabled: false } })
        const button = rowButton(wrapper)
        expect(oddsParts(button.element)).toEqual(['Risky', '41%', '10'])
        expect(visible(button.get('.reward').element)).toBe('10')
        expect(visible(button.get('.expiry').element)).toBe('2')
        expect(button.find('.reward [aria-hidden="true"]').exists()).toBe(true)
        expect(button.find('.expiry [aria-hidden="true"]').exists()).toBe(true)
    })

    it.each([
        { tier: 'safe', icon: 'cake-slice' },
        { tier: 'moderate', icon: 'footprint' },
        { tier: 'risky', icon: 'rolling-dices' },
        { tier: 'deadly', icon: 'death-skull' },
    ] as const)('shows the $icon icon for a $tier job', ({ tier, icon }) => {
        const wrapper = mount(JobRow, { props: { job: job({ tier }), disabled: false } })
        const riskIcon = wrapper.get('.risk').findComponent(GameIcon)
        expect(riskIcon.props('name')).toBe(icon)
        expect(spoken(rowButton(wrapper).element)).toContain(`Solve: ${tier}, `)
    })

    it('shows and names each badge with the odds', () => {
        const best = mount(JobRow, { props: { job: job({ best: true }), disabled: false } })
        expect(spoken(rowButton(best).element)).toContain('41%, 10 gold, Best pick. Job one.')
        expect(oddsParts(best.element)).toEqual(['Risky', '41%', '10', 'Best pick'])

        const trap = mount(JobRow, { props: { job: job({ flag: 'trap' }), disabled: false } })
        expect(spoken(rowButton(trap).element)).toContain('41%, 10 gold, Trap. Job one.')
        expect(oddsParts(trap.element)).toEqual(['Risky', '41%', '10', 'Trap'])

        const state = mount(JobRow, {
            props: { job: job({ flag: 'state-risk' }), disabled: false },
        })
        expect(spoken(rowButton(state).element)).toContain(
            '41%, 10 gold, Angers the state. Job one.',
        )
        expect(oddsParts(state.element)).toEqual(['Risky', '41%', '10', 'Angers the state'])

        const both = mount(JobRow, {
            props: { job: job({ best: true, flag: 'state-risk' }), disabled: false },
        })
        expect(spoken(rowButton(both).element)).toContain(
            '41%, 10 gold, Best pick, Angers the state.',
        )
    })

    it('says unknown odds and shows a "?" mark for an unknown label; one turn left', () => {
        const wrapper = mount(JobRow, {
            props: {
                job: job({
                    ad: { ...ad, probability: 'Maybe?', expiresIn: 1 },
                    tier: 'unknown',
                    winPct: null,
                    value: null,
                }),
                disabled: false,
            },
        })
        const button = rowButton(wrapper)
        expect(spoken(button.element)).toBe(
            'Solve: unknown risk, Maybe?, unknown odds, 10 gold. Job one. 1 turn left',
        )
        expect(visible(button.get('.risk').element)).toBe('?')
        expect(button.find('.risk .game-icon').exists()).toBe(false)
    })

    it('disables an unsolvable job and describes why; disables when asked', () => {
        const locked = mount(JobRow, {
            props: {
                job: job({ ad: { ...ad, solvable: false }, tier: 'unknown', winPct: null }),
                disabled: false,
            },
        })
        const button = rowButton(locked)
        expect(button.attributes('disabled')).toBeDefined()
        const note = locked.get(`#${button.attributes('aria-describedby')}`)
        expect(note.text()).toContain('cannot be solved')

        const off = mount(JobRow, { props: { job: job(), disabled: true } })
        expect(rowButton(off).attributes('disabled')).toBeDefined()
        expect(rowButton(off).attributes('aria-describedby')).toBeUndefined()
    })
})

describe('GameIcon', () => {
    it('is decorative and draws its shape as a mask, never as markup', () => {
        const wrapper = mount(GameIcon, { props: { name: 'trophy' } })
        const span = wrapper.get('span')
        expect(span.attributes('aria-hidden')).toBe('true')
        expect(span.element.innerHTML).toBe('')
        expect(span.attributes('style')).toMatch(/mask-image: url\("[^"]+"\)/)
    })

    it('ships every icon without the black background square, filled white', () => {
        // Vitest runs from the frontend root (vitest.config.ts `root`).
        const dir = join(process.cwd(), 'src/assets/icons')
        const files = readdirSync(dir).filter((f) => f.endsWith('.svg'))
        // Every registered icon has a file, and every file is registered.
        const source = readFileSync(join(process.cwd(), 'src/components/GameIcon.vue'), 'utf8')
        const registered = [...source.matchAll(/@\/assets\/icons\/([\w-]+\.svg)/g)].map((m) => m[1])
        expect(registered.length).toBeGreaterThan(0)
        expect([...registered].sort()).toEqual([...files].sort())
        const sources = files.map((file) => readFileSync(join(dir, file), 'utf8'))
        expect(files.filter((_, i) => sources[i]!.includes('M0 0h512v512H0z'))).toEqual([])
        expect(files.filter((_, i) => !sources[i]!.includes('fill="#fff"'))).toEqual([])
    })
})

describe('ShopItem', () => {
    const item = liveItem('cs')
    const rocket = liveItem('rf')
    const potion = liveItem('hpot')
    const BUY = ', buy (costs one turn)'
    type Props = InstanceType<typeof ShopItem>['$props']
    const mountItem = (props: Partial<Props> & Pick<Props, 'item'>) =>
        mount(ShopItem, { props: { gold: 1000, disabled: false, ...props } })
    const name = (wrapper: ReturnType<typeof mount>) => spoken(rowButton(wrapper).element)
    const status = (wrapper: ReturnType<typeof mount>) => wrapper.get('.status').text()

    it('is one button named by its content: item name first, then effect, cost, badge, owned', () => {
        const wrapper = mountItem({ item: rocket, reason: 'level-up', owned: 2 })
        expect(name(wrapper)).toBe(`Rocket Fuel, +2 levels, 300 gold, Buy next, owned 2${BUY}`)
        expect(rowButton(wrapper).attributes('aria-label')).toBeUndefined()
        expect(visible(rowButton(wrapper).element)).toBe(
            'Rocket Fuel+2 levels300BuyBuy nextOwned ×2',
        )
    })

    it('shows its item icon (decorative) and a coin before the cost', () => {
        const wrapper = mountItem({ item: rocket })
        const icons = wrapper.findAllComponents(GameIcon).map((icon) => icon.props('name'))
        expect(icons).toEqual(['rocket', 'two-coins'])
    })

    it.each([
        ['hpot', 'health-potion'],
        ['cs', 'claw-slashes'],
        ['gas', 'jerrycan'],
        ['wax', 'metal-plate'],
        ['tricks', 'secret-book'],
        ['wingpot', 'standing-potion'],
        ['ch', 'crossed-claws'],
        ['rf', 'rocket'],
        ['iron', 'breastplate'],
        ['mtrix', 'spell-book'],
        ['wingpotmax', 'fairy-wings'],
    ])('item %s uses the approved icon %s', (id, icon) => {
        const wrapper = mountItem({ item: liveItem(id) })
        expect(wrapper.findAllComponents(GameIcon)[0]?.props('name')).toBe(icon)
    })

    it.each([
        { reason: 'low-lives', item: potion, badge: 'Low on lives' },
        { reason: 'level-up', item: rocket, badge: 'Buy next' },
        { reason: null, item, badge: 'Not worth it' },
    ] as const)('reason $reason on $item.id gives the badge $badge', ({ reason, item, badge }) => {
        const wrapper = mountItem({ item, reason })
        expect(wrapper.findAll('.badge').map((b) => b.text())).toEqual([badge])
        expect(name(wrapper)).toContain(` gold, ${badge}${BUY}`)
    })

    it('has no badge for an unrecommended +2 item or potion, and hides an owned count of 0', () => {
        for (const [unrecommended, expected] of [
            [rocket, `Rocket Fuel, +2 levels, 300 gold${BUY}`],
            [potion, `Healing potion, +1 life, 50 gold${BUY}`],
        ] as const) {
            const wrapper = mountItem({ item: unrecommended, owned: 0 })
            expect(wrapper.find('.badge').exists()).toBe(false)
            expect(wrapper.text()).not.toContain('Owned')
            expect(name(wrapper)).toBe(expected)
        }
    })

    it('says "+1 life" for the potion and "+1 level" for a +1 item', () => {
        expect(name(mountItem({ item: potion }))).toBe(`Healing potion, +1 life, 50 gold${BUY}`)
        expect(name(mountItem({ item }))).toBe(
            `Claw Sharpening, +1 level, 100 gold, Not worth it${BUY}`,
        )
    })

    it('disables buy and links the shortfall when gold is known and too low', () => {
        const wrapper = mountItem({ item, gold: 40 })
        const button = rowButton(wrapper)
        expect(button.attributes('disabled')).toBeDefined()
        const note = wrapper.get(`#${button.attributes('aria-describedby')}`)
        expect(note.text()).toBe('You need 60 more gold.')
    })

    it('enables buy when gold is enough or unknown, with no shortfall', async () => {
        for (const gold of [100, null]) {
            const wrapper = mountItem({ item, gold })
            const button = rowButton(wrapper)
            expect(button.attributes('disabled')).toBeUndefined()
            expect(button.attributes('aria-describedby')).toBeUndefined()
            expect(wrapper.text()).not.toContain('more gold')
            await button.trigger('click')
            expect(wrapper.emitted('buy')).toEqual([['cs']])
        }
    })

    it('disables when asked', () => {
        expect(rowButton(mountItem({ item, disabled: true })).attributes('disabled')).toBeDefined()
    })

    it('has no live region: the activity log announces the buy (AD-15)', () => {
        const wrapper = mountItem({
            item: rocket,
            result: { success: true, deltas: { level: 2, gold: -300 } },
        })
        expect(wrapper.find('[role="status"], [aria-live]').exists()).toBe(false)
        expect(status(wrapper)).toBe('+2 levels')
    })

    it('a successful buy states the stat it raised, from the deltas', async () => {
        const wrapper = mountItem({
            item: rocket,
            result: { success: true, deltas: { level: 3, gold: -300 } },
        })
        expect(status(wrapper)).toBe('+3 levels')
        await wrapper.setProps({
            item: potion,
            result: { success: true, deltas: { lives: 1, gold: -50 } },
        })
        expect(status(wrapper)).toBe('+1 life')
    })

    it('with unknown stats (no delta), a successful buy states the item effect', () => {
        const wrapper = mountItem({ item: rocket, result: { success: true, deltas: {} } })
        expect(status(wrapper)).toBe('+2 levels')
    })

    it('a level delta of 0 never shows the item effect', () => {
        const wrapper = mountItem({
            item: rocket,
            result: { success: true, deltas: { level: 0, gold: -300 } },
        })
        expect(status(wrapper)).toBe('Bought, though your dragon looks much the same.')
    })

    it('a failed buy says so in tavern voice', () => {
        const wrapper = mountItem({ item: rocket, result: { success: false, deltas: {} } })
        expect(status(wrapper)).toBe('The shopkeeper fumbled the sale. Nothing was bought.')
        expect(wrapper.get('.status').classes()).toContain('failed')
    })

    it('shows no status without a result', () => {
        expect(status(mountItem({ item: rocket }))).toBe('')
    })
})

describe('StatsBar', () => {
    it('renders null stats as unknown', () => {
        const wrapper = mount(StatsBar, {
            props: { stats: { lives: 3, gold: null, level: null, score: null, turn: null } },
        })
        expect(wrapper.text()).toContain('3')
        expect(wrapper.text()).toContain('unknown')
    })

    it('puts a decorative icon before each value and keeps the text labels', () => {
        const wrapper = mount(StatsBar, {
            props: { stats: { lives: 3, gold: 9, level: 1, score: 2, turn: 4 } },
        })
        expect(wrapper.findAll('dt').map((dt) => dt.text())).toEqual([
            'Lives',
            'Gold',
            'Level',
            'Score',
            'Turn',
        ])
        for (const dd of wrapper.findAll('dd')) {
            expect(dd.element.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
        }
    })

    it('emphasises only the stat a buy changed', async () => {
        const stats = { lives: 3, gold: 9, level: 2, score: 2, turn: 4 }
        const wrapper = mount(StatsBar, { props: { stats, changed: 'level' } })
        const changed = () => wrapper.findAll('.changed').map((el) => el.get('dt').text())
        expect(changed()).toEqual(['Level'])
        await wrapper.setProps({ changed: null })
        expect(changed()).toEqual([])
    })
})

describe('BoardNotice', () => {
    it('offers a plainly labelled retry button', async () => {
        const wrapper = mount(BoardNotice, { props: { refreshing: false } })
        const button = wrapper.get('button')
        expect(button.text()).toBe('Check the board again')
        await button.trigger('click')
        expect(wrapper.emitted('retry')).toHaveLength(1)
    })
})

/** Text a screen reader would read: drops aria-hidden subtrees. */
function spoken(el: Element): string {
    const copyEl = el.cloneNode(true) as Element
    copyEl.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (copyEl.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('ReputationPanel', () => {
    it('is named by aria-label, renders values including 0, and emits investigate', async () => {
        const reputation = { people: 4.9, state: -4, underworld: 0 }
        const wrapper = mount(ReputationPanel, { props: { disabled: false, reputation } })
        const panel = wrapper.get('[aria-label="Reputation"]')
        expect(panel.find('h2').exists()).toBe(false)
        expect(wrapper.findAll('dd').map((dd) => spoken(dd.element))).toEqual(['4.9', '-4', '0'])
        await wrapper.get('button').trigger('click')
        expect(wrapper.emitted('investigate')).toHaveLength(1)
    })

    it('shows each value as unknown until investigated, and disables when asked', () => {
        const off = mount(ReputationPanel, { props: { disabled: true, reputation: null } })
        expect(off.get('button').attributes('disabled')).toBeDefined()
        expect(off.findAll('dd').map((dd) => spoken(dd.element))).toEqual([
            'unknown',
            'unknown',
            'unknown',
        ])
    })
})

describe('ActivityLog', () => {
    const solve = (seq: number, success: boolean, message: string): TurnRecord => ({
        seq,
        turn: seq + 8,
        kind: 'solve',
        adMessage: `Job ${seq}`,
        success,
        message,
        deltas: { gold: success ? 82 : 0, lives: success ? 0 : -2, score: 5, turn: 1 },
    })
    const region = (w: ReturnType<typeof mount>) => w.get('[role="log"]')
    const entries = (w: ReturnType<typeof mount>) => region(w).findAll('li')

    it('is a polite log region labelled Activity, with the empty state outside it', () => {
        const wrapper = mount(ActivityLog, { props: { log: [] } })
        const log = region(wrapper)
        expect(log.element.tagName).toBe('SECTION')
        expect(log.attributes('aria-live')).toBe('polite')
        expect(wrapper.get(`#${log.attributes('aria-labelledby')}`).text()).toBe('Activity')
        expect(log.find('ol').exists()).toBe(true)
        expect(wrapper.text()).toContain('Nothing has happened yet.')
        expect(log.text()).not.toContain('Nothing has happened yet.')
    })

    it('speaks turn, outcome, action and only gold and lives changes, with separators', () => {
        const wrapper = mount(ActivityLog, {
            props: { log: [solve(1, true, 'Won'), solve(2, false, 'Lost')] },
        })
        const [first, second] = entries(wrapper)
        expect(first?.get('p').text()).toContain('T9')
        expect(first?.get('p').text()).toContain('✓')
        expect(spoken(first!.get('p').element)).toBe('Turn 9, succeeded: Job 1, +82 gold')
        expect(second?.get('p').text()).toContain('✗')
        expect(spoken(second!.get('p').element)).toBe('Turn 10, failed: Job 2, −2 lives')
    })

    it('says "life" for a single life', () => {
        const entry: TurnRecord = { ...solve(1, false, 'Ouch'), deltas: { lives: -1 } }
        const wrapper = mount(ActivityLog, { props: { log: [entry] } })
        expect(spoken(entries(wrapper)[0]!.get('p').element)).toContain('−1 life')
        expect(spoken(entries(wrapper)[0]!.get('p').element)).not.toContain('lives')
    })

    it('shows the flavour line on the newest entry only', async () => {
        const wrapper = mount(ActivityLog, { props: { log: [solve(1, true, 'Won')] } })
        expect(entries(wrapper)[0]?.findAll('p')).toHaveLength(2)
        expect(entries(wrapper)[0]?.text()).toContain('Won')
        await wrapper.setProps({ log: [solve(1, true, 'Won'), solve(2, false, 'Lost')] })
        expect(entries(wrapper)[0]?.findAll('p')).toHaveLength(1)
        expect(region(wrapper).text()).not.toContain('Won')
        expect(entries(wrapper)[1]?.findAll('p')[1]?.text()).toBe('Lost')
    })

    it('a buy shows the item and changes with no flavour line', () => {
        const buy: TurnRecord = {
            seq: 1,
            turn: 3,
            kind: 'buy',
            itemId: 'hpot',
            itemName: 'Healing potion',
            success: true,
            deltas: { gold: -50, lives: 1, turn: 1 },
        }
        const wrapper = mount(ActivityLog, { props: { log: [buy] } })
        const [entry] = entries(wrapper)
        expect(spoken(entry!.element)).toBe(
            'Turn 3, succeeded: Bought Healing potion, −50 gold, +1 life',
        )
        expect(entry?.findAll('p')).toHaveLength(1)
    })

    it('a buy also speaks its level change, first', () => {
        const buy: TurnRecord = {
            seq: 1,
            turn: 3,
            kind: 'buy',
            itemId: 'rf',
            itemName: 'Rocket Fuel',
            success: true,
            deltas: { level: 2, gold: -300, turn: 1 },
        }
        const wrapper = mount(ActivityLog, { props: { log: [buy] } })
        expect(spoken(entries(wrapper)[0]!.element)).toBe(
            'Turn 3, succeeded: Bought Rocket Fuel, +2 levels, −300 gold',
        )
    })

    it('a reputation entry lists the new values and has no success mark', () => {
        const rep: TurnRecord = {
            seq: 1,
            turn: null,
            kind: 'reputation',
            reputation: { people: 5, state: -2, underworld: 0 },
            deltas: { turn: 1 },
        }
        const wrapper = mount(ActivityLog, { props: { log: [rep] } })
        expect(spoken(entries(wrapper)[0]!.element)).toBe(
            'Turn unknown, Asked around: people 5, state −2, underworld 0',
        )
        expect(region(wrapper).text()).not.toMatch(/succeeded|failed|✓|✗/)
    })

    describe('scrolling (AD-15)', () => {
        const rowHeight = 40
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')

        beforeEach(() => {
            // jsdom has no layout: give each <li> a top that depends on its position.
            Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
                configurable: true,
                get(this: HTMLElement) {
                    if (this.tagName !== 'LI' || !this.parentElement) {
                        return 0
                    }
                    return [...this.parentElement.children].indexOf(this) * rowHeight
                },
            })
        })
        afterEach(() => {
            if (original) {
                Object.defineProperty(HTMLElement.prototype, 'offsetTop', original)
            }
        })

        it('on mount, aligns the newest entry with the top of the region', () => {
            const log = [solve(1, true, 'a'), solve(2, true, 'b'), solve(3, true, 'c')]
            const wrapper = mount(ActivityLog, { props: { log } })
            expect(region(wrapper).element.scrollTop).toBe(2 * rowHeight)
        })

        it('re-pins the collapsed log to the newest entry when it resizes', () => {
            const callbacks: ResizeObserverCallback[] = []
            vi.stubGlobal(
                'ResizeObserver',
                class {
                    constructor(callback: ResizeObserverCallback) {
                        callbacks.push(callback)
                    }
                    observe(): void {}
                    unobserve(): void {}
                    disconnect(): void {}
                },
            )
            const log = [solve(1, true, 'a'), solve(2, true, 'b')]
            const wrapper = mount(ActivityLog, { props: { log } })
            const el = region(wrapper).element
            el.scrollTop = 0 // e.g. a scroll set while the region was taller
            callbacks.forEach((cb) => cb([], {} as ResizeObserver))
            expect(el.scrollTop).toBe(rowHeight)
        })

        it('on a new entry, jumps to that entry instantly', async () => {
            const wrapper = mount(ActivityLog, { props: { log: [solve(1, true, 'a')] } })
            const el = region(wrapper).element
            el.scrollTop = 0
            await wrapper.setProps({
                log: [solve(1, true, 'a'), solve(2, true, 'b'), solve(3, true, 'c')],
            })
            expect(el.scrollTop).toBe(2 * rowHeight)
        })
    })
})
