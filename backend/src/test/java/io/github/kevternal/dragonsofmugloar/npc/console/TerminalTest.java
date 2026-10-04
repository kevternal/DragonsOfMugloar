package io.github.kevternal.dragonsofmugloar.npc.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

class TerminalTest {

    private static final String ERASE_4 = "\r\u001B[4A\u001B[J";

    private static final TurnRecord SOLVE = new TurnRecord(TurnRecord.Kind.SOLVE, true,
            "Help defend the village (Piece of cake, 82)", "You successfully solved the mission!",
            new Stats(3, 79, 4, 818, 12), new Stats(3, 161, 4, 900, 13));
    private static final TurnRecord BUY = new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null,
            new Stats(2, 211, 4, 900, 13), new Stats(3, 161, 4, 900, 14));

    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

    private Terminal terminal(boolean ansi) {
        return new Terminal(new PrintStream(bytes, true, StandardCharsets.UTF_8), ansi);
    }

    private String output() {
        return bytes.toString(StandardCharsets.UTF_8);
    }

    private static String box(String... contents) {
        StringBuilder sb = new StringBuilder("┌" + "─".repeat(Terminal.PANEL_WIDTH + 2) + "┐\n");
        for (String content : contents) {
            sb.append("│ ").append(content).append(" ".repeat(Terminal.PANEL_WIDTH - content.length())).append(" │\n");
        }
        return sb.append("└").append("─".repeat(Terminal.PANEL_WIDTH + 2)).append("┘\n").toString();
    }

    @Test
    void entriesFollowThePlanShape() {
        assertThat(Terminal.formatEntry(SOLVE)).containsExactly(
                " ✓ Solve  Help defend the village (Piece of cake, 82)",
                "   You successfully solved the mission!",
                "   +82 gold");
        assertThat(Terminal.formatEntry(BUY)).containsExactly(" ✓ Buy    Healing potion", "   −50 gold, +1 life");
    }

    @Test
    void failedSolveShowsCrossAndLifeLoss() {
        List<String> entry = Terminal.formatEntry(new TurnRecord(TurnRecord.Kind.SOLVE, false, "Steal (Gamble, 40)",
                "You failed on the mission!", new Stats(3, 10, 0, 0, 1), new Stats(1, 10, 0, 0, 2)));
        assertThat(entry).containsExactly(" ✗ Solve  Steal (Gamble, 40)", "   You failed on the mission!", "   −2 lives");
    }

    @Test
    void zeroDeltasLeaveOutTheChangesLine() {
        assertThat(Terminal.formatEntry(new TurnRecord(TurnRecord.Kind.BUY, false, "Gasoline", null,
                new Stats(3, 10, 0, 0, 1), new Stats(3, 10, 0, 0, 2)))).containsExactly(" ✗ Buy    Gasoline");
    }

    @Test
    void ansiFramesEraseTheOldPanelThenPrintTheEntryThenTheNewPanel() {
        Terminal terminal = terminal(true);
        terminal.status(new Stats(3, 79, 4, 818, 12));
        terminal.log(SOLVE);

        String first = box("Turn 12     Lives 3    Level 4     Gold 79       Score 818", Terminal.RUNNING);
        String second = box("Turn 13     Lives 3    Level 4     Gold 161      Score 900", Terminal.RUNNING);
        assertThat(output()).isEqualTo(first + ERASE_4 + """
                 ✓ Solve  Help defend the village (Piece of cake, 82)
                   You successfully solved the mission!
                   +82 gold
                """ + second);
    }

    @Test
    void labelsKeepTheirColumnsAsNumbersGrow() {
        Terminal terminal = terminal(true);
        terminal.status(new Stats(3, 0, 1, 0, 1));
        String small = terminal.statsLine();
        terminal.status(new Stats(12, 123456, 1234, 12345678, 12345));
        String large = terminal.statsLine();
        for (String label : List.of("Lives", "Level", "Gold", "Score")) {
            assertThat(large.indexOf(label)).isEqualTo(small.indexOf(label));
        }
        assertThat(terminal.panelLines()).allSatisfy(line -> assertThat(line).hasSize(Terminal.PANEL_WIDTH + 4));
    }

    @Test
    void echoedEnterLinesAreCountedInTheNextErase() {
        Terminal terminal = terminal(true);
        terminal.status(new Stats(3, 0, 1, 0, 1));
        bytes.reset();

        terminal.toggled(true);
        // Height 4 plus 1 echoed line; the paused panel adds the idle warning, so it is 5 high.
        assertThat(output()).startsWith("\r\u001B[5A\u001B[J").contains(Terminal.PAUSED).contains(Terminal.IDLE_WARNING);
        bytes.reset();

        terminal.toggled(false);
        assertThat(output()).startsWith("\r\u001B[6A\u001B[J").contains(Terminal.RUNNING)
                .doesNotContain(Terminal.IDLE_WARNING);
        bytes.reset();

        terminal.log(BUY);
        // No Enter since the last draw: only the 4-line panel is erased.
        assertThat(output()).startsWith(ERASE_4 + " ✓ Buy    Healing potion\n");
    }

    @Test
    void enterBeforeAnyPanelIsNotCounted() {
        Terminal terminal = terminal(true);
        terminal.toggled(true);
        terminal.toggled(false);
        bytes.reset();
        terminal.status(new Stats(3, 0, 1, 0, 1));
        terminal.log(BUY);
        assertThat(output()).contains(ERASE_4).doesNotContain("\u001B[5A").doesNotContain("\u001B[6A");
    }

    @Test
    void closedInputDropsTheEnterHint() {
        Terminal terminal = terminal(true);
        terminal.status(new Stats(3, 0, 1, 0, 1));
        terminal.inputClosed();
        assertThat(output()).endsWith(box("Turn 1      Lives 3    Level 1     Gold 0        Score 0",
                Terminal.RUNNING_NO_PAUSE));
    }

    @Test
    void plainModeHasNoEscapeCodes() {
        Terminal terminal = terminal(false);
        terminal.status(new Stats(3, 79, 4, 818, 12));
        terminal.log(SOLVE);
        terminal.toggled(true);
        terminal.toggled(false);
        terminal.inputClosed();
        terminal.summary("game over", SOLVE.after(), 30);

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
        Terminal terminal = terminal(true);
        terminal.status(new Stats(0, 5, 7, 1234, 80));
        bytes.reset();
        terminal.summary("game over", new Stats(0, 5, 7, 1234, 80), 150);
        terminal.toggled(true);
        assertThat(output()).isEqualTo(ERASE_4
                + "Run ended: game over | score 1234 | turn 80 | level 7 | lives 0 | gold 5 | requests used 150\n");
    }

    @Test
    void summaryWithoutStats() {
        terminal(false).summary("error: NETWORK", null, 1);
        assertThat(output()).isEqualTo("Run ended: error: NETWORK | requests used 1\n");
    }

    private static final Clock START = Clock.fixed(Instant.parse("2026-10-04T14:05:09Z"), ZoneOffset.UTC);

    @Test
    void historyFileDuplicatesTheLogInPlainForm(@TempDir Path dir) throws IOException {
        Path historyDir = dir.resolve("games-history");
        Terminal terminal = new Terminal(new PrintStream(bytes, true, StandardCharsets.UTF_8), true, historyDir, START);
        terminal.status(SOLVE.before());
        terminal.startHistory("abc123");
        terminal.log(SOLVE);
        terminal.toggled(true);
        terminal.toggled(false);
        terminal.log(BUY);
        terminal.summary("game over", BUY.after(), 7);

        Path file = historyDir.resolve("2026-10-04_14-05-09-abc123.txt");
        assertThat(Files.readAllLines(file, StandardCharsets.UTF_8)).containsExactly(
                "Game abc123 | started 2026-10-04T14:05:09",
                "Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818",
                " ✓ Solve  Help defend the village (Piece of cake, 82)",
                "   You successfully solved the mission!",
                "   +82 gold",
                "Turn 13 | Lives 3 | Level 4 | Gold 161 | Score 900",
                " ✓ Buy    Healing potion",
                "   −50 gold, +1 life",
                "Turn 14 | Lives 3 | Level 4 | Gold 161 | Score 900",
                "Run ended: game over | score 900 | turn 14 | level 4 | lives 3 | gold 161 | requests used 7");
        // The terminal still drew its ANSI panel.
        assertThat(output()).contains("\u001B[");
    }

    @Test
    void baitLineGoesToTheTerminalAndTheHistory(@TempDir Path dir) throws IOException {
        Path historyDir = dir.resolve("games-history");
        Terminal terminal = new Terminal(new PrintStream(bytes, true, StandardCharsets.UTF_8), false, historyDir, START);
        terminal.status(SOLVE.before());
        terminal.startHistory("abc123");
        terminal.bait(2, -10);
        terminal.summary("game over", SOLVE.before(), 3);

        assertThat(Terminal.formatBait(1, 0)).isEqualTo(" ! Bait   1 ad on the board | state estimate 0");
        assertThat(output()).isEqualTo("""
                Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818 | ▶ running · Enter = pause
                 ! Bait   2 ads on the board | state estimate -10
                Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818 | ▶ running · Enter = pause
                Run ended: game over | score 818 | turn 12 | level 4 | lives 3 | gold 79 | requests used 3
                """);
        assertThat(Files.readAllLines(historyDir.resolve("2026-10-04_14-05-09-abc123.txt"), StandardCharsets.UTF_8))
                .containsExactly(
                        "Game abc123 | started 2026-10-04T14:05:09",
                        "Turn 12 | Lives 3 | Level 4 | Gold 79 | Score 818",
                        " ! Bait   2 ads on the board | state estimate -10",
                        "Run ended: game over | score 818 | turn 12 | level 4 | lives 3 | gold 79 | requests used 3");
    }

    @Test
    void noHistoryDirMeansNoFile(@TempDir Path dir) throws IOException {
        Terminal terminal = terminal(false);
        terminal.startHistory("abc123");
        terminal.summary("game over", BUY.after(), 1);
        try (var files = Files.list(dir)) {
            assertThat(files).isEmpty();
        }
    }

    @Test
    void unwritableHistoryWarnsOnceAndPlaysOn(@TempDir Path dir) throws IOException {
        Path notADir = Files.writeString(dir.resolve("games-history"), "a file, not a directory");
        Terminal terminal = new Terminal(new PrintStream(bytes, true, StandardCharsets.UTF_8), false, notADir, START);
        terminal.status(SOLVE.before());
        terminal.startHistory("abc123");
        terminal.log(SOLVE);
        terminal.summary("game over", SOLVE.after(), 3);

        assertThat(output()).containsOnlyOnce("Warning: no history file").contains("Run ended: game over");
        assertThat(Files.readString(notADir)).isEqualTo("a file, not a directory");
    }
}
