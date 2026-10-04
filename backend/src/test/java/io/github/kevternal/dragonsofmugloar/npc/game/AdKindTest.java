package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AdKindTest {

    private static Ad ad(String message) {
        return new Ad("a", message, 10, 3, "Sure thing", true);
    }

    @Test
    void baitIsTheSuperAwesomeDiamondWording() {
        Ad bait = ad("Steal super awesome diamond necklace from Lord Hart");
        assertThat(AdKind.isBait(bait)).isTrue();
        assertThat(AdKind.isSteal(bait)).isTrue();
        assertThat(AdKind.isBait(ad("Steal cows delivery to Ann and share some of the profits"))).isFalse();
        assertThat(AdKind.baitCount(List.of(bait, ad("Help"), bait))).isEqualTo(2);
    }

    @Test
    void stealIsTheMessagePrefix() {
        assertThat(AdKind.isSteal(ad("Steal cows delivery to Ann"))).isTrue();
        assertThat(AdKind.isSteal(ad("Help Ann steal back her cows"))).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "Steal cows delivery to Ann, -2", "Infiltrate the keep, 2", "Investigate the dungeon, 1",
            "Help defending the fort, 0"})
    void stateDeltaByPrefix(String message, int delta) {
        assertThat(AdKind.stateDelta(message)).isEqualTo(delta);
    }

    @Test
    void nullMessageIsNothing() {
        assertThat(AdKind.stateDelta(null)).isZero();
        assertThat(AdKind.isBait(ad(null))).isFalse();
        assertThat(AdKind.isSteal(ad(null))).isFalse();
    }
}
