<script setup lang="ts">
import { nextTick } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { copy } from '@/copy'

// AD-15: focus moves to the new <h1> on route change (not on the first load).
const router = useRouter()
router.afterEach((_to, from) => {
    if (from.name === undefined) return
    void nextTick(() => document.querySelector<HTMLElement>('h1')?.focus())
})
</script>

<template>
    <RouterView />
    <footer class="site-footer">{{ copy.footer }}</footer>
</template>
