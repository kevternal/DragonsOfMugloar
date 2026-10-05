<script setup lang="ts">
import BoardNotice from '@/components/BoardNotice.vue'
import JobRow from '@/components/JobRow.vue'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
</script>

<template>
    <section aria-labelledby="ads-heading">
        <h1 id="ads-heading" tabindex="-1">
            {{ copy.ads.heading }}
        </h1>
        <BoardNotice
            v-if="game.boardStale"
            :refreshing="game.pending"
            @retry="game.refreshMessages()"
        />
        <p v-if="game.board.length === 0 && !game.boardStale && game.status === 'playing'">
            {{ copy.ads.empty }}
        </p>
        <p v-if="game.rankedJobs.length > 0" class="visually-hidden">
            {{ copy.jobs.listIntro }}
        </p>
        <!-- role="list": Safari drops list semantics when list-style is none. -->
        <ul class="list" role="list">
            <!-- CAP-16: ranked by the store (AD-6); every ad is listed, none hidden. -->
            <li v-for="job in game.rankedJobs" :key="job.ad.adId">
                <JobRow
                    :job="job"
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
    gap: var(--space-1);
    margin-top: var(--space-2);
}
</style>
