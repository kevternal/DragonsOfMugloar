<script setup lang="ts">
import { copy } from '@/copy'
import StatValue from './StatValue.vue'
import type { StatKey, Stats } from '@/game/types'

defineProps<{ stats: Stats }>()

const keys: StatKey[] = ['lives', 'gold', 'level', 'score', 'turn']
</script>

<template>
    <section class="stats" :aria-label="copy.stats.heading">
        <dl>
            <div v-for="key in keys" :key="key" class="stat">
                <dt>{{ copy.stats[key] }}</dt>
                <dd><StatValue :value="stats[key]" /></dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
/* Compact top-bar strip (CAP-15): label and value side by side, wrapping as needed. */
dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

.stat {
    display: flex;
    gap: var(--space-1);
    align-items: baseline;
}

dt {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

dd {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
}
</style>
