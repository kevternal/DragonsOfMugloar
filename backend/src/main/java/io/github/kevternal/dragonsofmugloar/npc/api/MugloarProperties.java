package io.github.kevternal.dragonsofmugloar.npc.api;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The {@code mugloar.*} settings of {@link MugloarClient}.
 *
 * @param baseUrl     the API root
 * @param userAgent   sent on every request
 * @param retryDelays AD-18: the delays before each retry of {@code GET messages}
 */
@ConfigurationProperties("mugloar")
public record MugloarProperties(String baseUrl, String userAgent, List<Duration> retryDelays) {
}
