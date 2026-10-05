<script setup lang="ts">
import { computed, useId } from 'vue'
import { copy } from '@/copy'
import { rewardTier, urgency } from '@/game/job-cues'
import type { JobFlag, RankedJob, RewardTier, RiskTier } from '@/game/types'
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

// The gold grows with the reward (approved preview, design-assets.md).
const REWARD_ICONS: Record<RewardTier, IconName> = {
    small: 'crown-coin',
    medium: 'coins',
    large: 'open-treasure-chest',
}

type BadgeKind = 'best' | JobFlag

const BADGE_TEXT: Record<BadgeKind, string> = {
    best: copy.jobs.bestPick,
    trap: copy.jobs.trap,
    'state-risk': copy.jobs.stateRisk,
}

const icon = computed(() => (job.tier === 'unknown' ? null : TIER_ICONS[job.tier]))

const reward = computed(() => rewardTier(job.ad.reward))

const expiry = computed(() => urgency(job.ad.expiresIn))

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
        <!-- CAP-16: one native button per job. Its content forms the name in visual order, decisive
             cues first: "Solve: 340 gold, safe, Piece of cake, 95%, Best pick. <ad>. 2 turns left,
             soon". -->
        <button
            type="button"
            class="job"
            :class="[`tier-${job.tier}`, { best: job.best }]"
            :disabled="disabled || !job.ad.solvable"
            :aria-describedby="job.ad.solvable ? undefined : noteId"
            @click="$emit('solve', job.ad.adId)"
        >
            <span class="reward" :class="`reward-${reward}`">
                <span class="visually-hidden">{{ copy.jobs.solve }}</span>
                <GameIcon :name="REWARD_ICONS[reward]" class="reward-icon" />{{ job.ad.reward
                }}<span class="visually-hidden">{{ copy.jobs.gold }}{{ copy.separator }}</span>
            </span>
            <span class="risk" aria-hidden="true">
                <GameIcon v-if="icon" :name="icon" class="risk-icon" />
                <span v-else class="risk-icon unknown-mark">{{ copy.stats.unknownShort }}</span>
            </span>
            <span class="odds">
                <span class="visually-hidden">{{ copy.jobs.tier[job.tier] }}</span>
                <span class="label">{{ job.ad.probability }}</span>
                <span class="visually-hidden">{{ copy.separator }}</span>
                <span class="pct">{{ oddsText }}</span>
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
            <span class="expiry" :class="`urgency-${expiry}`">
                <GameIcon name="hourglass" />{{ job.ad.expiresIn
                }}<span class="visually-hidden"
                    >{{ copy.jobs.turnsLeft(job.ad.expiresIn)
                    }}{{ copy.jobs.urgency[expiry] }}</span
                >
            </span>
        </button>
        <p v-if="!job.ad.solvable" :id="noteId" class="note">{{ copy.ads.unsolvable }}</p>
    </div>
</template>

<style scoped>
.job-row {
    container: job-row / inline-size;
}

/* Narrow: gold | icon | odds and badges | expiry, over gold | icon | message (two lines) |
   expiry. The gold, icon and expiry span both lines, so they centre on the row. */
.job {
    /* Contains the visually hidden name parts. */
    position: relative;
    display: grid;
    grid-template-areas:
        'reward risk odds expiry'
        'reward risk message expiry';
    grid-template-columns: auto auto minmax(0, 1fr) auto;
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

/* Narrow: the coin sits over the number, so the column stays slim; the same width on every
   row keeps the icons in line. */
.reward {
    grid-area: reward;
    flex-direction: column;
    gap: 0;
    min-width: 4.4rem;
    color: var(--color-gold);
}

/* The icon grows slightly with the reward; em follows the stat's font size (AD-14). */
.reward-icon {
    font-size: 1.2em;
}

.reward-medium .reward-icon {
    font-size: 1.35em;
}

.reward-large .reward-icon {
    font-size: 1.5em;
}

/* Text colour only: the hidden text also states the urgency (AD-15). */
.expiry {
    grid-area: expiry;
    justify-content: flex-end;
}

.urgency-critical {
    color: var(--color-urgency-critical);
}

.urgency-soon {
    color: var(--color-urgency-soon);
}

.urgency-normal {
    color: var(--color-urgency-normal);
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
        grid-template-areas: 'reward risk odds message expiry';
        grid-template-columns: 8rem auto minmax(0, 30rem) minmax(0, 1fr) 5rem;
        padding: var(--space-2) var(--space-3);
    }

    .reward {
        flex-direction: row;
        gap: var(--space-1);
    }
}
</style>
