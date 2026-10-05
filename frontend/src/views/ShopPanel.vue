<script setup lang="ts">
import { computed } from 'vue'
import ShopItem from '@/components/ShopItem.vue'
import { copy } from '@/copy'
import { shelfOrder } from '@/game/recommendations'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

/**
 * CAP-4, CAP-17: one row per item, cheapest first, with a shelf plank wherever the cost
 * changes, the recommendation's reason on the recommended item, and the latest buy's result
 * on the item it bought.
 */
const rows = computed(() =>
    shelfOrder(game.shop).map((item, i, all) => ({
        item,
        plank: i > 0 && item.cost !== all[i - 1]?.cost,
        reason: game.recommendedItem?.itemId === item.id ? game.recommendedItem.reason : null,
        owned: game.purchases[item.id] ?? 0,
        result: game.lastBuy?.itemId === item.id ? game.lastBuy : null,
    })),
)
</script>

<template>
    <section aria-labelledby="shop-heading">
        <h1 id="shop-heading" tabindex="-1">
            {{ copy.shop.heading }}
        </h1>
        <p class="flavour">{{ copy.shop.flavour }}</p>
        <div v-if="game.shopFailed" class="notice">
            <p>{{ copy.shop.failed }}</p>
            <button type="button" :disabled="game.pending" @click="game.refreshShop()">
                {{ copy.shop.retry }}
            </button>
        </div>
        <p v-else-if="game.shop.length === 0 && game.status === 'playing'">
            {{ copy.shop.empty }}
        </p>
        <!-- role="list": Safari drops list semantics when list-style is none. -->
        <ul class="list" role="list">
            <li v-for="row in rows" :key="row.item.id" :class="{ plank: row.plank }">
                <ShopItem
                    :item="row.item"
                    :gold="game.stats.gold"
                    :disabled="game.pending"
                    :reason="row.reason"
                    :owned="row.owned"
                    :result="row.result"
                    @buy="game.buy($event)"
                />
            </li>
        </ul>
    </section>
</template>

<style scoped>
.flavour {
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

.notice {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    margin-top: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-notice-bg);
}

.list {
    display: grid;
    gap: var(--space-1);
    /* Shelves, not a full-width table: keeps each item's name, effect and cost close. */
    max-width: 88rem;
    margin-top: var(--space-2);
}

/* A wooden shelf plank between cost groups (decorative). */
.plank {
    margin-top: var(--space-1);
    padding-top: var(--space-2);
    border-top: var(--space-1) solid var(--color-shelf);
}
</style>
