<script setup lang="ts">
import { computed, useId } from 'vue'
import { copy } from '@/copy'
import type { JobFlag, RankedJob, RiskTier } from '@/game/types'
import GameIcon, { type IconName } from './GameIcon.vue'

const { job, disabled } = defineProps<{ job: RankedJob; disabled: boolean }>()
defineEmits<{ solve: [adId: string] }>()

const noteId = useId()

// Risk levels 1 to 4 (design-assets.md, approved set). Unknown has no approved art: a "?" mark.
const TIER_ICONS: Record<Exclude<RiskTier, 'unknown'>, IconName> = {
    safe: 'cake-slice',
    moderate: 'footprint',
    risky: 'rolling-dices',
    deadly: 'death-skull',
}

type BadgeKind = 'best' | JobFlag

const BADGE_TEXT: Record<BadgeKind, string> = {
    best: copy.jobs.bestPick,
    trap: copy.jobs.trap,
    'state-risk': copy.jobs.stateRisk,
}

const icon = computed(() => (job.tier === 'unknown' ? null : TIER_ICONS[job.tier]))

const oddsText = computed(() =>
    job.winPct === null ? copy.jobs.unknownOdds : copy.jobs.winPct(job.winPct),
)

const badges = computed(() => {
    const kinds: BadgeKind[] = []
    if (job.best) {
        kinds.push('best')
    }
    if (job.flag !== null) {
        kinds.push(job.flag)
    }
    return kinds.map((kind) => ({ kind, text: BADGE_TEXT[kind] }))
})
</script>

<template>
    <div class="job-row">
        <!-- CAP-16: one native button per job. Its content forms the name, decisive cues first:
             "Solve: safe, Piece of cake, 95%, 34 gold, Best pick. <ad>. 5 turns left". -->
        <button
            type="button"
            class="job"
            :class="[`tier-${job.tier}`, { best: job.best }]"
            :disabled="disabled || !job.ad.solvable"
            :aria-describedby="job.ad.solvable ? undefined : noteId"
            @click="$emit('solve', job.ad.adId)"
        >
            <span class="risk" aria-hidden="true">
                <GameIcon v-if="icon" :name="icon" class="risk-icon" />
                <span v-else class="risk-icon unknown-mark">{{ copy.stats.unknownShort }}</span>
            </span>
            <span class="odds">
                <span class="visually-hidden"
                    >{{ copy.jobs.solve }}{{ copy.jobs.tier[job.tier] }}</span
                >
                <span class="label">{{ job.ad.probability }}</span>
                <span class="visually-hidden">{{ copy.separator }}</span>
                <span class="pct">{{ oddsText }}</span>
                <span class="visually-hidden">{{ copy.separator }}</span>
                <span class="reward">
                    <GameIcon name="two-coins" class="stat-icon" />{{ job.ad.reward
                    }}<span class="visually-hidden">{{ copy.jobs.gold }}</span>
                </span>
                <template v-for="badge in badges" :key="badge.kind">
                    <span class="visually-hidden">{{ copy.separator }}</span>
                    <span class="badge" :class="badge.kind">{{ badge.text }}</span>
                </template>
                <span class="visually-hidden">{{ copy.jobs.endOdds }}</span>
            </span>
            <span class="message"
                >{{ job.ad.message
                }}<span class="visually-hidden">{{ copy.jobs.endMessage }}</span></span
            >
            <span class="expiry">
                <GameIcon name="hourglass" class="stat-icon" />{{ job.ad.expiresIn
                }}<span class="visually-hidden">{{ copy.jobs.turnsLeft(job.ad.expiresIn) }}</span>
            </span>
        </button>
        <p v-if="!job.ad.solvable" :id="noteId" class="note">{{ copy.ads.unsolvable }}</p>
    </div>
</template>

<style scoped>
.job-row {
    container: job-row / inline-size;
}

/* Narrow: icon | odds, reward and badges | expiry, over icon | message (two lines) | expiry.
   The expiry spans both lines, so it centres on the row like the icon. */
.job {
    /* Contains the visually hidden name parts. */
    position: relative;
    display: grid;
    grid-template-areas:
        'risk odds expiry'
        'risk message expiry';
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0 var(--space-2);
    align-items: center;
    width: 100%;
    min-height: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-left: var(--space-1) solid var(--tier-color);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-size-s);
    line-height: 1.35;
    text-align: start;
}

.job:hover:not(:disabled) {
    background: var(--color-row-hover);
}

/* Beats the global button:disabled border, so a disabled row keeps its tier stripe. */
.job:disabled {
    border-left-color: var(--tier-color);
    background: var(--color-surface);
    color: var(--color-muted);
}

.job.best {
    border-color: var(--color-best);
    border-left-color: var(--tier-color);
}

.tier-safe {
    --tier-color: var(--color-risk-safe);
}

.tier-moderate {
    --tier-color: var(--color-risk-moderate);
}

.tier-risky {
    --tier-color: var(--color-risk-risky);
}

.tier-deadly {
    --tier-color: var(--color-risk-deadly);
}

.tier-unknown {
    --tier-color: var(--color-risk-unknown);
}

.risk {
    grid-area: risk;
    display: flex;
    color: var(--tier-color);
}

.risk-icon {
    width: var(--space-4);
    height: var(--space-4);
}

.unknown-mark {
    display: grid;
    place-items: center;
    border: 0.2rem solid currentColor;
    border-radius: 50%;
    font-family: var(--font-display);
    font-weight: 700;
}

.message {
    grid-area: message;
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-size: var(--font-size-m);
}

/* The full text is readable on hover or keyboard focus (WCAG 1.4.10, 1.4.12). */
.job:is(:hover, :focus-visible) .message {
    display: block;
    overflow: visible;
    -webkit-line-clamp: unset;
    line-clamp: unset;
}

.odds {
    grid-area: odds;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-1);
    align-items: center;
}

.label,
.pct {
    color: var(--tier-color);
    font-weight: 700;
}

.pct {
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
}

.badge {
    padding: 0 var(--space-1);
    /* Keeps the badge outlined in forced colors, where backgrounds are dropped. */
    border: 1px solid transparent;
    border-radius: var(--radius);
    font-size: var(--font-size-xs);
    font-weight: 700;
}

.badge.best {
    background: var(--color-badge-best-bg);
    color: var(--color-badge-best-text);
}

.badge.trap {
    background: var(--color-badge-trap-bg);
    color: var(--color-badge-trap-text);
}

.badge.state-risk {
    background: var(--color-badge-state-bg);
    color: var(--color-badge-state-text);
}

/* Row stats: larger and bolder than the label, in the display font. */
.reward,
.expiry {
    display: flex;
    gap: var(--space-1);
    align-items: center;
    font-family: var(--font-display);
    font-size: var(--font-size-m);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.expiry {
    grid-area: expiry;
    justify-content: flex-end;
}

.stat-icon {
    color: var(--color-muted);
}

.note {
    padding: 0 var(--space-2);
    color: var(--color-muted);
    font-size: var(--font-size-s);
}

/* Wide rows: everything on one line, the message still clamped to two.
   64rem at the 10px root = 640px [V, Chrome, 2026-10-05]. */
@container job-row (min-width: 64rem) {
    .job {
        grid-template-areas: 'risk odds message expiry';
        grid-template-columns: auto minmax(0, 30rem) minmax(0, 1fr) 5rem;
        padding: var(--space-2) var(--space-3);
    }
}
</style>
