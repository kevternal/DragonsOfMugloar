<script setup lang="ts">
import ShopItem from '@/components/ShopItem.vue'
import { copy } from '@/copy'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
</script>

<template>
    <section aria-labelledby="shop-heading">
        <h1 id="shop-heading" tabindex="-1">
            {{ copy.shop.heading }}
        </h1>
        <div v-if="game.shopFailed" class="notice">
            <p>{{ copy.shop.failed }}</p>
            <button type="button" :disabled="game.pending" @click="game.refreshShop()">
                {{ copy.shop.retry }}
            </button>
        </div>
        <p v-else-if="game.shop.length === 0 && game.status === 'playing'">
            {{ copy.shop.empty }}
        </p>
        <ul class="list">
            <li v-for="item in game.shop" :key="item.id">
                <ShopItem
                    :item="item"
                    :gold="game.stats.gold"
                    :disabled="game.pending"
                    @buy="game.buy($event)"
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
