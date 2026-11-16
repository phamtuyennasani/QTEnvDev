# Hallmark migration — 73 routes

Status: visual refactor implemented and under final acceptance. Shared shell, semantic tokens, responsive primitives and route-safe fixture are live.

## Current gate

- **Completed:** route inventory (71 module routes + /setup + /customer-module), locked design.md, semantic tokens, bundled fonts, shared shell, responsive fixture, and presentational AppShell primitives.
- **Pilot accepted in fixture:** /startup-group, /php, /mysql, /hosts, /podman, /ollama, /tools, /setup.
- **All-route fixture pass:** the 71 module routes plus /setup and /customer-module were loaded with IPC stubbed; Windows, macOS and Linux fixture runs recorded no renderer errors or horizontal overflow on supported routes. Platform-ineligible routes are expected to redirect to the first visible route.
- **State coverage:** service empty/loading/populated/busy plus representative AI, MCP, Node, Podman, plugin, custom-module and startup-group states were exercised in the fixture. The remaining business-state matrix is a follow-up for native platform smoke tests.

The fixture runs with IPC responses stubbed to safe read-only results. It never starts, stops, installs, downloads, or writes a service. Full-route reports covered 73 routes, both themes, seven widths and top-level tabs: Windows 983 route measurements / 252 tab views; macOS and Linux 1,022 route measurements / 264 tab views each, all with zero renderer errors and zero measured overflow. Rechecks of the affected narrow layouts also reported zero issues. These are Windows-host Electron runs with platform flags, not native OS acceptance.

| Module | Route | Category | Entry | Status |
| --- | --- | --- | --- | --- |
| CliProxyAPI | /cliproxyapi | ai | src/render/components/CliProxyAPI/Index.vue | accepted: route audit; native state follow-up |
| Hermes | /hermes | ai | src/render/components/Hermes/Index.vue | accepted: route audit; native state follow-up |
| MCP | /mcp | ai | src/render/components/MCP/Index.vue | accepted: route audit; native state follow-up |
| N8N | /n8n | ai | src/render/components/N8N/Index.vue | accepted: route audit; native state follow-up |
| Ollama | /ollama | ai | src/render/components/Ollama/Index.vue | accepted: fixture |
| OpenClaw | /openclaw | ai | src/render/components/OpenClaw/Index.vue | accepted: route audit; native state follow-up |
| Antigravity | /antigravity | aiCoding | src/render/components/Antigravity/Index.vue | accepted: route audit; native state follow-up |
| ClaudeCode | /claudeCode | aiCoding | src/render/components/ClaudeCode/Index.vue | accepted: route audit; native state follow-up |
| Codex | /codex | aiCoding | src/render/components/Codex/Index.vue | accepted: route audit; native state follow-up |
| CopilotCli | /copilotCli | aiCoding | src/render/components/CopilotCli/Index.vue | accepted: route audit; native state follow-up |
| Kimi | /kimi | aiCoding | src/render/components/Kimi/Index.vue | accepted: route audit; native state follow-up |
| OpenCode | /openCode | aiCoding | src/render/components/OpenCode/Index.vue | accepted: route audit; native state follow-up |
| Memcached | /memcached | cacheAndQueue | src/render/components/Memcached/Index.vue | accepted: route audit; native state follow-up |
| RabbitMQ | /rabbitmq | cacheAndQueue | src/render/components/RabbitMQ/Index.vue | accepted: route audit; native state follow-up |
| Redis | /redis | cacheAndQueue | src/render/components/Redis/Index.vue | accepted: route audit; native state follow-up |
| StartupGroup | /startup-group | console | src/render/components/StartupGroup/Index.vue | accepted: fixture |
| Podman | /podman | containerRuntime | src/render/components/Podman/Index.vue | accepted: fixture |
| ClickHouse | /clickhouse | dataBaseServer | src/render/components/ClickHouse/Index.vue | accepted: route audit; native state follow-up |
| MariaDB | /mariadb | dataBaseServer | src/render/components/MariaDB/Index.vue | accepted: route audit; native state follow-up |
| MongoDB | /mongodb | dataBaseServer | src/render/components/MongoDB/Index.vue | accepted: route audit; native state follow-up |
| Mysql | /mysql | dataBaseServer | src/render/components/Mysql/Index.vue | accepted: fixture |
| Neo4j | /neo4j | dataBaseServer | src/render/components/Neo4j/Index.vue | accepted: route audit; native state follow-up |
| PostgreSql | /postgresql | dataBaseServer | src/render/components/PostgreSql/Index.vue | accepted: route audit; native state follow-up |
| Qdrant | /qdrant | dataBaseServer | src/render/components/Qdrant/Index.vue | accepted: route audit; native state follow-up |
| DNS | /dns | dnsServer | src/render/components/DNS/Index.vue | accepted: route audit; native state follow-up |
| Numa | /numa | dnsServer | src/render/components/Numa/Index.vue | accepted: route audit; native state follow-up |
| MailPit | /mailpit | emailServer | src/render/components/MailPit/Index.vue | accepted: route audit; native state follow-up |
| FTP | /pure-ftpd | ftpServer | src/render/components/FTP/Index.vue | accepted: route audit; native state follow-up |
| FTPSRV | /ftp-srv | ftpServer | src/render/components/FTPSRV/Index.vue | accepted: route audit; native state follow-up |
| Bun | /bun | language | src/render/components/Bun/Index.vue | accepted: route audit; native state follow-up |
| Deno | /deno | language | src/render/components/Deno/Index.vue | accepted: route audit; native state follow-up |
| DotNet | /dotnet | language | src/render/components/DotNet/Index.vue | accepted: route audit; native state follow-up |
| Erlang | /erlang | language | src/render/components/Erlang/Index.vue | accepted: route audit; native state follow-up |
| Flutter | /flutter | language | src/render/components/Flutter/Index.vue | accepted: route audit; native state follow-up |
| GoLang | /golang | language | src/render/components/GoLang/Index.vue | accepted: route audit; native state follow-up |
| Gradle | /gradle | language | src/render/components/Gradle/Index.vue | accepted: route audit; native state follow-up |
| Java | /java | language | src/render/components/Java/Index.vue | accepted: route audit; native state follow-up |
| Nodejs | /node | language | src/render/components/Nodejs/Index.vue | accepted: route audit; native state follow-up |
| Perl | /perl | language | src/render/components/Perl/Index.vue | accepted: route audit; native state follow-up |
| PHP | /php | language | src/render/components/PHP/Index.vue | accepted: fixture |
| PHPFPM | /php-fpm | language | src/render/components/PHPFPM/Index.vue | accepted: route audit; native state follow-up |
| Python | /python | language | src/render/components/Python/Index.vue | accepted: route audit; native state follow-up |
| RoadRunner | /roadrunner | language | src/render/components/RoadRunner/Index.vue | accepted: route audit; native state follow-up |
| Ruby | /ruby | language | src/render/components/Ruby/Index.vue | accepted: route audit; native state follow-up |
| Rust | /rust | language | src/render/components/Rust/Index.vue | accepted: route audit; native state follow-up |
| SwooleCli | /swoole-cli | language | src/render/components/SwooleCli/Index.vue | accepted: route audit; native state follow-up |
| Zig | /zig | language | src/render/components/Zig/Index.vue | accepted: route audit; native state follow-up |
| Cloudflared | /cloudflared | networkTunnel | src/render/components/Cloudflared/Index.vue | accepted: route audit; native state follow-up |
| CloudflareTunnel | /cloudflare-tunnel | networkTunnel | src/render/components/CloudflareTunnel/Index.vue | accepted: route audit; native state follow-up |
| Minio | /minio | objectStorage | src/render/components/Minio/Index.vue | accepted: route audit; native state follow-up |
| Rustfs | /rustfs | objectStorage | src/render/components/Rustfs/Index.vue | accepted: route audit; native state follow-up |
| Cron | /cron | other | src/render/components/Cron/Index.vue | accepted: route audit; native state follow-up |
| Git | /git | other | src/render/components/Git/Index.vue | accepted: route audit; native state follow-up |
| Tools | /tools | other | src/render/components/Tools/Index.vue | accepted: fixture |
| Elasticsearch | /elasticsearch | searchEngine | src/render/components/Elasticsearch/Index.vue | accepted: route audit; native state follow-up |
| MeiliSearch | /meilisearch | searchEngine | src/render/components/MeiliSearch/Index.vue | accepted: route audit; native state follow-up |
| Typesense | /typesense | searchEngine | src/render/components/Typesense/Index.vue | accepted: route audit; native state follow-up |
| ZincSearch | /zincsearch | searchEngine | src/render/components/ZincSearch/Index.vue | accepted: route audit; native state follow-up |
| Consul | /consul | serviceGovernance | src/render/components/Consul/Index.vue | accepted: route audit; native state follow-up |
| Etcd | /etcd | serviceGovernance | src/render/components/Etcd/Index.vue | accepted: route audit; native state follow-up |
| Rnacos | /rnacos | serviceGovernance | src/render/components/Rnacos/Index.vue | accepted: route audit; native state follow-up |
| Temporal | /temporal | serviceGovernance | src/render/components/Temporal/Index.vue | accepted: route audit; native state follow-up |
| TemporalCli | /temporal-cli | serviceGovernance | src/render/components/TemporalCli/Index.vue | accepted: route audit; native state follow-up |
| Host | /hosts | site | src/render/components/Host/Index.vue | accepted: fixture |
| MkCert | /mkcert | site | src/render/components/MkCert/Index.vue | accepted: route audit; native state follow-up |
| Apache | /apache | webServer | src/render/components/Apache/Index.vue | accepted: route audit; native state follow-up |
| Caddy | /caddy | webServer | src/render/components/Caddy/Index.vue | accepted: route audit; native state follow-up |
| FrankenPHP | /frankenphp | webServer | src/render/components/FrankenPHP/Index.vue | accepted: route audit; native state follow-up |
| HttpServe | /httpserver | webServer | src/render/components/HttpServe/Index.vue | accepted: route audit; native state follow-up |
| Nginx | /nginx | webServer | src/render/components/Nginx/Index.vue | accepted: route audit; native state follow-up |
| Tomcat | /tomcat | webServer | src/render/components/Tomcat/Index.vue | accepted: route audit; native state follow-up |
| Setup | /setup | system | src/render/components/Setup/Index.vue | accepted: fixture |
| CustomerModule | /customer-module | system | src/render/components/CustomerModule/Index.vue | accepted: route audit; native state follow-up |

## Full-route fixture evidence

| Platform fixture | Routes exercised | Renderer errors | Horizontal overflow | Expected redirects |
| --- | --: | --: | --: | --- |
| Windows | 73 | 0 | 0 | customer-module; macOS/Linux-only modules |
| macOS | 73 | 0 | 0 | customer-module |
| Linux | 73 | 0 | 0 | customer-module |

The reports retain each route's rendered text, current hash, viewport scroll width and captured errors. A route remains pending until its category-specific state matrix is reviewed; fixture loading is evidence of route safety, not a substitute for that review.

## Verification gates

- Inventory: complete, 71 module routes plus `/setup` and `/customer-module`.
- Shared visual system: complete, including `tokens.css`, bundled fonts, shell primitives and light/dark semantic mapping.
- Responsive audit: complete for the recorded fixture widths; representative state audit: complete for the recorded scenarios.
- Operation boundary test: passed (`yarn test:renderer-operation-boundaries`).
- Renderer production build: passed with existing Rollup chunk-size/circular-dependency warnings.
- Remaining acceptance: native Windows/macOS/Linux smoke tests for real service operations and localized copy; these are outside the safe visual fixture.

No new operations, stores, persistence, or lifecycle flows are introduced. Existing owners and duplicate guards remain authoritative. No module-boundary exceptions authorized. Business script blocks are preserved; the RabbitMQ no-version watcher guard is documented as a required correctness fix.

The first screenshot harness used stale route/window geometry and is not acceptance evidence. `scripts/hallmark/audit.cjs` is the portable replacement; it uses an offscreen window, exact CSS viewport sizing, font settling, clipped-control checks and safe fixture IPC. A macOS tab run that stopped after `/hosts` was fixture navigation failure, not a product finding; the focused `/apache`, `/nginx`, `/mysql`, `/setup` tab run passed with 40 views and zero issues.

Shared prerequisites (theme and shell) gate dependent visual migrations. Independent route checks retain individual outcomes; a failed check does not erase successful checks. No partial suite is called a pass.
