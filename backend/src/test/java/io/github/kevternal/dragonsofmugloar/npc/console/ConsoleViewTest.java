package io.github.kevternal.dragonsofmugloar.npc.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

class ConsoleViewTest {

    private static final String ERASE_4 = "\r\u001B[4A\u001B[J";

    private static final TurnRecord SOLVE = new TurnRecord(TurnRecord.Kind.SOLVE, true,
            "Help defend the village (Piece of cake, 82)", "You successfully solved the mission!",
            new Stats(3, 79, 4, 818, 12), new Stats(3, 161, 4, 900, 13));
    private static final TurnRecord BUY = new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null,
            new Stats(2, 211, 4, 900, 13), new Stats(3, 161, 4, 900, 14));

    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

    private ConsoleView terminal(boolean ansi) {
        return new ConsoleView(new PrintStream(bytes, true, StandardCharsets.UTF_8), ansi);
    }

    private String output() {
        return bytes.toString(StandardCharsets.UTF_8);
    }

    private static String box(String... contents) {
        StringBuilder sb = new StringBuilder("┌" + "─".repeat(ConsoleFormat.PANEL_WIDTH + 2) + "┐\n");
        for (String content : contents) {
            sb.append("│ ").append(content).append(" ".repeat(ConsoleFormat.PANEL_WIDTH - content.length())).append(" │\n");
        }

        return sb.append("└").append("─".repeat(ConsoleFormat.PANEL_WIDTH + 2)).append("┘\n").toString();
    }

    @Test
    void ansiFramesEraseTheOldPanelThenPrintTheEntryThenTheNewPanel() {
        ConsoleView terminal = terminal(true);
        terminal.started("g1", new Stats(3, 79, 4, 818, 12));
        terminal.turn(SOLVE);

        String first = box("Turn 12     Lives 3    Level 4     Gold 79       Score 818", StatusPanel.RUNNING);
        String second = box("Turn 13     Lives 3    Level 4     Gold 161      Score 900", StatusPanel.RUNNING);
        assertThat(output()).isEqualTo(first + ERASE_4 + """
                 ✓ Solve  Help defend the village (Piece of cake, 82)
                   You successfully solved the mission!
                   +82 gold
                """ + second);
    }

    @Test
    void echoedEnterLinesAreCountedInTheNextErase() {
        ConsoleView terminal = terminal(true);
        terminal.started("g1", new Stats(3, 0, 1, 0, 1));
        bytes.reset();

        terminal.toggled(true);
        // Height 4 plus 1 echoed line; the paused panel adds the idle warning, so it is 5 high.
        assertThat(output()).startsWith("\r\u001B[5A\u001B[J").contains(StatusPanel.PAUSED).contains(StatusPanel.IDLE_WARNING);
        bytes.reset();

        terminal.toggled(false);
        assertThat(output()).startsWith("\r\u001B[6A\u001B[J").contains(StatusPanel.RUNNING)
                .doesNotContain(StatusPanel.IDLE_WARNING);
        bytes.reset();

        terminal.turn(BUY);
        // No Enter since the last draw: only the 4-line panel is erased.
        assertThat(output()).startsWith(ERASE_4 + " ✓ Buy    Healing potion\n");
    }

    @Test
    void enterBeforeAnyPanelIsNotCounted() {
        ConsoleView terminal = terminal(true);
        terminal.toggled(true);
        terminal.toggled(false);
        bytes.reset();
        terminal.started("g1", new Stats(3, 0, 1, 0, 1));
        terminal.turn(BUY);
        assertThat(output()).contains(ERASE_4).doesNotContain("\u001B[5A").doesNotContain("\u001B[6A");
    }

    @Test
    void closedInputDropsTheEnterHint() {
        ConsoleView terminal = terminal(true);
        terminal.started("g1", new Stats(3, 0, 1, 0, 1));
        terminal.inputClosed();
        assertThat(output()).endsWith(box("Turn 1      Lives 3    Level 1     Gold 0        Score 0",
                StatusPanel.RUNNING_NO_PAUSE));
    }

    @Test
    void plainModeHasNoEscapeCodes() {
        ConsoleView terminal = terminal(false);
        terminal.started("g1", new Stats(3, 79, 4, 818, 12));
        terminal.turn(SOLVE);
        terminal.toggled(true);
        terminal.toggled(false);
        terminal.inputClosed();
        terminal.ended("game over", SOLVE.after(), 30);

        assertThat(output()).doesNotContain("\u001B").isEqualTo("""
                Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818 | ▶ running · Enter = pause
                 ✓ Solve  Help defend the village (Piece of cake, 82)
                   You successfully solved the mission!
                   +82 gold
                Turn 13 | Lives 3 | Level 4 | Gold 161 | Score 900 | ▶ running · Enter = pause
                Turn 13 | Lives 3 | Level 4 | Gold 161 | Score 900 | ⏸ paused · Enter = resume · ! An idle game may expire after a few minutes
                Turn 13 | Lives 3 | Level 4 | Gold 161 | Score 900 | ▶ running · Enter = pause
                Run ended: game over | score 900 | turn 13 | level 4 | lives 3 | gold 161 | requests used 30
                """);
    }

    @Test
    void summaryErasesThePanelAndLaterTogglesDrawNothing() {
        ConsoleView terminal = terminal(true);
        terminal.started("g1", new Stats(0, 5, 7, 1234, 80));
        bytes.reset();
        terminal.ended("game over", new Stats(0, 5, 7, 1234, 80), 150);
        terminal.toggled(true);
        assertThat(output()).isEqualTo(ERASE_4
                + "Run ended: game over | score 1234 | turn 80 | level 7 | lives 0 | gold 5 | requests used 150\n");
    }

    @Test
    void summaryWithoutStats() {
        terminal(false).ended("error: NETWORK", null, 1);
        assertThat(output()).isEqualTo("Run ended: error: NETWORK | requests used 1\n");
    }

    @Test
    void warningPrintsOneLineAboveThePanel() {
        ConsoleView terminal = terminal(false);
        terminal.started("g1", SOLVE.before());
        terminal.warn("Warning: something");
        assertThat(output()).isEqualTo("""
                Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818 | ▶ running · Enter = pause
                Warning: something
                Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818 | ▶ running · Enter = pause
                """);
    }
}
