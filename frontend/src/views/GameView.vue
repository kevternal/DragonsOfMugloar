<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import LastTurn from '@/components/LastTurn.vue'
import ReputationPanel from '@/components/ReputationPanel.vue'
import StatsBar from '@/components/StatsBar.vue'
import { copy, errorMessage } from '@/copy'
import { useGameStore } from '@/stores/game'
import AdsPanel from './AdsPanel.vue'
import ShopPanel from './ShopPanel.vue'

const game = useGameStore()
const route = useRoute()
const router = useRouter()

const gameId = computed(() => String(route.params.gameId))
const isOver = computed(() => route.name === 'over')

// AD-10: load once per game id. Panel switches never reload. A fresh /over URL is
// handled by GameOverView (it redirects), so it spends no requests.
watch(
    gameId,
    (id) => {
        if (route.name !== 'over') void game.load(id)
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
</script>

<template>
    <main class="game">
        <template v-if="!isOver">
            <StatsBar :stats="game.stats" />
            <nav class="game-nav" :aria-label="copy.nav.label">
                <RouterLink :to="{ name: 'ads', params: { gameId } }">{{
                    copy.nav.ads
                }}</RouterLink>
                <RouterLink :to="{ name: 'shop', params: { gameId } }">{{
                    copy.nav.shop
                }}</RouterLink>
            </nav>
            <p v-if="game.status === 'loading'" role="status">{{ copy.loading }}</p>
            <p v-if="game.error" role="alert" class="error">{{ errorMessage(game.error) }}</p>
            <div class="panels">
                <AdsPanel :active="route.name !== 'shop'" />
                <ShopPanel :active="route.name === 'shop'" />
            </div>
            <ReputationPanel
                :reputation="game.reputation"
                :disabled="game.pending || game.status !== 'playing'"
                @investigate="game.investigateReputation()"
            />
        </template>
        <RouterView />
        <div aria-live="polite">
            <LastTurn :last-turn="game.lastTurn" />
        </div>
    </main>
</template>

<style scoped>
.error {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-error-bg);
    color: var(--color-error-text);
}
</style>
