import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { items, json, stubApi, startBody } from '@/__tests__/stub-api'
import { useGameStore } from '@/stores/game'
import ShopPanel from '../ShopPanel.vue'

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
})
