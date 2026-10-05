<script lang="ts">
// game-icons.net art (CC BY 3.0; Lorc, Delapouite, Sbed, Skoll; credited in copy.credits). The
// black background square is stripped from each file; the shape is used as a mask over
// currentColor.
import breastplate from '@/assets/icons/breastplate.svg'
import cakeSlice from '@/assets/icons/cake-slice.svg'
import clawSlashes from '@/assets/icons/claw-slashes.svg'
import coins from '@/assets/icons/coins.svg'
import crossedClaws from '@/assets/icons/crossed-claws.svg'
import crown from '@/assets/icons/crown.svg'
import crownCoin from '@/assets/icons/crown-coin.svg'
import deathSkull from '@/assets/icons/death-skull.svg'
import fairyWings from '@/assets/icons/fairy-wings.svg'
import footprint from '@/assets/icons/footprint.svg'
import healthPotion from '@/assets/icons/health-potion.svg'
import heartDrop from '@/assets/icons/heart-drop.svg'
import hood from '@/assets/icons/hood.svg'
import hourglass from '@/assets/icons/hourglass.svg'
import jerrycan from '@/assets/icons/jerrycan.svg'
import levelFour from '@/assets/icons/level-four.svg'
import metalPlate from '@/assets/icons/metal-plate.svg'
import openTreasureChest from '@/assets/icons/open-treasure-chest.svg'
import person from '@/assets/icons/person.svg'
import rocket from '@/assets/icons/rocket.svg'
import rollingDices from '@/assets/icons/rolling-dices.svg'
import secretBook from '@/assets/icons/secret-book.svg'
import spellBook from '@/assets/icons/spell-book.svg'
import standingPotion from '@/assets/icons/standing-potion.svg'
import trophy from '@/assets/icons/trophy.svg'
import twoCoins from '@/assets/icons/two-coins.svg'

const ICONS = {
    breastplate,
    'cake-slice': cakeSlice,
    'claw-slashes': clawSlashes,
    coins,
    'crossed-claws': crossedClaws,
    crown,
    'crown-coin': crownCoin,
    'death-skull': deathSkull,
    'fairy-wings': fairyWings,
    footprint,
    'health-potion': healthPotion,
    'heart-drop': heartDrop,
    hood,
    hourglass,
    jerrycan,
    'level-four': levelFour,
    'metal-plate': metalPlate,
    'open-treasure-chest': openTreasureChest,
    person,
    rocket,
    'rolling-dices': rollingDices,
    'secret-book': secretBook,
    'spell-book': spellBook,
    'standing-potion': standingPotion,
    trophy,
    'two-coins': twoCoins,
} as const

export type IconName = keyof typeof ICONS
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: IconName }>()

// The URL is a bundled asset or an inlined data URI; never markup (AD-17). Vue adds the
// -webkit- prefix to the bound property where a browser needs it.
const style = computed(() => ({ maskImage: `url("${ICONS[props.name]}")` }))
</script>

<template>
    <!-- Decorative: the meaning is always in nearby text (AD-15). -->
    <span class="game-icon" aria-hidden="true" :style="style" />
</template>

<style scoped>
.game-icon {
    display: inline-block;
    flex: none;
    width: 1em;
    height: 1em;
    background-color: currentColor;
    vertical-align: -0.125em;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: contain;
}

/* Forced colors would repaint currentColor backgrounds as Canvas, hiding the icon (AD-14
   allows this preference query in components). */
@media (forced-colors: active) {
    .game-icon {
        forced-color-adjust: none;
        background-color: CanvasText;
    }
}
</style>
