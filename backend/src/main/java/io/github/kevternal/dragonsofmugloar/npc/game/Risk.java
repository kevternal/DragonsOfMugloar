package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.Map;

/** AD-4 risk mappings, from risk-cues.md and strategies.md. One label table; levels derive from tiers. */
public final class Risk {

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

    /** Safe 1, moderate 2, risky 3, deadly 4; null when unknown. */
    public static Integer riskLevel(Ad ad) {
        return switch (riskTier(ad)) {
            case SAFE -> 1;
            case MODERATE -> 2;
            case RISKY -> 3;
            case DEADLY -> 4;
            case UNKNOWN -> null;
        };
    }

    /** Integer percent, so comparisons have no float ties. 70 for level 2 is the user's choice. */
    public static int winRatePct(int level) {
        return switch (level) {
            case 1 -> 100;
            case 2 -> 70;
            case 3 -> 40;
            case 4 -> 10;
            default -> throw new IllegalArgumentException("Unknown risk level " + level);
        };
    }

    /** {@code reward × winRatePct}, percent-scaled; null when the risk is unknown. */
    public static Integer expectedReward(Ad ad) {
        Integer level = riskLevel(ad);
        return level == null ? null : ad.reward() * winRatePct(level);
    }
}
