package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class RiskTest {

    private static Ad ad(String probability, int reward) {
        return new Ad("a", "m", reward, 3, probability, true);
    }

    @ParameterizedTest
    @CsvSource({
            "Piece of cake, SAFE, 1", "Sure thing, SAFE, 1",
            "Walk in the park, MODERATE, 2", "Quite likely, MODERATE, 2", "Hmmm...., MODERATE, 2",
            "Risky, RISKY, 3", "Gamble, RISKY, 3", "Rather detrimental, RISKY, 3",
            "Playing with fire, DEADLY, 4", "Suicide mission, DEADLY, 4", "Impossible, DEADLY, 4"})
    void everyObservedLabelHasItsTierAndLevel(String label, Risk.Tier tier, int level) {
        assertThat(Risk.riskTier(label)).isEqualTo(tier);
        assertThat(Risk.riskLevel(ad(label, 1))).isEqualTo(level);
    }

    @ParameterizedTest
    @CsvSource({
            "Sure thing, 100", "Piece of cake, 95", "Walk in the park, 87", "Quite likely, 72", "Hmmm...., 63",
            "Gamble, 55", "Risky, 41", "Rather detrimental, 37", "Playing with fire, 31", "Suicide mission, 6",
            "Impossible, 0"})
    void everyObservedLabelHasItsWinRate(String label, int pct) {
        assertThat(Risk.winPct(label)).isEqualTo(pct);
        assertThat(Risk.winPct(ad(label, 1))).isEqualTo(pct);
    }

    @Test
    void unknownLabelHasNoLevelAndScoresZero() {
        assertThat(Risk.riskTier("Totally new")).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.riskLevel(ad("Totally new", 10))).isNull();
        assertThat(Risk.winPct("Totally new")).isZero();
    }

    @Test
    void unsolvableAdIsUnknownAndScoresZero() {
        Ad encoded = new Ad("a", "m", 10, 3, "Sure thing", false);
        assertThat(Risk.riskTier(encoded)).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.winPct(encoded)).isZero();
    }
}
