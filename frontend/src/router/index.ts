import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import StartView from '@/views/StartView.vue'
import GameView from '@/views/GameView.vue'
import GameOverView from '@/views/GameOverView.vue'

// AD-10. The ads and shop panels are both rendered by GameView (side by side on wide
// screens), so their child records carry no component; the record only selects the panel.
export const routes: RouteRecordRaw[] = [
    { path: '/', name: 'start', component: StartView },
    {
        path: '/game/:gameId',
        component: GameView,
        children: [
            { path: '', redirect: { name: 'ads' } },
            { path: 'ads', name: 'ads', children: [] },
            { path: 'shop', name: 'shop', children: [] },
            { path: 'over', name: 'over', component: GameOverView },
        ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'start' } },
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

export default router
