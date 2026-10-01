# dragons-of-mugloar

Vue 3 + Vite + TypeScript frontend.

## Requirements

- Node `^22.18.0` or `>=24.12.0`
- pnpm

## Run

```sh
pnpm install
pnpm dev
```

Opens on http://localhost:5173.

## Build

```sh
pnpm build
```

Type-checks and builds to `dist/`. Preview the build with `pnpm preview`.

## Other commands

```sh
pnpm test:unit   # unit tests (Vitest)
pnpm lint        # oxlint + ESLint
pnpm format      # Prettier
```

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
