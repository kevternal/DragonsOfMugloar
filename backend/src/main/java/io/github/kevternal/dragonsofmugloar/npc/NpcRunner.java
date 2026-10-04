package io.github.kevternal.dragonsofmugloar.npc;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;

/** Plays one game on startup; defined in {@link NpcConfig} when {@code npc.enabled=true}. */
public class NpcRunner implements ApplicationRunner {

    private final GamePlayer player;

    public NpcRunner(GamePlayer player) {
        this.player = player;
    }

    @Override
    public void run(ApplicationArguments args) {
        player.play();
    }
}
