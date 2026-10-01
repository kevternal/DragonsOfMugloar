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
