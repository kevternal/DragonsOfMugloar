<script setup lang="ts">
import { copy } from '@/copy'

defineProps<{ refreshing: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
    <div class="notice">
        <p v-if="refreshing">{{ copy.board.refreshing }}</p>
        <template v-else>
            <p>{{ copy.board.notice }}</p>
            <button type="button" @click="$emit('retry')">{{ copy.board.retry }}</button>
        </template>
    </div>
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
</style>
