package io.github.kevternal.dragonsofmugloar.npc.game;

/**
 * A decoded ad (AD-3). {@code solvable} is false when {@code encrypted} held a value outside the
 * registry; such an ad keeps its raw fields and its risk tier is unknown.
 */
public record Ad(String adId, String message, int reward, int expiresIn, String probability, boolean solvable) {
}
