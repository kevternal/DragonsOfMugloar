package io.github.kevternal.dragonsofmugloar.npc.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** {@code POST /game/start}: {@code {gameId, lives, gold, level, score, highScore, turn}} [V]. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StartDto(String gameId, int lives, int gold, int level, int score, int turn) {
}
