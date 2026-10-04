package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import io.github.kevternal.dragonsofmugloar.npc.game.GameEvents;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * Each game written to a plain-text file, for later analysis: no escape codes and no pause toggles.
 * Named {@code <start time>-<gameId>.txt}. If the file can't be created, one warning goes out and
 * the game plays on without it.
 *
 * <p>Not thread-safe: only the game thread calls it.
 */
public class HistoryLog implements GameEvents {

    static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    private final Path dir;
    private final Clock clock;
    private final Consumer<String> warn;
    /** The current game's file; null when none is open. */
    private PrintStream out;

    /** @param warn shows the one line about a file that couldn't be created */
    public HistoryLog(Path dir, Clock clock, Consumer<String> warn) {
        this.dir = dir;
        this.clock = clock;
        this.warn = warn;
    }

    static String fileName(String gameId, LocalDateTime start) {
        return start.format(FILE_TIME) + "-" + gameId + ".txt";
    }

    /** Creates the directory and the file, and writes the header and the start stats. */
    @Override
    public void started(String gameId, Stats stats) {
        LocalDateTime start = LocalDateTime.now(clock);
        String name = fileName(gameId, start);
        try {
            Files.createDirectories(dir);
            out = new PrintStream(Files.newOutputStream(dir.resolve(name)), true, StandardCharsets.UTF_8);
        } catch (IOException | RuntimeException e) {
            warn.accept("Warning: no history file " + dir + "/" + name + " (" + e + ")");
            return;
        }

        out.println("Game " + gameId + " | started " + start.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        out.println(ConsoleFormat.plainStats(stats));
    }

    @Override
    public void turn(TurnRecord record) {
        List<String> lines = new ArrayList<>(ConsoleFormat.formatEntry(record));
        lines.add(ConsoleFormat.plainStats(record.after()));
        write(lines);
    }

    @Override
    public void bait(long count, int stateEstimate) {
        write(List.of(ConsoleFormat.formatBait(count, stateEstimate)));
    }

    /** Writes the summary and closes the file. */
    @Override
    public void ended(String reason, Stats stats, int requestsUsed) {
        write(List.of(ConsoleFormat.formatSummary(reason, stats, requestsUsed)));
        if (out != null) {
            out.close();
            out = null;
        }
    }

    private void write(List<String> lines) {
        if (out != null) {
            lines.forEach(out::println);
        }
    }
}
