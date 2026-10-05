import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import StartView from '@/views/StartView.vue'
import GameView from '@/views/GameView.vue'
import AdsPanel from '@/views/AdsPanel.vue'
import ShopPanel from '@/views/ShopPanel.vue'
import GameOverView from '@/views/GameOverView.vue'

declare module 'vue-router' {
    interface RouteMeta {
        /** The game screen renders its own credits line, so App skips the footer (AD-14). */
        gameScreen?: boolean
    }
}

// AD-10. Each child is rendered alone through GameView's <RouterView>, at every width.
// Route components are imported eagerly (AD-15).
export const routes: RouteRecordRaw[] = [
    { path: '/', name: 'start', component: StartView },
    {
        path: '/game/:gameId',
        component: GameView,
        meta: { gameScreen: true },
        children: [
            { path: '', redirect: { name: 'ads' } },
            { path: 'ads', name: 'ads', component: AdsPanel },
            { path: 'shop', name: 'shop', component: ShopPanel },
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
