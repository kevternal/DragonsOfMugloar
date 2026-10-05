<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId, useTemplateRef, watch } from 'vue'
import { copy, formatDelta } from '@/copy'
import type { TurnRecord } from '@/game/types'

const props = defineProps<{ log: TurnRecord[] }>()

const labelId = useId()
const region = useTemplateRef<HTMLElement>('region')

function actionText(entry: TurnRecord): string {
    switch (entry.kind) {
        case 'solve':
            return entry.adMessage
        case 'buy':
            return copy.log.bought(entry.itemName)
        case 'reputation':
            return copy.log.asked(entry.reputation)
    }
}

/** CAP-12: only gold and lives changes are shown; zero changes are left out. */
function deltaText(entry: TurnRecord): string {
    return (['gold', 'lives'] as const)
        .flatMap((key) => {
            const value = entry.deltas[key] ?? 0
            return value === 0 ? [] : [formatDelta(key, value)]
        })
        .join(', ')
}

const rows = computed(() =>
    props.log.map((entry) => ({ entry, action: actionText(entry), deltas: deltaText(entry) })),
)
const newest = computed(() => props.log[props.log.length - 1] ?? null)

// AD-15: on a new entry, align the newest entry's top with the region's top, instantly
// (never scrollIntoView, never smooth), so its own line stays visible above its flavour line.
function showNewest(): void {
    const el = region.value
    const last = el?.querySelector<HTMLElement>('li:last-child')
    if (el && last) {
        el.scrollTop = last.offsetTop
    }
}

// Re-pin the collapsed log to the newest entry whenever the region or its content resizes
// (the log collapsing after a turn, a font swap), so a scroll set before the resize never
// leaves the newest flavour line out of view. An expanded log is the reader's to scroll.
const list = useTemplateRef<HTMLElement>('list')
const observer = new ResizeObserver(() => {
    if (!region.value?.matches(':focus-within')) {
        showNewest()
    }
})

onMounted(() => {
    showNewest()
    for (const el of [region.value, list.value]) {
        if (el) {
            observer.observe(el)
        }
    }
})
onBeforeUnmount(() => observer.disconnect())
watch(() => props.log.length, showNewest, { flush: 'post' })
</script>

<template>
    <div class="activity-log">
        <h2 :id="labelId" class="visually-hidden">{{ copy.log.label }}</h2>
        <!-- Outside the live region, so a new game's empty log is not announced (AD-15). -->
        <p v-if="props.log.length === 0" class="none">{{ copy.log.none }}</p>
        <!-- AD-15: role="log" is not allowed on <ol>, so the region wraps it. Never v-if'd.
             tabindex: the region scrolls and holds no controls, so keyboards must reach it. -->
        <section
            ref="region"
            class="entries"
            role="log"
            aria-live="polite"
            :aria-labelledby="labelId"
            tabindex="0"
        >
            <ol ref="list">
                <li v-for="row in rows" :key="row.entry.seq">
                    <p class="line">
                        <span class="turn" aria-hidden="true">{{
                            copy.log.turn(row.entry.turn)
                        }}</span>
                        <span class="visually-hidden">{{
                            copy.log.turnSpoken(row.entry.turn)
                        }}</span>
                        <template v-if="row.entry.kind !== 'reputation'">
                            <span
                                class="mark"
                                :class="row.entry.success ? 'mark--ok' : 'mark--fail'"
                                aria-hidden="true"
                                >{{ row.entry.success ? copy.log.markOk : copy.log.markFail }}</span
                            >
                            <span class="visually-hidden">{{
                                row.entry.success ? copy.log.succeeded : copy.log.failed
                            }}</span>
                        </template>
                        <span class="action">{{ row.action }}</span>
                        <template v-if="row.deltas">
                            <span class="visually-hidden">{{ copy.log.deltasSpoken }}</span>
                            <span class="deltas">{{ row.deltas }}</span>
                        </template>
                    </p>
                    <p v-if="row.entry === newest && row.entry.kind === 'solve'" class="flavour">
                        {{ row.entry.message }}
                    </p>
                </li>
            </ol>
        </section>
    </div>
</template>

<style scoped>
.activity-log {
    display: flex;
    flex-direction: column;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    font-size: var(--font-size-s);
}

.none {
    color: var(--color-muted);
}

.entries {
    /* Positioned, so visually hidden text and offsetTop stay inside the scroller. */
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    /* The scroll is set explicitly (showNewest); browser anchoring must not shift it. */
    overflow-anchor: none;
}

ol {
    margin: 0;
    padding: 0;
    list-style: none;
}

.line {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-2);
    align-items: baseline;
}

.turn {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
}

.mark {
    font-weight: bold;
}

.mark--ok {
    color: var(--color-success);
}

.mark--fail {
    color: var(--color-error-text);
}

.action {
    flex: 1 1 12rem;
    min-width: 0;
}

.deltas {
    font-weight: bold;
}

.flavour {
    padding-left: var(--space-4);
    color: var(--color-muted);
    font-style: italic;
}
</style>
