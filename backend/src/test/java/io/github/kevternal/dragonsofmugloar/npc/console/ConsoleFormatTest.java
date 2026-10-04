package io.github.kevternal.dragonsofmugloar.npc.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

class ConsoleFormatTest {

    private static final TurnRecord SOLVE = new TurnRecord(TurnRecord.Kind.SOLVE, true,
            "Help defend the village (Piece of cake, 82)", "You successfully solved the mission!",
            new Stats(3, 79, 4, 818, 12), new Stats(3, 161, 4, 900, 13));
    private static final TurnRecord BUY = new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null,
            new Stats(2, 211, 4, 900, 13), new Stats(3, 161, 4, 900, 14));

    @Test
    void entriesFollowThePlanShape() {
        assertThat(ConsoleFormat.formatEntry(SOLVE)).containsExactly(
                " ✓ Solve  Help defend the village (Piece of cake, 82)",
                "   You successfully solved the mission!",
                "   +82 gold");
        assertThat(ConsoleFormat.formatEntry(BUY)).containsExactly(" ✓ Buy    Healing potion", "   −50 gold, +1 life");
    }

    @Test
    void failedSolveShowsCrossAndLifeLoss() {
        List<String> entry = ConsoleFormat.formatEntry(new TurnRecord(TurnRecord.Kind.SOLVE, false,
                "Steal (Gamble, 40)", "You failed on the mission!", new Stats(3, 10, 0, 0, 1),
                new Stats(1, 10, 0, 0, 2)));
        assertThat(entry).containsExactly(" ✗ Solve  Steal (Gamble, 40)", "   You failed on the mission!", "   −2 lives");
    }

    @Test
    void zeroDeltasLeaveOutTheChangesLine() {
        assertThat(ConsoleFormat.formatEntry(new TurnRecord(TurnRecord.Kind.BUY, false, "Gasoline", null,
                new Stats(3, 10, 0, 0, 1), new Stats(3, 10, 0, 0, 2)))).containsExactly(" ✗ Buy    Gasoline");
    }

    @Test
    void labelsKeepTheirColumnsAsNumbersGrow() {
        String small = ConsoleFormat.statsLine(new Stats(3, 0, 1, 0, 1));
        String large = ConsoleFormat.statsLine(new Stats(12, 123456, 1234, 12345678, 12345));
        for (String label : List.of("Lives", "Level", "Gold", "Score")) {
            assertThat(large.indexOf(label)).isEqualTo(small.indexOf(label));
        }

        assertThat(ConsoleFormat.box(List.of(large, StatusPanel.RUNNING_NO_PAUSE)))
                .allSatisfy(line -> assertThat(line).hasSize(ConsoleFormat.PANEL_WIDTH + 4));
    }

    @Test
    void baitLineUsesTheSingularForOneAd() {
        assertThat(ConsoleFormat.formatBait(1, 0)).isEqualTo(" ! Bait   1 ad on the board | state estimate 0");
    }
}
