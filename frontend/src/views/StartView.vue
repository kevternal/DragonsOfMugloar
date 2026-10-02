<script setup lang="ts">
import { useRouter } from 'vue-router'
import { copy, errorMessage } from '@/copy'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const router = useRouter()

async function startGame(): Promise<void> {
    await game.start()
    if (game.status === 'playing' && game.gameId) {
        await router.push({ name: 'ads', params: { gameId: game.gameId } })
    }
}
</script>

<template>
    <main class="page">
        <h1 tabindex="-1">{{ copy.start.heading }}</h1>
        <p>{{ copy.start.intro }}</p>
        <p v-if="game.expiredNotice" role="status">{{ copy.start.expired }}</p>
        <p v-if="game.error" role="alert" class="error">{{ errorMessage(game.error) }}</p>
        <button type="button" :disabled="game.pending" @click="startGame">
            {{ game.pending ? copy.start.starting : copy.start.button }}
        </button>
    </main>
</template>

<style scoped>
main {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
}

.error {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-error-bg);
    color: var(--color-error-text);
}
</style>
