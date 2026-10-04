package io.github.kevternal.dragonsofmugloar.npc.game;

/**
 * What one game reports while it is played: the port its views implement. Called on the game thread,
 * in order: {@code started} once, then {@code turn} and {@code bait} as they happen, then {@code ended} once.
 */
public interface GameEvents {

    /** The game started with these stats. */
    void started(String gameId, Stats stats);

    /** A turn-taking action finished; its result has been applied. */
    void turn(TurnRecord record);

    /** The board just read holds {@code count} bait ads. */
    void bait(long count, int stateEstimate);

    /**
     * The run is over.
     *
     * @param stats null when the game never started
     */
    void ended(String reason, Stats stats, int requestsUsed);
}
