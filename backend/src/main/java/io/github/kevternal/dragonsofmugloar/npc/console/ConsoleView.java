package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.Console;
import java.io.PrintStream;
import java.util.List;

import io.github.kevternal.dragonsofmugloar.npc.game.GameEvents;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * The only stdout writer: shows turn entries, bait lines, warnings and the summary on the
 * {@link StatusPanel}. The text of every line comes from {@link ConsoleFormat}.
 *
 * <p>Methods are synchronized: the pause control calls in from its reader thread.
 */
public class ConsoleView implements GameEvents, PauseControl.Listener {

    private final StatusPanel panel;

    /** @param ansi draw the pinned panel with escape codes; otherwise print plain status lines */
    public ConsoleView(PrintStream out, boolean ansi) {
        this.panel = new StatusPanel(out, ansi);
    }

    /** True when stdout is an interactive terminal, so ANSI codes are safe. */
    public static boolean stdoutIsTerminal() {
        Console console = System.console();
        return console != null && console.isTerminal();
    }

    /** Sets the stats the panel shows and redraws it. */
    @Override
    public synchronized void started(String gameId, Stats stats) {
        panel.show(stats, List.of());
    }

    /** Prints one turn entry above the panel, then redraws the panel with the new stats. */
    @Override
    public synchronized void turn(TurnRecord record) {
        panel.show(record.after(), ConsoleFormat.formatEntry(record));
    }

    /** One line above the panel for a board that holds bait. */
    @Override
    public synchronized void bait(long count, int stateEstimate) {
        panel.show(List.of(ConsoleFormat.formatBait(count, stateEstimate)));
    }

    /** One line above the panel. */
    public synchronized void warn(String line) {
        panel.show(List.of(line));
    }

    @Override
    public synchronized void toggled(boolean paused) {
        panel.toggled(paused);
    }

    @Override
    public synchronized void inputClosed() {
        panel.inputClosed();
    }

    /** Erases the panel and prints the summary; later toggles draw nothing. */
    @Override
    public synchronized void ended(String reason, Stats stats, int requestsUsed) {
        panel.end(ConsoleFormat.formatSummary(reason, stats, requestsUsed));
    }
}
