package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.List;
import java.util.Locale;

/** What an ad's message says about it: bait, steal, and its effect on the state reputation. */
public final class AdKind {

    /**
     * Bait is worded "Steal super awesome diamond &lt;thing&gt; from &lt;person&gt;"; all 21 attempts failed
     * and cost a life [V] (strategy-findings.md, "Bait ads").
     */
    static final String BAIT_MARKER = "super awesome diamond";
    /** One successful steal lowers state by 2 [V]. */
    static final int STEAL_STATE_DELTA = -2;

    private AdKind() {
    }

    public static boolean isBait(Ad ad) {
        return ad.message() != null && ad.message().toLowerCase(Locale.ROOT).contains(BAIT_MARKER);
    }

    public static boolean isSteal(Ad ad) {
        return ad.message() != null && ad.message().startsWith("Steal");
    }

    public static long baitCount(List<Ad> board) {
        return board.stream().filter(AdKind::isBait).count();
    }

    /**
     * How one successful solve moves the state reputation, by message prefix: steal −2,
     * infiltrate +2, investigate +1, anything else 0. Exact over 183 reading intervals (R² = 1.00);
     * failed solves change nothing [V] (strategy-findings.md, "Why the tree looks like this").
     */
    public static int stateDelta(String message) {
        if (message == null) {
            return 0;
        }

        if (message.startsWith("Steal")) {
            return STEAL_STATE_DELTA;
        }

        if (message.startsWith("Infiltrate")) {
            return 2;
        }

        if (message.startsWith("Investigate")) {
            return 1;
        }

        return 0;
    }
}
