<script setup lang="ts">
import { copy } from '@/copy'
import GameIcon, { type IconName } from './GameIcon.vue'
import StatValue from './StatValue.vue'
import type { StatKey, Stats } from '@/game/types'

const { stats, changed = null } = defineProps<{
    stats: Stats
    /** The stat a buy just raised (CAP-4); its result is also in the bought row's status. */
    changed?: StatKey | null
}>()

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
            <div v-for="key in keys" :key="key" class="stat" :class="{ changed: key === changed }">
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
    gap: var(--space-1) var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

.stat {
    display: flex;
    /* Room for the emphasis, so emphasising a stat never shifts the bar. */
    padding: 0 var(--space-1);
    border-radius: var(--radius);
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

/* Outlined as well as tinted, so it shows in forced colors too (an outline, not a
   transparent border, which forced colors would draw on every stat). */
.stat.changed {
    outline: 1px solid var(--color-stat-changed);
    background: var(--color-stat-changed-bg);
}

.stat.changed dd {
    color: var(--color-stat-changed);
}

@media (prefers-reduced-motion: no-preference) {
    .stat.changed dd {
        animation: stat-pop 0.5s ease-out;
    }

    @keyframes stat-pop {
        40% {
            transform: scale(1.25);
        }
    }
}
</style>
