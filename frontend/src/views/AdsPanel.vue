<script setup lang="ts">
import AdCard from '@/components/AdCard.vue'
import BoardNotice from '@/components/BoardNotice.vue'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

defineProps<{ active: boolean }>()

const store = useGameStore()
</script>

<template>
    <section class="panel" :class="{ 'panel--inactive': !active }" aria-labelledby="ads-heading">
        <component :is="active ? 'h1' : 'h2'" id="ads-heading" :tabindex="active ? -1 : undefined">
            {{ copy.ads.heading }}
        </component>
        <BoardNotice
            v-if="store.boardStale"
            :refreshing="store.pending"
            @retry="store.refreshMessages()"
        />
        <p v-if="store.board.length === 0 && !store.boardStale && store.status === 'playing'">
            {{ copy.ads.empty }}
        </p>
        <ul class="list">
            <li v-for="ad in store.board" :key="ad.adId">
                <AdCard
                    :ad="ad"
                    :disabled="store.pending || store.boardStale"
                    @solve="store.solve($event)"
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
