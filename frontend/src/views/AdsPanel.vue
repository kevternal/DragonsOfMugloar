<script setup lang="ts">
import AdCard from '@/components/AdCard.vue'
import BoardNotice from '@/components/BoardNotice.vue'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

defineProps<{ active: boolean }>()

const game = useGameStore()
</script>

<template>
    <section class="panel" :class="{ 'panel--inactive': !active }" aria-labelledby="ads-heading">
        <component :is="active ? 'h1' : 'h2'" id="ads-heading" :tabindex="active ? -1 : undefined">
            {{ copy.ads.heading }}
        </component>
        <BoardNotice
            v-if="game.boardStale"
            :refreshing="game.pending"
            @retry="game.refreshMessages()"
        />
        <p v-if="game.board.length === 0 && !game.boardStale && game.status === 'playing'">
            {{ copy.ads.empty }}
        </p>
        <ul class="list">
            <li v-for="ad in game.board" :key="ad.adId">
                <AdCard
                    :ad="ad"
                    :disabled="game.pending || game.boardStale"
                    @solve="game.solve($event)"
                />
            </li>
        </ul>
    </section>
</template>

<style scoped>
.list {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
}
</style>
