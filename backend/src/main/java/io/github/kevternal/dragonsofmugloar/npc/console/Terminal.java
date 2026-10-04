package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.Console;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Path;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * The only stdout writer: sends turn entries, bait lines and the summary to the {@link StatusPanel}
 * and to the game's {@link HistoryFile}. The text of every line comes from {@link ConsoleFormat}.
 *
 * <p>Methods are synchronized: the pause control calls in from its reader thread.
 */
public class Terminal implements PauseControl.Listener {

    static final Path HISTORY_DIR = Path.of("games-history");

    private final StatusPanel panel;
    /** Where game files go; null turns the history file off. */
    private final Path historyDir;
    private final Clock clock;
    /** The current game's history file; null when none is open. */
    private HistoryFile history;

    /** Production: ANSI only when stdout is a terminal. */
    public Terminal() {
        this(System.out, isTerminal(), HISTORY_DIR, Clock.systemDefaultZone());
    }

    /** No history file. */
    public Terminal(PrintStream out, boolean ansi) {
        this(out, ansi, null, Clock.systemDefaultZone());
    }

    public Terminal(PrintStream out, boolean ansi, Path historyDir, Clock clock) {
        this.panel = new StatusPanel(out, ansi);
        this.historyDir = historyDir;
        this.clock = clock;
    }

    private static boolean isTerminal() {
        Console console = System.console();
        return console != null && console.isTerminal();
    }

    /** Opens the game's history file. If it can't be created, prints one warning and plays on without it. */
    public synchronized void startHistory(String gameId) {
        if (historyDir == null) {
            return;
        }

        LocalDateTime start = LocalDateTime.now(clock);
        try {
            history = HistoryFile.create(historyDir, gameId, start);
        } catch (IOException | RuntimeException e) {
            String name = HistoryFile.fileName(gameId, start);
            panel.show(List.of("Warning: no history file " + historyDir + "/" + name + " (" + e + ")"));
            return;
        }

        if (panel.stats() != null) {
            toHistory(List.of(ConsoleFormat.plainStats(panel.stats())));
        }
    }

    /** Sets the stats the panel shows and redraws it. */
    public synchronized void status(Stats stats) {
        panel.show(stats, List.of());
    }

    /** Prints one turn entry above the panel, then redraws the panel with the new stats. */
    public synchronized void log(TurnRecord record) {
        List<String> entry = ConsoleFormat.formatEntry(record);
        panel.show(record.after(), entry);
        List<String> lines = new ArrayList<>(entry);
        lines.add(ConsoleFormat.plainStats(record.after()));
        toHistory(lines);
    }

    /** One line above the panel, and in the history file, for a board that holds bait. */
    public synchronized void bait(long count, int stateEstimate) {
        List<String> line = List.of(ConsoleFormat.formatBait(count, stateEstimate));
        panel.show(line);
        toHistory(line);
    }

    @Override
    public synchronized void toggled(boolean paused) {
        panel.toggled(paused);
    }

    @Override
    public synchronized void inputClosed() {
        panel.inputClosed();
    }

    /** Erases the panel, prints the summary and closes the history file; later toggles draw nothing. */
    public synchronized void summary(String reason, Stats stats, int requestsUsed) {
        String line = ConsoleFormat.formatSummary(reason, stats, requestsUsed);
        panel.end(line);
        toHistory(List.of(line));
        if (history != null) {
            history.close();
            history = null;
        }
    }

    private void toHistory(List<String> lines) {
        if (history != null) {
            lines.forEach(history::println);
        }
    }
}
