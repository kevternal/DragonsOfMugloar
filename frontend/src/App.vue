<script setup lang="ts">
import { nextTick } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { copy } from '@/copy'

// AD-15: focus moves to the new <h1> on route change (not on the first load).
const router = useRouter()
const route = useRoute()
router.afterEach((_to, from) => {
    if (from.name === undefined) return
    void nextTick(() => document.querySelector<HTMLElement>('h1')?.focus())
})
</script>

<template>
    <RouterView />
    <!-- The game screen shows the credits inside its grid, so they appear once (AD-14). -->
    <footer v-if="!route.meta.gameScreen" class="site-footer">{{ copy.credits }}</footer>
</template>
