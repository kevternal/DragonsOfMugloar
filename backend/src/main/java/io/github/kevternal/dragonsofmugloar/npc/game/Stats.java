package io.github.kevternal.dragonsofmugloar.npc.game;

/** The player's stats. Start returns all of them; solve and buy return some (api-contract.md). */
public record Stats(int lives, int gold, int level, int score, int turn) {

    /** Ported from the frontend's {@code applyTurn}: only fields present (non-null) change. */
    public Stats merge(Integer lives, Integer gold, Integer level, Integer score, Integer turn) {
        return new Stats(
                lives != null ? lives : this.lives,
                gold != null ? gold : this.gold,
                level != null ? level : this.level,
                score != null ? score : this.score,
                turn != null ? turn : this.turn);
    }
}
