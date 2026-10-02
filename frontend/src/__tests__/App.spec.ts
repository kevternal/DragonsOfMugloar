import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ads, items, json, stubApi } from './stub-api'
import App from '../App.vue'
import router, { routes } from '../router'

describe('App', () => {
    it('shows the start screen at /', async () => {
        await router.push('/')
        await router.isReady()
        const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
        await flushPromises()
        expect(wrapper.get('h1').text()).toBe('Dragons of Mugloar')
        expect(wrapper.get('button').text()).toBe('Start game')
    })

    it('moves focus to the h1 after navigation, but not on the first load', async () => {
        stubApi({ 'GET /g1/messages': () => json(ads), 'GET /g1/shop': () => json(items) })
        const fresh = createRouter({ history: createMemoryHistory(), routes })
        await fresh.push('/')
        const wrapper = mount(App, {
            attachTo: document.body,
            global: { plugins: [createPinia(), fresh] },
        })
        await flushPromises()
        expect(document.activeElement).toBe(document.body)
        await fresh.push('/game/g1/ads')
        await flushPromises()
        expect(document.activeElement?.tagName).toBe('H1')
        expect(document.activeElement?.textContent).toContain('Message board')
        wrapper.unmount()
    })
})
