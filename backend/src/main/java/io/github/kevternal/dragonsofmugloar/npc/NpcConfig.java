package io.github.kevternal.dragonsofmugloar.npc;

import java.time.Clock;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarProperties;
import io.github.kevternal.dragonsofmugloar.npc.console.ConsoleView;
import io.github.kevternal.dragonsofmugloar.npc.console.HistoryLog;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;

/** The single wiring point of the NPC; tests build their own collaborators. */
@Configuration
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
@EnableConfigurationProperties({MugloarProperties.class, NpcProperties.class})
class NpcConfig {

    /** The builder comes from Boot, configured by {@code spring.http.clients.*}. */
    @Bean
    MugloarClient mugloarClient(RestClient.Builder builder, MugloarProperties properties) {
        return new MugloarClient(builder, properties, MugloarClient.Sleeper.REAL);
    }

    @Bean
    Clock clock() {
        return Clock.systemDefaultZone();
    }

    /** ANSI only when stdout is a terminal. */
    @Bean
    ConsoleView consoleView() {
        return new ConsoleView(System.out, ConsoleView.stdoutIsTerminal());
    }

    @Bean
    HistoryLog historyLog(NpcProperties properties, Clock clock, ConsoleView console) {
        return new HistoryLog(properties.historyDir(), clock, console::warn);
    }

    @Bean
    PauseControl pauseControl(ConsoleView console) {
        return new PauseControl(System.in, console);
    }

    /** Console first, then history: the status line prints before any history warning. */
    @Bean
    GamePlayer gamePlayer(MugloarClient client, PauseControl pause, ConsoleView console, HistoryLog history) {
        return new GamePlayer(client, pause, List.of(console, history));
    }

    @Bean
    NpcRunner npcRunner(GamePlayer player) {
        return new NpcRunner(player);
    }
}
