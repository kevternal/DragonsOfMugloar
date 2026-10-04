package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.Console;
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
import java.util.function.ToIntFunction;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * The only stdout writer: turn entries, the status panel, and the summary.
 *
 * <p>In ANSI mode the panel is pinned below the log: each redraw moves the cursor up over the old
 * panel (plus any lines the terminal echoed for Enter presses since the last draw), clears to the end
 * of the screen, prints the new entry if any, then reprints the panel. In plain mode (stdout is not a
 * terminal) there are no escape codes: each entry is followed by one plain status line.
 *
 * <p>Each game is also written to a plain-text file in the history directory, for later analysis:
 * the starting status, every entry with its status line, and the summary. No escape codes and no
 * pause toggles.
 *
 * <p>Methods are synchronized: the pause control calls in from its reader thread.
 */
public class Terminal implements PauseControl.Listener {

    static final String ESC = "\u001B[";
    /** Inner width of the panel box; every field has a fixed position inside it. */
    static final int PANEL_WIDTH = 63;
    static final String RUNNING = "▶ running · Enter = pause";
    static final String PAUSED = "⏸ paused · Enter = resume";
    static final String RUNNING_NO_PAUSE = "▶ running · pause unavailable (stdin closed)";
    // Idle games expired somewhere between 5 and about 40 minutes [U] (api-contract.md, Game lifetime).
    static final String IDLE_WARNING = "! An idle game may expire after a few minutes";
    static final Path HISTORY_DIR = Path.of("games-history");
    static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    private final PrintStream out;
    private final boolean ansi;
    /** Where game files go; null turns the history file off. */
    private final Path historyDir;
    private final Clock clock;
    /** The current game's history file; null when none is open. */
    private PrintStream history;
    private Stats stats;
    private boolean paused;
    private boolean pauseAvailable = true;
    private boolean ended;
    /** Lines the panel occupies on screen right now; 0 when none is drawn. */
    private int drawnHeight;
    /** Enter presses echoed below the panel since it was drawn; each moved the cursor down a line. */
    private int echoedLines;

    /** Production: ANSI only when stdout is a terminal. */
    public Terminal() {
        this(System.out, isTerminal(), HISTORY_DIR, Clock.systemDefaultZone());
    }

    /** No history file. */
    public Terminal(PrintStream out, boolean ansi) {
        this(out, ansi, null, Clock.systemDefaultZone());
    }

    public Terminal(PrintStream out, boolean ansi, Path historyDir, Clock clock) {
        this.out = out;
        this.ansi = ansi;
        this.historyDir = historyDir;
        this.clock = clock;
    }

    private static boolean isTerminal() {
        Console console = System.console();
        return console != null && console.isTerminal();
    }

    /**
     * Opens {@code <start time>-<gameId>.txt} in the history directory and writes its header. If the
     * file can't be created, prints one warning and the game plays on without it.
     */
    public synchronized void startHistory(String gameId) {
        if (historyDir == null) {
            return;
        }
        LocalDateTime start = LocalDateTime.now(clock);
        String name = start.format(FILE_TIME) + "-" + gameId + ".txt";
        try {
            Path file = historyDir.resolve(name);
            Files.createDirectories(historyDir);
            history = new PrintStream(Files.newOutputStream(file), true, StandardCharsets.UTF_8);
        } catch (IOException | RuntimeException e) {
            erasePanel();
            out.println("Warning: no history file " + historyDir + "/" + name + " (" + e + ")");
            refresh(List.of());
            return;
        }
        history.println("Game " + gameId + " | started " + start.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        if (stats != null) {
            history.println(historyStatus());
        }
    }

    /** Sets the stats the panel shows and redraws it (plain mode: prints a status line). */
    public synchronized void status(Stats stats) {
        this.stats = stats;
        refresh(List.of());
    }

    /** Prints one turn entry above the panel, then redraws the panel with the new stats. */
    public synchronized void log(TurnRecord record) {
        this.stats = record.after();
        List<String> entry = formatEntry(record);
        refresh(entry);
        if (history != null) {
            entry.forEach(history::println);
            history.println(historyStatus());
        }
    }

    @Override
    public synchronized void toggled(boolean paused) {
        if (drawnHeight > 0) {
            echoedLines++;
        }
        this.paused = paused;
        refresh(List.of());
    }

    @Override
    public synchronized void inputClosed() {
        boolean wasPaused = paused;
        paused = false;
        pauseAvailable = false;
        // Plain mode prints only on a visible change, so a closed stdin adds no noise to the log.
        if (ansi || wasPaused) {
            refresh(List.of());
        }
    }

    /** Erases the panel and prints the summary; later toggles draw nothing. */
    public synchronized void summary(String reason, Stats stats, int requestsUsed) {
        erasePanel();
        ended = true;
        String body = stats == null
                ? "requests used " + requestsUsed
                : "score %d | turn %d | level %d | lives %d | gold %d | requests used %d".formatted(
                        stats.score(), stats.turn(), stats.level(), stats.lives(), stats.gold(), requestsUsed);
        out.println("Run ended: " + reason + " | " + body);
        out.flush();
        if (history != null) {
            history.println("Run ended: " + reason + " | " + body);
            history.close();
            history = null;
        }
    }

    private void refresh(List<String> entry) {
        if (ended) {
            return;
        }
        if (ansi) {
            erasePanel();
            entry.forEach(out::println);
            List<String> panel = panelLines();
            panel.forEach(out::println);
            drawnHeight = panel.size();
        } else {
            entry.forEach(out::println);
            out.println(plainStatus());
        }
        out.flush();
    }

    private void erasePanel() {
        if (ansi && drawnHeight > 0) {
            out.print("\r" + ESC + (drawnHeight + echoedLines) + "A" + ESC + "J");
        }
        drawnHeight = 0;
        echoedLines = 0;
    }

    /** The box: stats, state and, while paused, the idle warning. */
    List<String> panelLines() {
        List<String> lines = new ArrayList<>();
        String rule = "─".repeat(PANEL_WIDTH + 2);
        lines.add("┌" + rule + "┐");
        lines.add(boxed(statsLine()));
        lines.add(boxed(stateLine()));
        if (paused) {
            lines.add(boxed(IDLE_WARNING));
        }
        lines.add("└" + rule + "┘");
        return lines;
    }

    private static String boxed(String content) {
        return "│ " + pad(content) + " │";
    }

    private static String pad(String content) {
        return content.length() >= PANEL_WIDTH ? content : content + " ".repeat(PANEL_WIDTH - content.length());
    }

    /** Fixed-width fields, so the labels never move when the numbers change. */
    String statsLine() {
        return "Turn %-5s  Lives %-3s  Level %-4s  Gold %-7s  Score %-8s".formatted(
                value(Stats::turn), value(Stats::lives), value(Stats::level), value(Stats::gold),
                value(Stats::score)).stripTrailing();
    }

    private String value(ToIntFunction<Stats> field) {
        return stats == null ? "-" : Integer.toString(field.applyAsInt(stats));
    }

    private String stateLine() {
        if (paused) {
            return PAUSED;
        }
        return pauseAvailable ? RUNNING : RUNNING_NO_PAUSE;
    }

    /** The stats line with " | " separators, without the pause state. */
    String historyStatus() {
        return statsLine().replaceAll(" {2,}", " | ");
    }

    String plainStatus() {
        return statsLine().replaceAll(" {2,}", " | ") + " | " + stateLine() + (paused ? " · " + IDLE_WARNING : "");
    }

    /** Mark, kind and action; the flavour text (solves only); then the non-zero changes. */
    static List<String> formatEntry(TurnRecord record) {
        List<String> lines = new ArrayList<>();
        lines.add(" %s %-7s%s".formatted(
                record.success() ? "✓" : "✗",
                record.kind() == TurnRecord.Kind.SOLVE ? "Solve" : "Buy",
                record.action()));
        if (record.flavour() != null) {
            lines.add("   " + record.flavour());
        }
        String deltas = formatDeltas(record);
        if (!deltas.isEmpty()) {
            lines.add("   " + deltas);
        }
        return lines;
    }

    /** Only non-zero gold and lives changes, e.g. "+82 gold", "−50 gold, +1 life". */
    static String formatDeltas(TurnRecord record) {
        List<String> parts = new ArrayList<>();
        if (record.goldDelta() != 0) {
            parts.add(formatDelta(record.goldDelta(), "gold"));
        }
        if (record.livesDelta() != 0) {
            parts.add(formatDelta(record.livesDelta(), Math.abs(record.livesDelta()) == 1 ? "life" : "lives"));
        }
        return String.join(", ", parts);
    }

    /** Ported from the frontend's {@code formatDelta}: a real minus sign (U+2212). */
    private static String formatDelta(int value, String unit) {
        return (value > 0 ? "+" : "−") + Math.abs(value) + " " + unit;
    }
}
