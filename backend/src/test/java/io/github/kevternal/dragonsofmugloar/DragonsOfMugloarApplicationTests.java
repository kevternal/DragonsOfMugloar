package io.github.kevternal.dragonsofmugloar;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import io.github.kevternal.dragonsofmugloar.npc.GamePlayer;
import io.github.kevternal.dragonsofmugloar.npc.NpcRunner;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.console.ConsoleView;
import io.github.kevternal.dragonsofmugloar.npc.console.HistoryLog;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;

@SpringBootTest(properties = "npc.enabled=false")
class DragonsOfMugloarApplicationTests {

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
    }

    @Test
    void npcDisabledCreatesNoNpcBean() {
        for (Class<?> type : new Class<?>[] {NpcRunner.class, GamePlayer.class, MugloarClient.class,
                ConsoleView.class, HistoryLog.class, PauseControl.class}) {
            assertThat(context.getBeanNamesForType(type)).as(type.getSimpleName()).isEmpty();
        }
    }

}
