# Web v1 运维手册

v1 运维只覆盖本地 / 预发同一条路径：一键起、环境变量与密钥落点、健康检查、简单发布与回滚。不部署多集群，不部署 Firecracker / Desk / admin。

范围见 [v1-scope.md](./v1-scope.md)。进程与端口见 [architecture-overview.md](./architecture-overview.md)。

## 前置

- Node `>=22.19`（`.nvmrc` 钉死 `22.23.2`）
- pnpm `10.33.3`（根 `package.json` 的 `packageManager`）
- 默认 `WORKER_RUNTIME=local`。`POST /v1/runs` 在进程内拉起 worker，不需要 Docker

PATH 上的 Node 若低于 22.19，`pnpm` 会报 `ERR_PNPM_UNSUPPORTED_ENGINE`。在任意 pnpm 命令前先切到 nvm 的钉死版本：

```bash
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
```

若本机没有恰好这一版，用 nvm 里任意 `>=22.19` 即可。

仓库根目录复制环境文件（不要提交 `.env`）：

```bash
cp .env.example .env
```

## 环境变量与密钥落点

根目录 `.env` 由 control-plane 和 llm-gateway 加载。**进程里已有的环境变量优先**（文件不会覆盖）。

Provider 密钥只允许经根 `.env` 进入 **llm-gateway**，例如：

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `LLM_UPSTREAM_API_KEY`
- 以及 `.env.example` 里同组的其它上游密钥

没有密钥时走 mock：默认 `LLM_UPSTREAM=mock`。

浏览器和 `@neo-bot/web` **不得**持有上述密钥。`LLM_GATEWAY_JWT_SECRET` 只给服务端（control-plane / llm-gateway），不要写进前端或 Vite 环境。

完整变量表只以 [`.env.example`](../.env.example) 为准，不要在本手册里发明新变量。

## 一键起（本地 = 预发同路径）

本地和预发用同一组命令。

1. 安装依赖

```bash
pnpm install
```

2. 类型检查

```bash
pnpm typecheck
```

3. 起后端：control-plane `:8080` + llm-gateway `:8081`

```bash
pnpm dev
```

4. 起 UI（`:8080` 已在则复用，不再另起后端）

```bash
pnpm dev:web
```

打开 http://127.0.0.1:5173/

5. 登录：`admin` / `123456`

表单不预填，也不能跳过。

## 健康检查

control-plane 存活（期望 HTTP 成功）：

```bash
curl -s localhost:8080/health
```

端到端 mock：登录 → Run → SSE → follow-up。期望退出码 `0`，最后一行类似：

```text
smoke ok run=… events=…+ follow-up idle
```

```bash
pnpm smoke:web
```

## 简单发布 / 回滚

v1 没有多集群发布面，也没有 Firecracker / Desk / admin 部署。目标机就是一台能跑上述一键起命令的主机。

### 发布

1. 把变更 merge 进 `main`
2. 目标机 `git pull`（或 checkout 发布 commit）
3. 按「一键起」再走一遍：`pnpm install` → `pnpm typecheck` → `pnpm dev` → `pnpm dev:web`
4. 真实模型密钥只写在目标机 `.env`，**永远不要 commit secrets**

### 回滚

1. `git revert` 有问题的 merge，或 checkout 上一个已知可用的 commit / tag
2. 若 `pnpm-lock.yaml` 变了，重新 `pnpm install`
3. 再起一次：`pnpm dev` / `pnpm dev:web`
4. 用「健康检查」确认
