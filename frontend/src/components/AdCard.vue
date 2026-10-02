<script setup lang="ts">
import { useId } from 'vue'
import { copy } from '@/copy'
import type { Ad } from '@/game/types'

const props = defineProps<{ ad: Ad; disabled: boolean }>()
defineEmits<{ solve: [adId: string] }>()

const noteId = useId()
</script>

<template>
    <article class="ad">
        <p class="message">{{ props.ad.message }}</p>
        <dl>
            <div>
                <dt>{{ copy.ads.reward }}</dt>
                <dd>{{ props.ad.reward }}</dd>
            </div>
            <div>
                <dt>{{ copy.ads.expiresIn }}</dt>
                <dd>{{ props.ad.expiresIn }}</dd>
            </div>
            <div>
                <dt>{{ copy.ads.probability }}</dt>
                <dd>{{ props.ad.probability }}</dd>
            </div>
        </dl>
        <p v-if="!props.ad.solvable" :id="noteId" class="note">{{ copy.ads.unsolvable }}</p>
        <button
            type="button"
            :disabled="props.disabled || !props.ad.solvable"
            :aria-describedby="props.ad.solvable ? undefined : noteId"
            @click="$emit('solve', props.ad.adId)"
        >
            {{ copy.ads.solve }}
            <span class="visually-hidden">: {{ props.ad.message }}</span>
        </button>
    </article>
</template>

<style scoped>
.ad {
    display: grid;
    gap: var(--space-2);
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

.note {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

button {
    justify-self: start;
}
</style>
