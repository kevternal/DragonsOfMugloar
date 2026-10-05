<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import ActivityLog from '@/components/ActivityLog.vue'
import ReputationPanel from '@/components/ReputationPanel.vue'
import StatsBar from '@/components/StatsBar.vue'
import { copy, errorMessage } from '@/copy'
import { raisedStat } from '@/game/shop'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const route = useRoute()
const router = useRouter()

const gameId = computed(() => String(route.params.gameId))
const isOver = computed(() => route.name === 'over')

// CAP-4: the stat the latest buy raised, emphasised until the next action starts.
const changed = computed(() => (game.lastBuy?.success ? raisedStat(game.lastBuy.deltas) : null))

// AD-10: load once per game id. Panel switches never reload. A fresh /over URL is
// handled by GameOverView (it redirects), so it spends no requests.
watch(
    gameId,
    (id) => {
        if (route.name !== 'over') {
            void game.load(id)
        }
    },
    { immediate: true },
)

// AD-9: stores never navigate; this view does.
watch(
    () => game.status,
    (status) => {
        if (status === 'over' && route.name !== 'over') {
            void router.replace({ name: 'over', params: { gameId: gameId.value } })
        } else if (status === 'expired') {
            void router.replace({ name: 'start' })
        }
    },
    { immediate: true },
)

// AD-15: after a turn, if the focused control was disabled or removed (focus fell back
// to <body>), move focus to the active panel's <h1>. Loading a game is not a turn, and a
// turn that ends the game leaves focus to the /over route change.
const view = useTemplateRef<HTMLElement>('view')
let turnInFlight = false

watch(
    () => game.pending,
    (pending) => {
        if (pending) {
            turnInFlight = game.status === 'playing'
            return
        }
        const wasTurn = turnInFlight
        turnInFlight = false
        if (!wasTurn || game.status !== 'playing') {
            return
        }
        const active = document.activeElement
        if (active === null || active === document.body) {
            view.value?.querySelector<HTMLElement>('h1')?.focus()
        }
    },
    { flush: 'post' },
)

// A game switch (load resets and begins loading in one tick) is never a turn.
watch(
    () => game.gameId,
    () => {
        turnInFlight = false
    },
)

// AD-14: keep focused controls clear of the sticky bars on narrow screens
// (WCAG 2.2 SC 2.4.11, C43). base.css reads these as html's scroll-padding-block.
const topBar = useTemplateRef<HTMLElement>('topBar')
const bottomBar = useTemplateRef<HTMLElement>('bottomBar')

/** Bar heights in rem (AD-14), measured because the bars wrap with their content. */
function measureBars(): void {
    const root = document.documentElement
    const remPx = parseFloat(getComputedStyle(root).fontSize) || 10
    const top = topBar.value?.offsetHeight ?? 0
    const bottom = bottomBar.value?.offsetHeight ?? 0
    root.style.setProperty('--top-bar-height', `${top / remPx}rem`)
    root.style.setProperty('--bottom-bar-height', `${bottom / remPx}rem`)
}

const observer = new ResizeObserver(measureBars)

// The top bar comes and goes with /over, so observe whichever bars are rendered.
watch(
    [topBar, bottomBar],
    (bars, oldBars) => {
        for (const el of oldBars) {
            if (el) {
                observer.unobserve(el)
            }
        }
        for (const el of bars) {
            if (el) {
                observer.observe(el)
            }
        }
        measureBars()
    },
    { flush: 'post' },
)

onBeforeUnmount(() => {
    observer.disconnect()
    document.documentElement.style.removeProperty('--top-bar-height')
    document.documentElement.style.removeProperty('--bottom-bar-height')
})
</script>

<template>
    <main class="game">
        <header v-if="!isOver" ref="topBar" class="game-top">
            <StatsBar :stats="game.stats" :changed="changed" />
            <ReputationPanel
                :reputation="game.reputation"
                :disabled="game.pending || game.status !== 'playing'"
                @investigate="game.investigateReputation()"
            />
            <nav class="game-nav" :aria-label="copy.nav.label">
                <RouterLink :to="{ name: 'ads', params: { gameId } }">
                    <span>{{ copy.nav.ads }}</span>
                </RouterLink>
                <!-- CAP-17: the Shop link's one hint, in text. Each part on its own line, so
                     no stray spaces reach the name ("Shop, Level up"). -->
                <RouterLink :to="{ name: 'shop', params: { gameId } }">
                    <span>{{ copy.nav.shop }}</span>
                    <template v-if="game.shopHint">
                        <span class="visually-hidden">{{ copy.separator }}</span>
                        <span class="nav-hint">{{ copy.nav.hint[game.shopHint] }}</span>
                    </template>
                </RouterLink>
            </nav>
            <p v-if="game.status === 'loading'" role="status">{{ copy.loading }}</p>
            <p v-if="game.error" role="alert" class="error">{{ errorMessage(game.error) }}</p>
        </header>
        <div ref="view" class="game-view">
            <RouterView />
        </div>
        <div ref="bottomBar" class="game-bottom">
            <ActivityLog :log="game.log" />
            <p class="credits">{{ copy.credits }}</p>
        </div>
    </main>
</template>

<style scoped>
.nav-hint {
    margin-inline-start: var(--space-1);
    padding: 0 var(--space-1);
    /* Keeps the hint outlined in forced colors, where backgrounds are dropped. */
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: var(--color-badge-best-bg);
    color: var(--color-badge-best-text);
    font-size: var(--font-size-xs);
    font-weight: 700;
}

.error {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-error-bg);
    color: var(--color-error-text);
}
</style>
