# neo-bot Web v1 scope

This file is the locked in and out list for the first Web delivery cut. Desk, Mobile, admin, and Firecracker stay out. The source cut is neo-cloud-agent@e54dc82.

## In

- Packages `@neo-bot/contracts`, `@neo-bot/ui`, `@neo-bot/web`, `@neo-bot/control-plane`, `@neo-bot/worker`, `@neo-bot/llm-gateway`.
- `@neo-bot/extensions`, because the worker imports it for cloud tools. It is not a public process.
- Root workspace files that `pnpm dev` and `pnpm dev:web` need.
- `scripts/dev-web.ts`, `scripts/ensure-backend.ts`, and `scripts/spawn-pnpm.ts`.
- `fixtures/toy-repo` for a local Run smoke.
- Web chat: login, create a Run, subscribe to SSE, and send a follow-up. Artifact routes stay. A mock pong Run may have none.
- Default `WORKER_RUNTIME=local`. Provider keys stay in `llm-gateway` only.

## Out

- `packages/desk`, `packages/mobile`, `packages/admin-api`, `packages/admin-web`, `packages/cli`.
- `services/neo-loop` and `infra/firecracker`.
- Public control-plane routes for desks, devices, and automations. Those paths are gone, not stubbed.
- Desk UI entry points in Web. The chat page does not offer 本机 or Remote.
- Computer-use, Desk, Mobile, and admin docs from neo-cloud-agent.
- Lighthouse deploy skills and production host runbooks.

## Contracts

Desk, device, and automation types may still exist on `@neo-bot/contracts`. They must not hang a public HTTP route in this repo.
