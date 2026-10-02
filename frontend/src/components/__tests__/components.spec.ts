import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdCard from '../AdCard.vue'
import BoardNotice from '../BoardNotice.vue'
import LastTurn from '../LastTurn.vue'
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

describe('AdCard', () => {
    it('shows message, reward, expiry, probability as text and emits solve', async () => {
        const wrapper = mount(AdCard, { props: { ad, disabled: false } })
        expect(wrapper.text()).toContain('Job one')
        expect(wrapper.text()).toContain('Risky')
        await wrapper.get('button').trigger('click')
        expect(wrapper.emitted('solve')).toEqual([['a1']])
    })

    it('disables solve when unsolvable or disabled', () => {
        const bad = mount(AdCard, { props: { ad: { ...ad, solvable: false }, disabled: false } })
        expect(bad.get('button').attributes('disabled')).toBeDefined()
        expect(bad.get('button').attributes('aria-describedby')).toBeTruthy()
        const off = mount(AdCard, { props: { ad, disabled: true } })
        expect(off.get('button').attributes('disabled')).toBeDefined()
    })
})

describe('ShopItem', () => {
    const item = { id: 'cs', name: 'Claw Sharpening', cost: 100 }

    it('disables buy and states the shortfall when gold is known and too low', () => {
        const wrapper = mount(ShopItem, { props: { item, gold: 40, disabled: false } })
        expect(wrapper.get('button').attributes('disabled')).toBeDefined()
        expect(wrapper.text()).toContain('You need 60 more gold.')
        expect(wrapper.text()).toContain('level by 1')
    })

    it('enables buy when gold is enough or unknown', async () => {
        for (const gold of [100, null]) {
            const wrapper = mount(ShopItem, { props: { item, gold, disabled: false } })
            expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
            await wrapper.get('button').trigger('click')
            expect(wrapper.emitted('buy')).toEqual([['cs']])
        }
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
})

describe('LastTurn', () => {
    it('shows the summary with signed deltas', () => {
        const wrapper = mount(LastTurn, {
            props: {
                lastTurn: {
                    kind: 'solve',
                    adMessage: 'Job one',
                    success: false,
                    message: 'You failed',
                    deltas: { lives: -1, gold: 251 },
                },
            },
        })
        expect(wrapper.text()).toContain('Job one')
        expect(wrapper.text()).toContain('You failed')
        expect(wrapper.text()).toContain('−1 lives')
        expect(wrapper.text()).toContain('+251 gold')
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

describe('ReputationPanel', () => {
    it('renders rows, emits investigate, and disables when asked', async () => {
        const reputation = { people: 4.9, state: -4, underworld: 0 }
        const wrapper = mount(ReputationPanel, { props: { disabled: false, reputation } })
        expect(wrapper.text()).toContain('People')
        expect(wrapper.text()).toContain('4.9')
        expect(wrapper.text()).toContain('-4')
        await wrapper.get('button').trigger('click')
        expect(wrapper.emitted('investigate')).toHaveLength(1)
        const off = mount(ReputationPanel, { props: { disabled: true, reputation: null } })
        expect(off.get('button').attributes('disabled')).toBeDefined()
        expect(off.text()).toContain('You have not asked around yet.')
    })
})

describe('LastTurn branches', () => {
    it('shows nothing-yet when there is no last turn', () => {
        expect(mount(LastTurn, { props: { lastTurn: null } }).text()).toContain(
            'Nothing has happened yet.',
        )
    })

    it('shows buy success and failure', () => {
        const buy = (success: boolean) =>
            mount(LastTurn, {
                props: {
                    lastTurn: {
                        deltas: { gold: -50 },
                        itemName: 'Healing potion',
                        kind: 'buy',
                        success,
                    },
                },
            })
        expect(buy(true).text()).toContain('The purchase went through.')
        expect(buy(false).text()).toContain('The purchase failed.')
        expect(buy(true).text()).toContain('−50 gold')
    })

    it('shows a reputation turn and the no-changes text', () => {
        const wrapper = mount(LastTurn, {
            props: {
                lastTurn: {
                    deltas: {},
                    kind: 'reputation',
                    reputation: { people: 0, state: 0, underworld: 0 },
                },
            },
        })
        expect(wrapper.text()).toContain('You asked around about your reputation.')
        expect(wrapper.text()).toContain('No changes to show.')
    })
})
