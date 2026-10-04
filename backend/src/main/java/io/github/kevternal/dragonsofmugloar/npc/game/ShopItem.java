package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.Map;

/**
 * One shop item from {@code GET /shop}. The list itself is never hard-coded; only each item's
 * effect is looked up by id, as the frontend's {@code itemEffect} does (AD-4).
 */
public record ShopItem(String id, String name, int cost) {

    private record Effect(int lives, int levels) {
    }

    // Copied from observed-values.md, "Shop items" [V 2026-10-01].
    private static final Map<String, Effect> EFFECTS = Map.ofEntries(
            Map.entry("hpot", new Effect(1, 0)),
            Map.entry("cs", new Effect(0, 1)),
            Map.entry("gas", new Effect(0, 1)),
            Map.entry("wax", new Effect(0, 1)),
            Map.entry("tricks", new Effect(0, 1)),
            Map.entry("wingpot", new Effect(0, 1)),
            Map.entry("ch", new Effect(0, 2)),
            Map.entry("rf", new Effect(0, 2)),
            Map.entry("iron", new Effect(0, 2)),
            Map.entry("mtrix", new Effect(0, 2)),
            Map.entry("wingpotmax", new Effect(0, 2)));

    private static final Effect NONE = new Effect(0, 0);

    /** Lives one purchase grants; 0 for an unlisted id. */
    public int livesGained() {
        return EFFECTS.getOrDefault(id, NONE).lives();
    }

    /** Levels one purchase grants; 0 for an unlisted id. */
    public int levelsGained() {
        return EFFECTS.getOrDefault(id, NONE).levels();
    }

    public boolean affordable(int gold) {
        return gold >= cost;
    }
}
