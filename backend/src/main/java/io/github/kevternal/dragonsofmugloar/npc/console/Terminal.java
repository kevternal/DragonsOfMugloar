package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/** The only console I/O: activity-log lines, the summary, and the budget checkpoint prompt. */
public class Terminal {

    private final PrintStream out;
    private final BufferedReader in;

    public Terminal() {
        this(System.out, System.in);
    }

    public Terminal(PrintStream out, InputStream in) {
        this.out = out;
        this.in = new BufferedReader(new InputStreamReader(in, Charset.defaultCharset()));
    }

    /** Prints one activity-log line with the status suffix, plus the flavour line for a solve. */
    public void log(TurnRecord record) {
        out.println(formatLine(record));
        if (record.flavour() != null) {
            out.println("       " + record.flavour());
        }
        out.flush();
    }

    public void summary(String reason, Stats stats, int requestsUsed) {
        String body = stats == null
                ? "requests used " + requestsUsed
                : "score %d | turn %d | level %d | lives %d | gold %d | requests used %d".formatted(
                        stats.score(), stats.turn(), stats.level(), stats.lives(), stats.gold(), requestsUsed);
        out.println("Run ended: " + reason + " | " + body);
        out.flush();
    }

    /**
     * Asks whether to continue for {@code grant} more requests. Only "y" or "yes" continues; any
     * other answer, or EOF, declines.
     */
    public boolean confirmMore(int used, int grant) {
        out.println("Request budget reached (" + used + " used). An idle game may expire while you decide.");
        out.print("Continue for " + grant + " more requests? [y/N] ");
        out.flush();
        String answer;
        try {
            answer = in.readLine();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (answer == null) {
            out.println();
            return false;
        }
        String normalized = answer.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("y") || normalized.equals("yes");
    }

    /** CAP-12 shape: turn, mark, action, then the gold and lives changes, then the status suffix. */
    static String formatLine(TurnRecord record) {
        Stats after = record.after();
        return "%-5s%s %-7s%-43s  %-15s | lives %d | level %d | gold %d | score %d | turn %d".formatted(
                "T" + after.turn(),
                record.success() ? "✓" : "✗",
                record.kind() == TurnRecord.Kind.SOLVE ? "Solve" : "Buy",
                record.action(),
                formatDeltas(record),
                after.lives(), after.level(), after.gold(), after.score(), after.turn());
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
