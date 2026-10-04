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
            "Piece of cake, SAFE", "Sure thing, SAFE",
            "Walk in the park, MODERATE", "Quite likely, MODERATE", "Hmmm...., MODERATE",
            "Risky, RISKY", "Gamble, RISKY", "Rather detrimental, RISKY",
            "Playing with fire, DEADLY", "Suicide mission, DEADLY", "Impossible, DEADLY"})
    void everyObservedLabelHasItsTier(String label, Risk.Tier tier) {
        assertThat(Risk.riskTier(label)).isEqualTo(tier);
        assertThat(Risk.riskTier(ad(label, 1))).isEqualTo(tier);
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
    void unknownLabelIsUnknownAndScoresZero() {
        assertThat(Risk.riskTier("Totally new")).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.riskTier(ad("Totally new", 10))).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.winPct("Totally new")).isZero();
    }

    @Test
    void unsolvableAdIsUnknownAndScoresZero() {
        Ad encoded = new Ad("a", "m", 10, 3, "Sure thing", false);
        assertThat(Risk.riskTier(encoded)).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.winPct(encoded)).isZero();
    }
}
