# neo-bot

Web v1 monorepo. Control plane, LLM gateway, local worker, chat UI. See `README.md` and `docs/v1-scope.md`.

## Node

`.nvmrc` pins `22.23.2`. `engines.node` is `>=22.19`. `.npmrc` sets `engine-strict=true`.

If `node` on PATH is older than 22.19, `pnpm` fails with `ERR_PNPM_UNSUPPORTED_ENGINE`. Prepend the nvm bin before any pnpm command:

```bash
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
```

If that exact version is missing, use any Node `>=22.19` from nvm.

## Commands

- `pnpm install`
- `pnpm typecheck`
- `pnpm dev` starts control-plane `:8080` and llm-gateway `:8081`
- `pnpm dev:web` serves the chat UI on `:5173` and starts the backend if `:8080` is down
- `pnpm build:web`
- `pnpm smoke:web` runs the mock login, Run, SSE, and follow-up check
- Ops runbook (local/staging start, env, health, publish/rollback): [docs/ops-runbook.md](docs/ops-runbook.md)

## Runtime

- Default `WORKER_RUNTIME=local`. `POST /v1/runs` spawns an in-process worker. Docker is not required.
- `llm-gateway` holds provider keys. With no `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` it uses `upstream=mock`.
- Login is `admin` / `123456`. The form does not prefill and cannot be skipped.
- Desk, Mobile, admin, and Firecracker are out of scope. Do not add those packages or public routes.

## Env

Root `.env` is loaded by control-plane and gateway. Existing environment variables win. See `.env.example`.
