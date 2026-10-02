<script setup lang="ts">
import { computed } from 'vue'
import { copy, formatDelta } from '@/copy'
import type { LastTurn, StatKey } from '@/game/types'

const props = defineProps<{ lastTurn: LastTurn | null }>()

const deltaTexts = computed(() =>
    Object.entries(props.lastTurn?.deltas ?? {})
        .filter(([, value]) => value !== 0)
        .map(([key, value]) => formatDelta(key as StatKey, value)),
)
</script>

<template>
    <section class="last-turn">
        <h2>{{ copy.lastTurn.heading }}</h2>
        <p v-if="!props.lastTurn">{{ copy.lastTurn.none }}</p>
        <template v-else>
            <template v-if="props.lastTurn.kind === 'solve'">
                <p>{{ copy.lastTurn.solved(props.lastTurn.adMessage) }}</p>
                <p>
                    {{ props.lastTurn.success ? copy.lastTurn.success : copy.lastTurn.failure }}:
                    {{ props.lastTurn.message }}
                </p>
            </template>
            <template v-else-if="props.lastTurn.kind === 'buy'">
                <p>{{ copy.lastTurn.bought(props.lastTurn.itemName) }}</p>
                <p>
                    {{ props.lastTurn.success ? copy.lastTurn.boughtOk : copy.lastTurn.boughtFail }}
                </p>
            </template>
            <p v-else>{{ copy.lastTurn.asked }}</p>
            <p>
                {{ copy.lastTurn.changes }}:
                {{ deltaTexts.length > 0 ? deltaTexts.join(', ') : copy.lastTurn.noChanges }}
            </p>
        </template>
    </section>
</template>

<style scoped>
.last-turn {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}
</style>
