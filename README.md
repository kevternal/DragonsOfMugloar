# Dragons of Mugloar

Two independent clients for [Dragons of Mugloar](https://dragonsofmugloar.com), a turn-based game played through a public web API:

- **`frontend/`**: a Vue 3 browser game for people. It shows the jobs board with the measured odds of every job, ranks the jobs and suggests shop items, and keeps your stats, reputation and an activity log on screen. It calls the API straight from the browser; there is no server of our own.
- **`backend/`**: a Spring Boot console bot (the NPC) that plays a whole game on its own with a fixed decision tree, printing every turn and writing each game to a history file.

They share no code and don't talk to each other. They share what was learned about the game: the API contract and the win rate measured for every odds label, in `_bmad-output/shared-mugloar-game/`. The browser's hints are a TypeScript port of the bot's decision tree.

## The game in brief

Each turn the player either solves one ad from a board of about ten, or buys one shop item. Both take a turn.

- **Ads** have a reward and a probability label such as "Piece of cake" or "Suicide mission". A win adds the reward to both score and gold. A loss costs one life. At 0 lives the game is over.
- **Healing potion**: 50 gold, +1 life.
- **Level items**: 100 gold for +1 level, or 300 gold for +2. They make ads easier. Right after a +2 purchase, about a quarter of the ads on the board move to an easier label; after a +1, about 3%.
- **Difficulty rises with every turn**, so a game is a race between the board getting harder and the dragon levelling up. Once the dragon is far enough ahead, every ad is "Sure thing" and the score grows without limit.
- **Reputation** (people, state, underworld) moves with the kind of job solved. Very low state brings bait ads that look safe but always fail.

## Docs

Open these in a browser:

- [frontend-architecture.html](frontend-architecture.html): the client's layers and how it talks to the API
- [backend-architecture.html](backend-architecture.html): how the bot is wired, runs and decides each move
- [game-loop.html](game-loop.html): one game from start to game over, in the bot and in the browser

## Quick start (only Docker needed)

From the repository root:

```sh
docker compose up --build web        # browser game on http://localhost:8080
docker compose run --rm --build npc  # the bot plays one game in this terminal
```

## Repository layout

- `frontend/`: Vue game client
- `backend/`: Spring Boot bot
- `_bmad-output/`: specs, architecture and plans: `initiative-game-client/` (frontend), `initiative-game-backend/` (backend), `shared-mugloar-game/` (external API contract and observed game values, used by both)

## Run the backend

The backend is a console app: a bot that plays one game of [Dragons of Mugloar](https://dragonsofmugloar.com) against the live API. It prints every turn and keeps a status panel pinned below the log.

### With Docker (only Docker needed)

From the repository root:

```sh
docker compose run --rm --build npc
```

The first run builds the image, which takes a minute or two. Later runs start in seconds.

- **Enter** pauses or resumes between turns. An idle game may expire after a few minutes.
- The bot plays until the game is lost, which can take a long time. **Ctrl+C** stops it at any time.
- Each game is also written to `backend/games-history/<start time>-<gameId>.txt`. Times are in UTC when run in Docker.

Use `run`, not `docker compose up`: `up` doesn't forward the keyboard, so Enter can't pause, and it prefixes every line, which breaks the status panel.

### Without Docker (JDK 25)

```sh
cd backend
./mvnw package -DskipTests
java -jar target/dragons-of-mugloar-0.0.1-SNAPSHOT.jar
```

Run the tests with `./mvnw test`. Settings (API URL, timeouts, retry delays, history folder) are in `backend/src/main/resources/application.yaml`.

## Run the frontend

Vue 3 + Vite + TypeScript frontend.

### With Docker (only Docker needed)

From the repository root:

```sh
docker compose up --build web
```

Opens on http://localhost:8080. The image builds the app and serves it with nginx. Stop it with `docker compose down`.

### Without Docker (Node and pnpm)

Needs Node `^22.18.0` or `>=24.12.0`, and pnpm.

```sh
cd frontend
pnpm install
pnpm dev
```

Opens on http://localhost:5173.

Build and other commands:

```sh
pnpm build
pnpm preview     # serves the build from dist/
pnpm test:unit   # unit tests (Vitest)
pnpm lint        # oxlint + ESLint
pnpm format      # Prettier
```

`pnpm build` type-checks, then builds to `dist/`.

## AI skills (BMAD)

We use the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) for spec-driven development: plan the feature first, then build it against that plan.

Installed skills:

- `bmad` – setup, help, status
- `bmod-method` – planning and build workflows
- `bmod-core-tools` – standalone tools

### Where they live

```
.agents/skills/      ← the real files
.claude/skills/      → symlinks to .agents/skills/
skills-lock.json     ← installed versions
```

### Install / update

```sh
npx skills add bmad-code-org/BMAD-METHOD -a claude-code --skill bmad --skill bmod-core-tools --skill bmod-method
```

Then ask Claude Code: `run bmad setup`. Run it again later to update.
