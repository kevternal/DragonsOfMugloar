<script setup lang="ts">
import { copy } from '@/copy'

defineProps<{ value: number | null }>()
</script>

<template>
    <!-- AD-11/AD-15: unknown is a short visual mark, with the word in text for speech. -->
    <template v-if="value !== null">{{ value }}</template>
    <template v-else>
        <span aria-hidden="true">{{ copy.stats.unknownShort }}</span>
        <span class="visually-hidden">{{ copy.stats.unknown }}</span>
    </template>
</template>
