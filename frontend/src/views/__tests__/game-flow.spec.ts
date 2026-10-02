import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ads, html404, items, json, startBody, stubApi } from '@/__tests__/stub-api'
import App from '@/App.vue'
import { routes } from '@/router'

async function mountAt(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
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
        const solve = wrapper.findAll('button').find((b) => b.text().startsWith('Solve'))
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
})
