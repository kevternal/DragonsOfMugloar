# Design assets (bonus)

**Tags:** **[V]** means the licence was checked at its source on 2026-10-01. The font and icon picks themselves are design choices.

## Fonts

Both fonts are self-hosted through `@fontsource-variable/fredoka` and `@fontsource-variable/nunito` (5.3.0 [V npm 2026-10-01]), never loaded with a Google Fonts link. That's a user decision: no third-party request at runtime.

- **Fredoka**: a rounded display sans for headings, stats, and numbers. It gives a playful, game-like feel. SIL OFL 1.1 [V: google/fonts `ofl/fredoka/OFL.txt`]
- **Nunito**: a rounded sans for body text and ad messages. It stays readable at small sizes. SIL OFL 1.1 [V: google/fonts `ofl/nunito/OFL.txt`]

## Icons

- **game-icons.net**: themed art such as the dragon, coins, hearts, potions, and skulls. Creative Commons 3.0 BY; **attribution is required**, so credit each icon's author as well as the site, in the footer or on an about page. [V: game-icons.net/about.html]
- **Lucide** (`@lucide/vue`; `lucide-vue-next` is deprecated [V npm]): UI glyphs such as clock or hourglass for urgency, cart, refresh, and close. ISC License [V: lucide-icons/lucide `LICENSE`]

Icons are imported per glyph, never as a whole icon font, so the bundle stays small. (Design choice.)

## Approved set [V 2026-10-02]

The user approved the preview at https://claude.ai/artifact/6sw4rvS41Em1TMQUhJyr1q. The SVGs were fetched from github.com/game-icons/icons master and unpkg lucide-static 1.50.0.

### game-icons.net themed icons

| Use | Icon (author/name) |
|---|---|
| Lives | lorc/heart-drop |
| Gold | delapouite/two-coins |
| Score | lorc/trophy |
| Turn / expires | lorc/hourglass |
| Level | sbed/level-four |
| Dragon | lorc/dragon-head |
| Jobs | lorc/scroll-unfurled |
| Shop | delapouite/shop |
| Shop sign | delapouite/tavern-sign |
| Tavern notice | lorc/beer-stein |
| Risk 1 to 4 | lorc/cake-slice, lorc/footprint, delapouite/rolling-dices, sbed/death-skull |
| Reputation: people, state, underworld | delapouite/person, lorc/crown, lorc/hood |

### Job reward tiers [V 2026-10-05, user-approved preview https://claude.ai/artifact/1SGWmrcxGGPXEAZXjPjV62]

The gold on a job row grows with the reward (`rewardTier` in `src/game/job-cues.ts`). Skoll joins the credited authors.

| Reward | Icon (author/name) |
|---|---|
| under 100 | lorc/crown-coin |
| 100 to 999 | delapouite/coins |
| 1000 and up | skoll/open-treasure-chest |

### Shop items

| Item | Icon |
|---|---|
| hpot | delapouite/health-potion |
| cs | lorc/claw-slashes |
| gas | delapouite/jerrycan |
| wax | delapouite/metal-plate |
| tricks | delapouite/secret-book |
| wingpot | lorc/standing-potion |
| ch | lorc/crossed-claws |
| rf | lorc/rocket |
| iron | lorc/breastplate |
| mtrix | delapouite/spell-book |
| wingpotmax | delapouite/fairy-wings [implementation choice 2026-10-05; author on the approved list; not in the approved preview] |

### Notes

The game-icons SVGs ship with a black square background path. Strip it and fill the icon with `currentColor`.

Lucide icons are used for UI glyphs: check, x, refresh-cw, triangle-alert and info.

The credit line is visible on every screen and names Lorc, Delapouite, Sbed and Skoll, game-icons.net and CC BY 3.0.
