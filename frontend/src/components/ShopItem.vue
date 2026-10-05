<script setup lang="ts">
import { computed, useId } from 'vue'
import { copy } from '@/copy'
import { affordability, itemEffect } from '@/game/shop'
import type { ShopItem as ShopItemModel } from '@/game/types'

const props = defineProps<{ item: ShopItemModel; gold: number | null; disabled: boolean }>()
defineEmits<{ buy: [itemId: string] }>()

const shortfallId = useId()
const afford = computed(() => affordability(props.gold, props.item.cost))
const effectText = computed(() => {
    const effect = itemEffect(props.item.id)
    if (effect?.level) return copy.shop.effectLevel(effect.level)
    if (effect?.lives) return copy.shop.effectLife(effect.lives)
    return null
})
</script>

<template>
    <article class="item">
        <h2>{{ props.item.name }}</h2>
        <p>{{ copy.shop.cost }}: {{ props.item.cost }}</p>
        <p v-if="effectText">{{ effectText }}</p>
        <p v-if="afford.state === 'no'" :id="shortfallId" class="note">
            {{ copy.shop.shortfall(afford.shortfall ?? 0) }}
        </p>
        <button
            type="button"
            :disabled="props.disabled || afford.state === 'no'"
            :aria-describedby="afford.state === 'no' ? shortfallId : undefined"
            @click="$emit('buy', props.item.id)"
        >
            {{ copy.shop.buy }}
            <span class="visually-hidden">: {{ props.item.name }}</span>
        </button>
    </article>
</template>

<style scoped>
.item {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

h2 {
    margin: 0;
    font-size: var(--font-size-m);
}

.note {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

button {
    justify-self: start;
}
</style>
