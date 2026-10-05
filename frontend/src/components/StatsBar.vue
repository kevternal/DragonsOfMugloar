<script setup lang="ts">
import { copy } from '@/copy'
import GameIcon, { type IconName } from './GameIcon.vue'
import StatValue from './StatValue.vue'
import type { StatKey, Stats } from '@/game/types'

defineProps<{ stats: Stats }>()

const keys: StatKey[] = ['lives', 'gold', 'level', 'score', 'turn']

// Decorative; the text labels stay (AD-15).
const icons: Record<StatKey, IconName> = {
    lives: 'heart-drop',
    gold: 'two-coins',
    level: 'level-four',
    score: 'trophy',
    turn: 'hourglass',
}
</script>

<template>
    <section class="stats" :aria-label="copy.stats.heading">
        <dl>
            <div v-for="key in keys" :key="key" class="stat">
                <dt>{{ copy.stats[key] }}</dt>
                <dd>
                    <GameIcon :name="icons[key]" class="icon" /><StatValue :value="stats[key]" />
                </dd>
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
    display: flex;
    gap: var(--space-1);
    align-items: center;
    font-family: var(--font-display);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.icon {
    color: var(--color-accent);
}
</style>
