<script setup lang="ts">
import { computed, useId } from 'vue'
import { copy, formatDelta } from '@/copy'
import { itemAdvice } from '@/game/recommendations'
import { affordability, itemEffect, raisedStat } from '@/game/shop'
import type { Deltas, ItemRecommendation, ShopItem as ShopItemModel } from '@/game/types'
import GameIcon, { type IconName } from './GameIcon.vue'

const {
    item,
    gold,
    disabled,
    reason = null,
    owned = 0,
    result = null,
} = defineProps<{
    item: ShopItemModel
    gold: number | null
    disabled: boolean
    /** The recommendation's reason when this item is the recommended one. */
    reason?: ItemRecommendation['reason'] | null
    /** Successful buys of this item this game; hidden at 0. */
    owned?: number
    /** This item's buy, until the next action starts (`lastBuy`). */
    result?: { success: boolean; deltas: Deltas } | null
}>()
defineEmits<{ buy: [itemId: string] }>()

const shortfallId = useId()

// The approved item art (design-assets.md, "Shop items"). An unlisted item has no icon.
const ITEM_ICONS: Record<string, IconName> = {
    hpot: 'health-potion',
    cs: 'claw-slashes',
    gas: 'jerrycan',
    wax: 'metal-plate',
    tricks: 'secret-book',
    wingpot: 'standing-potion',
    ch: 'crossed-claws',
    rf: 'rocket',
    iron: 'breastplate',
    mtrix: 'spell-book',
    wingpotmax: 'fairy-wings',
}

const icon = computed(() => ITEM_ICONS[item.id] ?? null)
const afford = computed(() => affordability(gold, item.cost))
const unaffordable = computed(() => afford.value.state === 'no')

/** The stat the item raises and by how much; `null` when the item is unlisted. */
const effect = computed(() => {
    const listed = itemEffect(item.id)
    if (listed?.level) {
        return { stat: 'level', value: listed.level } as const
    }
    if (listed?.lives) {
        return { stat: 'lives', value: listed.lives } as const
    }
    return null
})

/** "+2 levels" or "+1 life". */
const effectLabel = computed(() =>
    effect.value === null ? null : formatDelta(effect.value.stat, effect.value.value),
)

/** At most one badge: the recommendation's reason, else Not worth it on a +1 item (CAP-17). */
const badge = computed(() => {
    if (reason !== null) {
        return copy.shop.badge[reason]
    }
    return itemAdvice(item.id) === 'plus1-not-worth' ? copy.shop.notWorth : null
})

const failed = computed(() => result?.success === false)

/**
 * The buy result: the stat it raised, or a failure. With unknown stats there is no delta,
 * so the item's effect stands in; a delta of 0 never does.
 */
const status = computed(() => {
    if (result === null) {
        return ''
    }
    if (failed.value) {
        return copy.shop.buyFailed
    }
    const raised = raisedStat(result.deltas)
    if (raised !== null) {
        return formatDelta(raised, result.deltas[raised] ?? 0)
    }
    if (effect.value !== null && result.deltas[effect.value.stat] === undefined) {
        return effectLabel.value ?? ''
    }
    return copy.shop.boughtNoChange
})
</script>

<template>
    <div class="shop-row">
        <div class="row" :class="{ recommended: reason !== null, bought: result?.success }">
            <!-- CAP-4, CAP-17: one native button per item. Its content forms the name, decisive cues
             first: "Rocket Fuel, +2 levels, 300 gold, Buy next, owned 1, buy (costs one turn)". -->
            <button
                type="button"
                class="item"
                :disabled="disabled || unaffordable"
                :aria-describedby="unaffordable ? shortfallId : undefined"
                @click="$emit('buy', item.id)"
            >
                <span class="art" aria-hidden="true">
                    <GameIcon v-if="icon" :name="icon" class="art-icon" />
                </span>
                <span class="name">{{ item.name }}</span>
                <template v-if="effectLabel">
                    <span class="visually-hidden">{{ copy.separator }}</span>
                    <span class="effect">{{ effectLabel }}</span>
                </template>
                <span class="visually-hidden">{{ copy.separator }}</span>
                <span class="cost">
                    <GameIcon name="two-coins" class="cost-icon" />{{ item.cost
                    }}<span class="visually-hidden">{{ copy.shop.gold }}</span>
                    <span class="buy" aria-hidden="true">{{ copy.shop.buy }}</span>
                </span>
                <!-- Narrow rows let these wrap; wide rows give each its own column. -->
                <span class="tags">
                    <template v-if="badge">
                        <span class="visually-hidden">{{ copy.separator }}</span>
                        <span class="badge" :class="{ best: reason }">{{ badge }}</span>
                    </template>
                    <template v-if="owned > 0">
                        <span class="visually-hidden">{{ copy.separator }}</span>
                        <span class="owned">
                            <span aria-hidden="true">{{ copy.shop.owned(owned) }}</span>
                            <span class="visually-hidden">{{ copy.shop.ownedSpoken(owned) }}</span>
                        </span>
                    </template>
                </span>
                <span class="visually-hidden">{{ copy.separator }}{{ copy.shop.buySpoken }}</span>
            </button>
            <div class="aside">
                <!-- Not live: the activity log announces each buy once (AD-15). -->
                <p class="status" :class="{ failed }">{{ status }}</p>
                <p v-if="unaffordable" :id="shortfallId" class="note">
                    {{ copy.shop.shortfall(afford.shortfall ?? 0) }}
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.shop-row {
    container: shop-row / inline-size;
}

.row {
    display: grid;
    grid-template-areas:
        'item'
        'aside';
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
}

/* Narrow: art | name, then effect and the wrapping badge and owned | cost. */
.item {
    /* Contains the visually hidden name parts. */
    position: relative;
    grid-area: item;
    display: grid;
    grid-template-areas:
        'art name name cost'
        'art effect tags cost';
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: 0 var(--space-2);
    align-items: center;
    justify-items: start;
    width: 100%;
    min-height: 0;
    padding: var(--space-1) var(--space-2);
    /* No border: the row draws it (a transparent one would show in forced colors). */
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: var(--font-size-s);
    line-height: 1.35;
    text-align: start;
}

/* The whole row lights up, the result and shortfall column included. */
.row:has(.item:hover:not(:disabled)) {
    background: var(--color-row-hover);
}

.item:disabled {
    background: transparent;
    color: var(--color-muted);
}

.row.recommended {
    border-color: var(--color-best);
}

.art {
    grid-area: art;
    display: flex;
    color: var(--color-accent);
}

.item:disabled .art {
    color: var(--color-muted);
}

.art-icon {
    width: var(--space-4);
    height: var(--space-4);
}

.name {
    grid-area: name;
    min-width: 0;
    font-weight: 700;
    font-size: var(--font-size-m);
}

.effect {
    grid-area: effect;
    font-family: var(--font-display);
    font-weight: 600;
}

.cost {
    grid-area: cost;
    display: flex;
    gap: var(--space-1);
    align-items: center;
    justify-self: end;
    font-family: var(--font-display);
    font-size: var(--font-size-m);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.cost-icon {
    color: var(--color-muted);
}

/* The visible cue that the row buys (the name says it in words). */
.buy {
    padding: 0 var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
}

.item:disabled .buy {
    border-style: dashed;
}

.tags {
    grid-area: tags;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-2);
    align-items: center;
    min-width: 0;
}

.badge {
    grid-area: badge;
    padding: 0 var(--space-1);
    /* Keeps the badge outlined in forced colors, where backgrounds are dropped. */
    border: 1px solid transparent;
    border-radius: var(--radius);
    font-size: var(--font-size-xs);
    font-weight: 700;
    white-space: nowrap;
}

.badge.best {
    background: var(--color-badge-best-bg);
    color: var(--color-badge-best-text);
}

.badge:not(.best) {
    border-color: var(--color-border);
    color: var(--color-muted);
}

.owned {
    grid-area: owned;
    color: var(--color-muted);
    font-size: var(--font-size-xs);
    white-space: nowrap;
}

.aside {
    grid-area: aside;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-2);
    align-items: center;
    padding-inline: var(--space-2);
    font-size: var(--font-size-xs);
}

/* Empty most of the time, taking no space. */
.status {
    font-weight: 700;
    color: var(--color-success);
}

.status.failed {
    color: var(--color-error-text);
}

.note {
    color: var(--color-muted);
}

@media (prefers-reduced-motion: no-preference) {
    .bought .status {
        animation: status-in 0.4s ease-out;
    }

    @keyframes status-in {
        from {
            opacity: 0;
            transform: translateY(-0.4rem);
        }
    }
}

/* Wide rows: one line, the result and shortfall in a column at the row end.
   72rem at the 10px root = 720px. */
@container shop-row (min-width: 72rem) {
    .row {
        grid-template-areas: 'item aside';
        grid-template-columns: minmax(0, 1fr) minmax(12rem, 17rem);
    }

    /* Columns line up across rows at these minimums, and grow when text needs more room. */
    .item {
        grid-template-areas: 'art name effect badge owned cost';
        grid-template-columns:
            auto minmax(0, 1fr) minmax(7rem, max-content) minmax(9.5rem, max-content)
            minmax(7rem, max-content) minmax(10rem, max-content);
    }

    .tags {
        display: contents;
    }

    .aside {
        flex-direction: column;
        justify-content: center;
        align-items: start;
        padding-block: var(--space-1);
    }
}
</style>
