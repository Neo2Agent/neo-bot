# neo-bot

Web v1 of Neo. A browser logs in, starts a Run, follows SSE events, and sends a follow-up. The control plane orchestrates. The worker runs locally. Provider keys stay in `llm-gateway`.

Scope is locked in [docs/v1-scope.md](docs/v1-scope.md). How a Run moves is in [docs/architecture-overview.md](docs/architecture-overview.md).

## Packages

- `@neo-bot/contracts` shared protocol
- `@neo-bot/ui` shared React controls
- `@neo-bot/web` chat UI on `:5173`
- `@neo-bot/control-plane` API on `:8080`
- `@neo-bot/llm-gateway` inference gateway on `:8081`
- `@neo-bot/worker` local Run worker
- `@neo-bot/extensions` worker cloud tools

## Local

Node `>=22.19` and pnpm:

```bash
pnpm install
pnpm typecheck
pnpm dev
pnpm dev:web
```

`pnpm dev` starts the control plane and gateway. `pnpm dev:web` serves the UI and reuses `:8080` when it is already up.

Default `WORKER_RUNTIME=local`. With no provider key the gateway uses mock upstream. Login is `admin` / `123456`.

```bash
curl -s localhost:8080/health
pnpm smoke:web
```
