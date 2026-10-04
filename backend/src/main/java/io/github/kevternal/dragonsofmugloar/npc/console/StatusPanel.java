package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;

/**
 * The screen: log lines with the status panel below them.
 *
 * <p>In ANSI mode the panel is pinned below the log: each redraw moves the cursor up over the old
 * panel (plus any lines the terminal echoed for Enter presses since the last draw), clears to the end
 * of the screen, prints the new lines if any, then reprints the panel. In plain mode (stdout is not a
 * terminal) there are no escape codes: the lines are followed by one plain status line.
 *
 * <p>Not thread-safe; {@link Terminal} synchronizes every call.
 */
final class StatusPanel {

    static final String ESC = "\u001B[";
    static final String RUNNING = "▶ running · Enter = pause";
    static final String PAUSED = "⏸ paused · Enter = resume";
    static final String RUNNING_NO_PAUSE = "▶ running · pause unavailable (stdin closed)";
    // Idle games expired somewhere between 5 and about 40 minutes [U] (api-contract.md, Game lifetime).
    static final String IDLE_WARNING = "! An idle game may expire after a few minutes";

    private final PrintStream out;
    private final boolean ansi;
    private Stats stats;
    private boolean paused;
    private boolean pauseAvailable = true;
    private boolean ended;
    /** Lines the panel occupies on screen right now; 0 when none is drawn. */
    private int drawnHeight;
    /** Enter presses echoed below the panel since it was drawn; each moved the cursor down a line. */
    private int echoedLines;

    StatusPanel(PrintStream out, boolean ansi) {
        this.out = out;
        this.ansi = ansi;
    }

    Stats stats() {
        return stats;
    }

    /** Prints the lines, then the panel with the new stats. */
    void show(Stats stats, List<String> lines) {
        this.stats = stats;
        show(lines);
    }

    /** Prints the lines above the panel, then redraws it (plain mode: prints a status line). */
    void show(List<String> lines) {
        if (ended) {
            return;
        }

        if (ansi) {
            erase();
            lines.forEach(out::println);
            List<String> panel = lines();
            panel.forEach(out::println);
            drawnHeight = panel.size();
        } else {
            lines.forEach(out::println);
            out.println(plainStatus());
        }

        out.flush();
    }

    void toggled(boolean paused) {
        if (drawnHeight > 0) {
            echoedLines++;
        }

        this.paused = paused;
        show(List.of());
    }

    void inputClosed() {
        boolean wasPaused = paused;
        paused = false;
        pauseAvailable = false;
        // Plain mode prints only on a visible change, so a closed stdin adds no noise to the log.
        if (ansi || wasPaused) {
            show(List.of());
        }
    }

    /** Prints a line where the panel was, and draws no panel from now on. */
    void end(String line) {
        erase();
        ended = true;
        out.println(line);
        out.flush();
    }

    /** The box: stats, state and, while paused, the idle warning. */
    List<String> lines() {
        List<String> rows = new ArrayList<>(List.of(ConsoleFormat.statsLine(stats), stateLine()));
        if (paused) {
            rows.add(IDLE_WARNING);
        }

        return ConsoleFormat.box(rows);
    }

    private void erase() {
        if (ansi && drawnHeight > 0) {
            out.print("\r" + ESC + (drawnHeight + echoedLines) + "A" + ESC + "J");
        }

        drawnHeight = 0;
        echoedLines = 0;
    }

    private String plainStatus() {
        return ConsoleFormat.plainStats(stats) + " | " + stateLine() + (paused ? " · " + IDLE_WARNING : "");
    }

    private String stateLine() {
        if (paused) {
            return PAUSED;
        }

        return pauseAvailable ? RUNNING : RUNNING_NO_PAUSE;
    }
}
