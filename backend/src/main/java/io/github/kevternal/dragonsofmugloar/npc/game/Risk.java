package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.Map;

/** AD-4 risk mappings, from risk-cues.md and strategies.md. */
public final class Risk {

    /** Declared safest first, so the natural order ranks tiers with unknown last. */
    public enum Tier { SAFE, MODERATE, RISKY, DEADLY, UNKNOWN }

    // Tier membership comes from measured win rates [V] (observed-values.md); the boundaries are design choices.
    private static final Map<String, Tier> TIERS = Map.ofEntries(
            Map.entry("Piece of cake", Tier.SAFE),
            Map.entry("Sure thing", Tier.SAFE),
            Map.entry("Walk in the park", Tier.MODERATE),
            Map.entry("Quite likely", Tier.MODERATE),
            Map.entry("Hmmm....", Tier.MODERATE),
            Map.entry("Risky", Tier.RISKY),
            Map.entry("Gamble", Tier.RISKY),
            Map.entry("Rather detrimental", Tier.RISKY),
            Map.entry("Playing with fire", Tier.DEADLY),
            Map.entry("Suicide mission", Tier.DEADLY),
            Map.entry("Impossible", Tier.DEADLY));

    private Risk() {
    }

    public static Tier riskTier(String probability) {
        return TIERS.getOrDefault(probability, Tier.UNKNOWN);
    }

    /** An unsolvable ad's fields are still encoded, so its tier is unknown (AD-3). */
    public static Tier riskTier(Ad ad) {
        return ad.solvable() ? riskTier(ad.probability()) : Tier.UNKNOWN;
    }

    // Win rate per label in integer percent, from 5,257 non-bait live solves on 2026-10-04 [V]
    // (strategy-findings.md, "Win rate per label, refreshed [V, 2026-10-04]").
    private static final Map<String, Integer> WIN_PCT = Map.ofEntries(
            Map.entry("Sure thing", 100),
            Map.entry("Piece of cake", 95),
            Map.entry("Walk in the park", 87),
            Map.entry("Quite likely", 72),
            Map.entry("Hmmm....", 63),
            Map.entry("Gamble", 55),
            Map.entry("Risky", 41),
            Map.entry("Rather detrimental", 37),
            Map.entry("Playing with fire", 31),
            Map.entry("Suicide mission", 6),
            Map.entry("Impossible", 0));

    /** Integer percent, so comparisons have no float ties; 0 for an unknown label. */
    public static int winPct(String probability) {
        return WIN_PCT.getOrDefault(probability, 0);
    }

    /** An unsolvable ad's label is still encoded, so it scores 0. */
    public static int winPct(Ad ad) {
        return ad.solvable() ? winPct(ad.probability()) : 0;
    }
}
