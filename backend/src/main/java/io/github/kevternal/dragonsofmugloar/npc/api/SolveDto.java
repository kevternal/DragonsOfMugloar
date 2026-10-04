package io.github.kevternal.dragonsofmugloar.npc.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * {@code POST /:gameId/solve/:adId}: {@code {success, lives, gold, score, highScore, turn, message}} [V].
 * No {@code level} [V]. Stat fields are nullable so an absent field leaves the stat unchanged.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SolveDto(boolean success, Integer lives, Integer gold, Integer score, Integer turn, String message) {
}
