<script setup lang="ts">
import { copy } from '@/copy'
import type { StatKey, Stats } from '@/game/types'

defineProps<{ stats: Stats }>()

const keys: StatKey[] = ['lives', 'gold', 'level', 'score', 'turn']
</script>

<template>
    <section class="stats" :aria-label="copy.stats.heading">
        <dl>
            <div v-for="key in keys" :key="key" class="stat">
                <dt>{{ copy.stats[key] }}</dt>
                <dd>{{ stats[key] ?? copy.stats.unknown }}</dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

.stat {
    min-width: 8rem;
}

dt {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

dd {
    font-size: var(--font-size-l);
    font-weight: bold;
}
</style>
