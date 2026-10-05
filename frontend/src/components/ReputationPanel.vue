<script setup lang="ts">
import { copy, reputationRows } from '@/copy'
import type { Reputation } from '@/game/types'
import GameIcon, { type IconName } from './GameIcon.vue'
import StatValue from './StatValue.vue'

const props = defineProps<{ reputation: Reputation | null; disabled: boolean }>()
defineEmits<{ investigate: [] }>()

// Decorative; the text labels stay (AD-15).
const icons: Record<keyof Reputation, IconName> = {
    people: 'person',
    state: 'crown',
    underworld: 'hood',
}
</script>

<template>
    <!-- CAP-5: one compact row; values read as unknown until first investigated. Named by
         aria-label, not a heading, so the panel's <h1> stays the first heading. -->
    <section class="reputation" :aria-label="copy.reputation.label">
        <dl>
            <div v-for="row in reputationRows(props.reputation)" :key="row.key" class="row">
                <dt>{{ row.label }}</dt>
                <dd>
                    <GameIcon :name="icons[row.key]" class="icon" /><StatValue :value="row.value" />
                </dd>
            </div>
        </dl>
        <button type="button" :disabled="props.disabled" @click="$emit('investigate')">
            {{ copy.reputation.button }}
        </button>
    </section>
</template>

<style scoped>
.reputation {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    align-items: center;
}

dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-2);
}

.row {
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

button {
    min-height: var(--control-height-compact);
    padding: 0 var(--space-2);
    font-size: var(--font-size-s);
}
</style>
