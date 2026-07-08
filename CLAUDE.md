# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GreptimeDB Dashboard — a data-visualization/query UI for [GreptimeDB](https://github.com/GreptimeTeam/greptimedb). Vue 3 + Vite + TypeScript + Arco Design. This repo is a Yeastar fork (`gitlab.yeastar.com` / GitHub `midy177/greptimedb-dashboard`) that adds SIP flow analysis on top of upstream `GreptimeTeam/dashboard`.

## Common commands

Package manager is **bun** (`bun.lock`, `packageManager: bun@1.3.13`). The CI Makefile also uses pnpm; both work but prefer bun locally.

```bash
bun install                 # install deps
bun run dev                 # dev server on http://localhost:5177 (strict port)
bun run cloud               # dev with VITE_ROLE=cloud (Greptime Cloud mode)
bun run build               # production build (base '')
bun run build:test          # test/staging build (base '/dashboard/') + vue-tsc type-check
bun run type:check          # vue-tsc --noEmit --skipLibCheck  (fastest type check)
bun run test                # vitest run  (NOTE: no *.test.ts files exist yet)
bun run preview             # build + vite preview on :5178
bunx tauri dev              # desktop dev (runs `bun dev` as beforeDevCommand)
make build-macos-arm        # desktop build for aarch64-apple-darwin (also x86, windows targets)
make docker                 # build + push docker image to internal registry
```

`bun run dev` proxies `/v1` and `/status` to `http://127.0.0.1:4000` — **a local GreptimeDB must be running on port 4000** for the dashboard to function (`greptime standalone start`). ESLint runs in the dev server via `vite-plugin-eslint`.

## Architecture

### Two independent bundles (Vue + React) bridged by an iframe

This is the most important thing to understand. The build produces **two HTML entries** (configured in `config/vite.config.base.ts` via `createHtmlPlugin`):

1. **`index.html` → `src/main.ts`** — the main Vue 3 / Arco Design SPA, mounted to `#app`. Holds routing, stores, all the GreptimeDB query/logs/traces/sip views.
2. **`dashboard.html` → `src/dashboard-main.tsx`** — a standalone **React 18** app (`#react-root`) that hosts the [@perses-dev](https://perses.dev) dashboarding library for editable Grafana-style dashboards.

The Vue side never imports React/Perses directly. Instead, `src/perses-dashboard/vue/PersesDashboardIframe.vue` renders an `<iframe src="${BASE_URL}dashboard.html">` and communicates with the React bundle via `window.postMessage`:

- Vue → React: `{ type: 'update-dashboard', data: { file, database, username, password, authHeader, instance, dashboardEditable } }` (connection config + dashboard JSON).
- React → Vue: `{ type: 'dashboard-iframe-ready' }` (handshake) and `{ type: 'save-dashboard-request', requestId, data }` (persisted back via `onSave`).
- **Trace modal protocol**: React intercepts clicks on `<a href="/__perses_trace_modal__?traceId=...&table=...&database=...&mode=modal&...">` (defined in `src/perses-dashboard/traceLink.ts`) and opens a trace-gantt `Drawer` instead of navigating. `ensureTraceTableLinks` injects/auto-upgrades these links into `TraceTable` panels. When editing trace links, keep both `traceLink.ts` (builder/parser) and the click handler in `dashboard-main.tsx` in sync.

Because the React bundle is a separate runtime, the Vite config **excludes** `src/perses-dashboard/react/**` and `src/dashboard-main.tsx` from the Vue auto-import plugins, aliases `hoist-non-react-statics` and `react-is` to vendored copies, and uses a custom `tsxTransformer` (esbuild, `jsx: 'automatic'`) for `.tsx`. React components import React/Perses/hooks explicitly.

### Auto-imports (read code with this in mind)

`unplugin-auto-import` makes Vue/Pinia/vue-router APIs **and everything exported from `src/store` and `src/hooks`** available globally without import statements. So `useAppStore()`, `ref()`, `computed()`, `onMounted()`, hooks like `useLocale`, etc. appear in `.vue`/`.ts` files with no import line. `unplugin-vue-components` auto-registers any `.vue` file under `src/components` and `src/views/dashboard`. When adding a new store module or hook, it is automatically wired; when reading code, assume symbols without imports come from these dirs. Generated type stubs: `auto-imports.d.ts`, `components.d.ts`.

### Connection config & auth — `useAppStore` + global axios interceptor

`src/store/modules/app/index.ts` (`useAppStore`) is the single source of truth for connection state: `host`, `database`, `username`, `password`, `authHeader`, `userTimezone`, plus UI state and cloud metadata. Persistence strategy:
- **localStorage** (`config`, `uiConfig`, `connection-profiles`) — survives browser close ("remember me").
- **sessionStorage** (`session-credentials`) — session-only; used when credentials are injected from a URL `?token=`.

`src/api/interceptor.ts` is a **global axios interceptor** that **all** API calls (`src/api/*.ts`) flow through. It:
- Injects HTTP Basic auth: `Authorization: Basic base64(user:pass)` on the header named by `authHeader` (default `Authorization`).
- Adds `x-greptime-timezone` from `userTimezone` on `/v1/*` requests.
- For `/v1/*` responses, disables axios's JSON parser (`transformResponse`) and parses with **`json-bigint`** (`storeAsString: true`) so 64-bit IDs/timestamps are preserved as strings. GreptimeDB returns `{ code, output: [{ affectedrows, records }], execution_time_ms }`.
- Shows Arco `Message.error` toasts on failure (suppressible via `config.suppressErrorToast`; always suppressed for InfluxDB line-protocol requests), and opens the global-settings drawer on **401**.
- Records per-request network timing (`traceTimeStart`).

API endpoints (`src/api/editor.ts`) hit `/v1/sql`, `/v1/scripts`, `/v1/promql`, `/v1/influxdb`, `/v1/prometheus/...` — all proxied to GreptimeDB in dev.

### URL-based connection injection

Two mechanisms for deep-linking a pre-configured connection:
- `?info=<base64 JSON>` — merged into app-store config **once** at startup (in `useAppStore`), then stripped from the URL.
- `?token=<AES-256-GCM encrypted>` (router `beforeEach` guard in `src/router/index.ts`) → `decryptConnectToken` from `src/utils/connect-token.ts` → stored as session-only credentials. `/#/connect?token=...` redirects into the app; `/token-generator` is a helper page to mint tokens. The AES key is a hardcoded 32-byte constant in `connect-token.ts` — this obfuscates plaintext creds in URLs, it is not adversarial security.

### Routing & roles

Hash-history router (`createWebHashHistory`), default redirect `/ → /dashboard/logs-query`. Route tree in `src/router/routes/modules/dashboard.ts`; guard + NProgress in `src/router/guard`. Each route's `meta.roles` filters menu visibility against `VITE_ROLE`:
- `admin` (default `.env.development`/`.env.production`) — full self-hosted dashboard, connects to a user-supplied GreptimeDB host.
- `cloud` (`.env.staging`/`.env.test`, `bun run cloud`) — Greptime Cloud mode; menu items tagged `['admin','cloud']` are visible.
- `playground` — hides the navbar.

`App.vue` reads `VITE_ROLE` at startup and applies it.

### Tauri desktop app

`src-tauri/` (Rust, Tauri v2) wraps the same web bundle as a desktop app connecting to local/remote GreptimeDB. `beforeDevCommand: bun dev`, `beforeBuildCommand: bun run build`, `devUrl: http://localhost:5177`. At runtime, `App.vue` checks `isTauri()` and lazily imports `@/tauri/index` only in the `main` window. `src/main.ts` patches Cmd+C/V/A handling for macOS WKWebView (which doesn't route these through the system responder chain) and disables the context menu in Tauri production builds.

## Conventions

- **Formatting** (Prettier, enforced by Husky `pre-commit` via lint-staged): no semicolons, single quotes, 2-space indent, 120 col. Pug templates (`lang="pug"`) are used in many components with the `@prettier/plugin-pug` + `@vue/language-plugin-pug`; pug attribute sort/wrap rules are configured in `.prettierrc.js`.
- **Commits**: Conventional Commits enforced by `commit-msg` Husky hook + commitlint (`feat:`, `fix:`, `chore:`, etc. — see `git log`).
- **Linting**: ESLint airbnb-base + `@typescript-eslint` + `vue/vue3-recommended` + prettier. `@typescript-eslint/no-explicit-any` and `no-unused-vars` are **off**; `strictNullChecks` is off in `tsconfig.json`. Imports use the `@/*` alias → `src/*`.
- **Styles**: Less + Arco Design Vue theme. Global breakpoint mixin is injected into all Less files via the `modifyVars` hack in `vite.config.base.ts`.
- **i18n**: `vue-i18n`, locale files under `src/locale/{en-US,zh-CN}`; Arco's locale is switched in `App.vue`.

## Notes

- `bun run test` is wired to vitest but there are currently no test files — don't assume a test suite exists.
- Type-checking only runs as part of `build:test`/`build:staging`; use `bun run type:check` standalone for a fast pass.
- This fork adds the SIP view (`src/views/dashboard/sip`) — VoIP call-flow/ladder analysis with Call-ID / src_ip / dst_ip / trace_id filters — not present in upstream.
