package io.github.kevternal.dragonsofmugloar.npc;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;

/** The production collaborators of {@link NpcRunner}; tests build their own. */
@Configuration
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
class NpcConfig {

    @Bean
    MugloarClient mugloarClient() {
        return MugloarClient.create();
    }

    @Bean
    Terminal terminal() {
        return new Terminal();
    }

    @Bean
    PauseControl pauseControl() {
        return new PauseControl(System.in);
    }
}
