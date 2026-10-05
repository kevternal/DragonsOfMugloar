# Dragons of Mugloar

- `frontend/` – Vue game client
- `backend/` – Spring Boot backend
- `_bmad-output/` – specs, architecture and plans: `initiative-game-client/` (frontend), `initiative-game-backend/` (backend), `shared-mugloar-game/` (external API contract and observed game values, used by both)

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

## Run the Frontend

Vue 3 + Vite + TypeScript frontend.

### Requirements

- Node `^22.18.0` or `>=24.12.0`
- pnpm

### Run

```sh
cd frontend
pnpm install
pnpm dev
```

Opens on http://localhost:5173.

### Build

```sh
pnpm build
```

Type-checks and builds to `dist/`. Preview the build with `pnpm preview`.

### Other commands

```sh
pnpm test:unit   # unit tests (Vitest)
pnpm lint        # oxlint + ESLint
pnpm format      # Prettier
```

AI skills (BMAD), specs and plans live at the repo root — see [../README.md](../README.md).

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
