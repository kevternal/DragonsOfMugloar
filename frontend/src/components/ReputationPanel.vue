<script setup lang="ts">
import { copy, reputationRows } from '@/copy'
import type { Reputation } from '@/game/types'
import StatValue from './StatValue.vue'

const props = defineProps<{ reputation: Reputation | null; disabled: boolean }>()
defineEmits<{ investigate: [] }>()
</script>

<template>
    <!-- CAP-5: one compact row; values read as unknown until first investigated. Named by
         aria-label, not a heading, so the panel's <h1> stays the first heading. -->
    <section class="reputation" :aria-label="copy.reputation.label">
        <dl>
            <div v-for="row in reputationRows(props.reputation)" :key="row.label" class="row">
                <dt>{{ row.label }}</dt>
                <dd><StatValue :value="row.value" /></dd>
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
    font-weight: bold;
    font-variant-numeric: tabular-nums;
}

button {
    min-height: var(--control-height-compact);
    padding: 0 var(--space-2);
    font-size: var(--font-size-s);
}
</style>
