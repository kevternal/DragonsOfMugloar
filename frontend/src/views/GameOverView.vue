<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { copy, errorMessage } from '@/copy'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const route = useRoute()
const router = useRouter()

// AD-10: /over renders from the store. If the store doesn't hold this game as over
// (for example after a reload), go back to the start screen.
const holdsGame = store.status === 'over' && store.gameId === route.params.gameId
if (!holdsGame) void router.replace({ name: 'start' })

// Snapshot, so "Play again" resetting the store doesn't blank the screen.
const finalScore = store.stats.score
const finalTurn = store.stats.turn

async function playAgain(): Promise<void> {
    await store.start()
    if (store.status === 'playing' && store.gameId) {
        await router.push({ name: 'ads', params: { gameId: store.gameId } })
    }
}
</script>

<template>
    <section v-if="holdsGame" class="over">
        <h1 tabindex="-1">{{ copy.over.heading }}</h1>
        <p>{{ copy.over.message }}</p>
        <dl>
            <div>
                <dt>{{ copy.over.finalScore }}</dt>
                <dd>{{ finalScore ?? copy.stats.unknown }}</dd>
            </div>
            <div>
                <dt>{{ copy.over.finalTurn }}</dt>
                <dd>{{ finalTurn ?? copy.stats.unknown }}</dd>
            </div>
        </dl>
        <p v-if="store.error" role="alert" class="error">{{ errorMessage(store.error) }}</p>
        <button type="button" :disabled="store.pending" @click="playAgain">
            {{ store.pending ? copy.over.starting : copy.over.playAgain }}
        </button>
    </section>
</template>

<style scoped>
.over {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
}

dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
}

dt {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

dd {
    font-size: var(--font-size-xl);
    font-weight: bold;
}

.error {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-error-bg);
    color: var(--color-error-text);
}
</style>
