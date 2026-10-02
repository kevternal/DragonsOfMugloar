<script setup lang="ts">
import ShopItem from '@/components/ShopItem.vue'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

defineProps<{ active: boolean }>()

const store = useGameStore()
</script>

<template>
    <section class="panel" :class="{ 'panel--inactive': !active }" aria-labelledby="shop-heading">
        <component :is="active ? 'h1' : 'h2'" id="shop-heading" :tabindex="active ? -1 : undefined">
            {{ copy.shop.heading }}
        </component>
        <div v-if="store.shopFailed" class="notice">
            <p>{{ copy.shop.failed }}</p>
            <button type="button" :disabled="store.pending" @click="store.refreshShop()">
                {{ copy.shop.retry }}
            </button>
        </div>
        <p v-else-if="store.shop.length === 0 && store.status === 'playing'">
            {{ copy.shop.empty }}
        </p>
        <ul class="list">
            <li v-for="item in store.shop" :key="item.id">
                <ShopItem
                    :item="item"
                    :gold="store.stats.gold"
                    :disabled="store.pending"
                    @buy="store.buy($event)"
                />
            </li>
        </ul>
    </section>
</template>

<style scoped>
.notice {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-notice-bg);
}

.list {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
}
</style>
