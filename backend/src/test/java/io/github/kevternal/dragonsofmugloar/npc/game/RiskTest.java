package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Test
    void unknownLabelHasNoLevelOrExpectedReward() {
        assertThat(Risk.riskTier("Totally new")).isEqualTo(Risk.Tier.UNKNOWN);
        assertThat(Risk.riskLevel(ad("Totally new", 10))).isNull();
        assertThat(Risk.expectedReward(ad("Totally new", 10))).isNull();
    }

    @Test
    void expectedRewardIsIntegerPercentScaled() {
        assertThat(Risk.expectedReward(ad("Sure thing", 82))).isEqualTo(8200);
        // 4 × 70 and 7 × 40 tie exactly; floats would not (AD-4).
        assertThat(Risk.expectedReward(ad("Quite likely", 4))).isEqualTo(Risk.expectedReward(ad("Gamble", 7)));
        assertThat(Risk.expectedReward(ad("Impossible", 100))).isEqualTo(1000);
    }

    @Test
    void winRateOutsideOneToFourIsRejected() {
        assertThatThrownBy(() -> Risk.winRatePct(5)).isInstanceOf(IllegalArgumentException.class);
    }
}
