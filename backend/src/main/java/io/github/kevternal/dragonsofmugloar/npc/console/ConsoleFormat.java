package io.github.kevternal.dragonsofmugloar.npc.console;

import java.util.ArrayList;
import java.util.List;
import java.util.function.ToIntFunction;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/** The text of every console and history line, as pure functions. */
final class ConsoleFormat {

    /** Inner width of the panel box; every field has a fixed position inside it. */
    static final int PANEL_WIDTH = 63;

    private ConsoleFormat() {
    }

    /** Fixed-width fields, so the labels never move when the numbers change; "-" before any stats. */
    static String statsLine(Stats stats) {
        return "Turn %-5s  Lives %-3s  Level %-4s  Gold %-7s  Score %-8s".formatted(
                value(stats, Stats::turn), value(stats, Stats::lives), value(stats, Stats::level),
                value(stats, Stats::gold), value(stats, Stats::score)).stripTrailing();
    }

    /** The stats line with " | " separators. */
    static String plainStats(Stats stats) {
        return statsLine(stats).replaceAll(" {2,}", " | ");
    }

    private static String value(Stats stats, ToIntFunction<Stats> field) {
        return stats == null ? "-" : Integer.toString(field.applyAsInt(stats));
    }

    /** A box around the rows, each padded to {@link #PANEL_WIDTH}. */
    static List<String> box(List<String> rows) {
        String rule = "─".repeat(PANEL_WIDTH + 2);
        List<String> lines = new ArrayList<>();
        lines.add("┌" + rule + "┐");
        rows.forEach(row -> lines.add("│ " + pad(row) + " │"));
        lines.add("└" + rule + "┘");
        return lines;
    }

    private static String pad(String content) {
        return content.length() >= PANEL_WIDTH ? content : content + " ".repeat(PANEL_WIDTH - content.length());
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

    static String formatBait(long count, int stateEstimate) {
        return " ! Bait   %d %s on the board | state estimate %d".formatted(count, count == 1 ? "ad" : "ads",
                stateEstimate);
    }

    /** The last line of a run; without stats only the request count. */
    static String formatSummary(String reason, Stats stats, int requestsUsed) {
        String body = stats == null
                ? "requests used " + requestsUsed
                : "score %d | turn %d | level %d | lives %d | gold %d | requests used %d".formatted(
                        stats.score(), stats.turn(), stats.level(), stats.lives(), stats.gold(), requestsUsed);
        return "Run ended: " + reason + " | " + body;
    }
}
