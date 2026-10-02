<script setup lang="ts">
import { copy, reputationRows } from '@/copy'
import type { Reputation } from '@/game/types'

const props = defineProps<{ reputation: Reputation | null; disabled: boolean }>()
defineEmits<{ investigate: [] }>()
</script>

<template>
    <section class="reputation">
        <h2>{{ copy.reputation.heading }}</h2>
        <dl v-if="props.reputation">
            <div v-for="row in reputationRows(props.reputation)" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
            </div>
        </dl>
        <p v-else>{{ copy.reputation.none }}</p>
        <button type="button" :disabled="props.disabled" @click="$emit('investigate')">
            {{ copy.reputation.button }}
        </button>
    </section>
</template>

<style scoped>
.reputation {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
}

dt {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

dd {
    font-weight: bold;
}
</style>
