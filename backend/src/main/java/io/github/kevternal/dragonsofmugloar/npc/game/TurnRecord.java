package io.github.kevternal.dragonsofmugloar.npc.game;

/**
 * What one turn-taking action did (AD-7), as a snapshot. {@code flavour} is the solve message, or
 * null for a buy.
 */
public record TurnRecord(Kind kind, boolean success, String action, String flavour, Stats before, Stats after) {

    public enum Kind { SOLVE, BUY }

    public int goldDelta() {
        return after.gold() - before.gold();
    }

    public int livesDelta() {
        return after.lives() - before.lives();
    }
}
