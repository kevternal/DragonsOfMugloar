package io.github.kevternal.dragonsofmugloar.npc;

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The {@code npc.*} settings.
 *
 * @param historyDir where each game's history file goes
 */
@ConfigurationProperties("npc")
record NpcProperties(Path historyDir) {
}
