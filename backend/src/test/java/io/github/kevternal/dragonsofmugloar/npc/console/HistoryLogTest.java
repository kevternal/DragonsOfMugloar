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

import io.github.kevternal.dragonsofmugloar.npc.game.GameEvents;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/** The history file next to the console, wired as in production: console first, then history. */
class HistoryLogTest {

    private static final TurnRecord SOLVE = new TurnRecord(TurnRecord.Kind.SOLVE, true,
            "Help defend the village (Piece of cake, 82)", "You successfully solved the mission!",
            new Stats(3, 79, 4, 818, 12), new Stats(3, 161, 4, 900, 13));
    private static final TurnRecord BUY = new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null,
            new Stats(2, 211, 4, 900, 13), new Stats(3, 161, 4, 900, 14));
    private static final Clock START = Clock.fixed(Instant.parse("2026-10-04T14:05:09Z"), ZoneOffset.UTC);

    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

    private ConsoleView console(boolean ansi) {
        return new ConsoleView(new PrintStream(bytes, true, StandardCharsets.UTF_8), ansi);
    }

    /** Both views, reported to in production order. */
    private static GameEvents both(ConsoleView console, HistoryLog history) {
        List<GameEvents> events = List.of(console, history);
        return new GameEvents() {
            @Override
            public void started(String gameId, Stats stats) {
                events.forEach(e -> e.started(gameId, stats));
            }

            @Override
            public void turn(TurnRecord record) {
                events.forEach(e -> e.turn(record));
            }

            @Override
            public void bait(long count, int stateEstimate) {
                events.forEach(e -> e.bait(count, stateEstimate));
            }

            @Override
            public void ended(String reason, Stats stats, int requestsUsed) {
                events.forEach(e -> e.ended(reason, stats, requestsUsed));
            }
        };
    }

    private String output() {
        return bytes.toString(StandardCharsets.UTF_8);
    }

    @Test
    void historyFileDuplicatesTheLogInPlainForm(@TempDir Path dir) throws IOException {
        Path historyDir = dir.resolve("games-history");
        ConsoleView console = console(true);
        GameEvents events = both(console, new HistoryLog(historyDir, START, console::warn));
        events.started("abc123", SOLVE.before());
        events.turn(SOLVE);
        console.toggled(true);
        console.toggled(false);
        events.turn(BUY);
        events.ended("game over", BUY.after(), 7);

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
        ConsoleView console = console(false);
        GameEvents events = both(console, new HistoryLog(historyDir, START, console::warn));
        events.started("abc123", SOLVE.before());
        events.bait(2, -10);
        events.ended("game over", SOLVE.before(), 3);

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
    void unwritableHistoryWarnsOnceAndPlaysOn(@TempDir Path dir) throws IOException {
        Path notADir = Files.writeString(dir.resolve("games-history"), "a file, not a directory");
        ConsoleView console = console(false);
        GameEvents events = both(console, new HistoryLog(notADir, START, console::warn));
        events.started("abc123", SOLVE.before());
        events.turn(SOLVE);
        events.ended("game over", SOLVE.after(), 3);

        assertThat(output()).containsOnlyOnce("Warning: no history file").contains("Run ended: game over");
        assertThat(Files.readString(notADir)).isEqualTo("a file, not a directory");
    }
}
