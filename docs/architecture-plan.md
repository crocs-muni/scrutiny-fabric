# SCRUTINY Fabric — Implementation Architecture Plan

**Version:** 1.0  
**Date:** 2026-05-04  
**Author:** AI-assisted architecture design  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Decision Records](#2-architecture-decision-records)
   - [ADR-001: Language (TypeScript vs Rust)](#adr-001-language--typescript-vs-rust-via-wasm)
   - [ADR-002: Monorepo Orchestration](#adr-002-monorepo-orchestration--pnpm-only-vs-turborepo-vs-nx)
   - [ADR-003: CLI Framework](#adr-003-cli-framework--commanderjs-vs-oclif-vs-clipanion)
   - [ADR-004: Deployment Model (Self-Hosted vs Docker vs Vercel)](#adr-004-deployment-model--self-hosted-adapter-node--nginx-vs-docker-vs-vercel)
   - [ADR-005: Nostr Library Layer](#adr-005-nostr-library-layer--raw-nostr-tools-vs-ndk-vs-nostrify)
   - [ADR-006: Graph Visualization](#adr-006-graph-visualization--cytoscapejs-vs-d3-force-vs-vis-network)
   - [ADR-007: Binary Distribution](#adr-007-binary-distribution--npm-global-install-vs-bun-compile-vs-dual)
   - [ADR-008: Testing Framework](#adr-008-testing-framework--vitest-vs-jest-vs-bun-test)
   - [ADR-009: Repository Strategy](#adr-009-repository-strategy--monorepo-vs-polyrepo)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Shared Protocol Engine (`@scrutiny-fabric/engine`)](#4-shared-protocol-engine-scrutiny-fabricengine)
5. [CLI Architecture (`@scrutiny-fabric/cli`)](#5-cli-architecture-scrutiny-fabriccli)
6. [Web App Architecture (`apps/scrutiny-lens`)](#6-web-app-architecture-appsscrutiny-lens)
7. [Testing Strategy](#7-testing-strategy)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Performance Optimization](#9-performance-optimization)
10. [Dependency Manifest](#10-dependency-manifest)
11. [Phase-Based Implementation Roadmap](#11-phase-based-implementation-roadmap)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Anti-Patterns & Pitfalls](#13-anti-patterns--pitfalls)
14. [Appendix: Research References](#14-appendix-research-references)

---

## 1. Executive Summary

SCRUTINY Fabric requires **two delivery surfaces** sharing one truth:

| Surface | Goal | Users |
|---------|------|-------|
| **CLI** (`scrutiny-fabric`) | Publish, verify, and audit protocol events from terminals and CI pipelines | Developers, security engineers, automated scanners |
| **Web App** (`scrutiny-lens`) | Browse, visualize, and interact with the protocol graph in a browser | Auditors, researchers, product teams |

Both consume the same **protocol engine** — a pure-TypeScript library implementing the spec's event validation, chain resolution, patch application, and canonical view computation. The engine must be identical in both environments.

The architecture follows three principles derived from competitive analysis of Nostr clients (Coracle, Snort), supply-chain tools (GUAC, in-toto), and devtool CLIs (nak, git, npm):

1. **One engine, two shells.** The core is a functional-core/imperative-shell design. Pure functions compute state; impure wrappers talk to relays, filesystems, and browsers.
2. **Zero compilation boundary between engine and UI.** No WASM, no FFI, no serde. The engine TypeScript source is imported directly by both CLI and SvelteKit.
3. **Test vectors are the single source of truth.** Every spec rule maps to a Vitest test case. CI gates merge on 100% TV pass rate.

---

## 2. Architecture Decision Records

Each major architectural choice is presented as a debate between viable alternatives. Context explains the constraints. Each option gets pros, cons, and a comparison table. A recommendation is made and justified.

---

### ADR-001: Language — TypeScript vs Rust (via WASM)

**Context:** Solo developer building a protocol engine (~500 lines of diff logic) plus CLI + web app. The engine must run identically in Node.js terminals, CI pipelines, and browsers. The Nostr ecosystem has mature JS libraries and an alpha-stage Rust library.

| | **Option A: TypeScript everywhere** | **Option B: Rust core + TypeScript shells** |
|---|---|---|
| **Diff correctness** | jsdiff v8 tested against git apply via 7 test vectors. Correctness from test suite. | Own diff implementation, zero-dependency, compiler-guaranteed safety. But ~3K additional lines to write and maintain. |
| **Nostr library** | nostr-tools v2.x: 192 releases, 90 contributors, production-grade (Snort, Coracle, Damus). Maintainer = fiatjaf (protocol creator). | rust-nostr v0.44: self-labeled ALPHA. Breaking API changes each minor version. WASM target missing NIP features. |
| **Iteration speed** | Save → HMR in SvelteKit. Debug with Chrome DevTools or Node inspector. Single-language stack. | Save → `wasm-pack build` → page reload. Debug across JS↔WASM boundary requires separate toolchains (~2× slower dev cycle). |
| **Shared engine** | Direct TypeScript import by both CLI and SvelteKit. Zero serialization layer. | Rust compiled to `.wasm`. Every surface crossing (CLI calls engine, SvelteKit calls engine) requires serde serialize/deserialize glue (~200+ lines per boundary). |
| **Contributor accessibility** | Any JavaScript/TypeScript developer can contribute. Lower barrier for the Nostr community. | Requires Rust + WASM knowledge. Narrows contributor pool significantly. |
| **WASM benefit** | Not needed yet. Phase 4 threshold signing (BLS12-381) could use a narrow WASM module for curve operations. | Native crypto performance, memory safety, single-binary compilation. These are real benefits but pay a multi-month tax upfront. |

**Recommendation: Option A (TypeScript).** The WASM tax (serde boundaries, dual-language debugging, CI complexity) costs weeks-to-months for a solo developer. The correctness risk on the ~500-line diff engine is already mitigated by test vectors validated against `git apply --check`. If Phase 4 introduces BLS12-381 threshold signing, that's a well-defined, narrow WASM surface — worth reevaluating then.

**Rejection rationale for Option B:** rust-nostr at ALPHA maturity with breaking API changes means fighting upstream while building downstream. The Nostr web ecosystem runs on nostr-tools — diverging from it creates integration debt with every other Nostr client and relay.

---

### ADR-002: Monorepo Orchestration — pnpm-only vs Turborepo vs Nx

**Context:** 5 packages + 2 apps sharing a TypeScript codebase. Need ordered builds (engine → nostr/ui → cli/lens), shared configs, and fast CI. Current package count is small (<10).

| | **Option A: pnpm workspaces only** | **Option B: Turborepo** | **Option C: Nx** |
|---|---|---|---|
| **Build ordering** | Manual `tsc --build` with project references. `pnpm --filter` handles DAG resolution in scripts. | `turbo.json` pipeline with `dependsOn: ["^build"]`. Automatic parallel/serial execution. | Similar to Turborepo but with opinionated generators and plugin system. |
| **CI caching** | None built-in. Rely on GitHub Actions cache manually. | Remote cache (Vercel) or local filesystem cache. 80%+ CI time reduction after first build. | Distributed task execution, computation hashing, remote caching. Most feature-rich of the three. |
| **Learning curve** | Minimal. Already using pnpm. One YAML file. | ~20 lines of JSON configuration. Well-documented. | Significant. Plugin system, workspace generators, executors, dep-graph. Overkill for <10 packages. |
| **Adoption path** | Day 1. No migration ever needed. | Add later: `npx create-turbo` → move existing `package.json` scripts into `turbo.json`. | Heavy upfront investment. Migration cost rarely recouped for small monorepos. |
| **Coracle uses** | ✅ pnpm + manual scripts | ❌ | ❌ |
| **Tigris CLI uses** | ✅ pnpm + manual scripts | ❌ | ❌ |

**Recommendation: Option A (pnpm-only) now, Option B (Turborepo) gated.** Start without Turborepo. If CI build times exceed 60 seconds or the package count reaches 10+, add Turborepo. The migration is trivial (one `turbo.json` file, no code changes). Nx's overhead is never justified for this scale.

---

### ADR-003: CLI Framework — Commander.js vs oclif vs clipanion

**Context:** 6 commands (`publish`, `verify`, `resolve`, `watch`, `key`, `decode`). Need argument parsing, help generation, color output, `--json` flag for piping. No plugin system needed. Will distribute via npm and optionally Bun-compiled binaries.

| | **Option A: Commander.js** | **Option B: oclif (Salesforce)** | **Option C: clipanion** |
|---|---|---|---|
| **Bundle size** | ~15 KB | ~28 transitive dependencies at minimum setup | ~25 KB |
| **Command model** | `.command()` chaining. Subcommands via separate files. Simple. | Class-based with decorators. Generates scaffolded project structure. | Class-based with typed `Command` subclass. Used by Yarn. |
| **Plugin system** | Not included. Must build manually if needed. | First-class plugin architecture. Users can extend CLI at runtime. | Not included. |
| **Auto-update** | Not included. | Built-in. Supports S3/GCS/npm backends. | Not included. |
| **JSON output** | Trivial: `console.log(JSON.stringify(result))`. Manual but simple. | Built-in `--json` flag on every command. Automatic suppression of console noise. | Manual like Commander. |
| **Help generation** | Automatic from command definitions. Customizable. | Automatic. Generated README docs on npm publish. | Automatic. |
| **Packagers** | Not included. Use Bun `--compile` for binaries. | Built-in: tarballs, .pkg, .msi, Debian packages via `oclif pack`. | Not included. |
| **Heroku/Salesforce use** | — | ✅ Production at massive scale | — |
| **nak uses** | — (Go, not JS) | — (Go, not JS) | — (Go, not JS) |

**Recommendation: Option A (Commander.js).** Six commands don't justify oclif's scaffolding weight. If the CLI grows to 20+ commands or needs plugins, migration to oclif is straightforward — same underlying engine APIs, different argument wiring. Clipanion offers a middle ground but its class-based model adds ceremony without oclif's payoff (plugins/packaging).

---

### ADR-004: Deployment Model — Self-Hosted (adapter-node + Nginx) vs Docker vs Vercel

**Context:** Faculty lab environment. Own infrastructure. Product pages must be Google-indexable (SSR required, SPA is not an option). Need caching to absorb repeated search crawler hits and relay query latency. No budget for paid platforms.

| | **Option A: Bare-metal (adapter-node + Nginx + PM2)** | **Option B: Docker Compose (adapter-node + Nginx)** | **Option C: Vercel (adapter-vercel SSR+ISR)** |
|---|---|---|---|
| **Infrastructure** | One Linux server/VPS. Nginx as reverse proxy + SSL termination. PM2 or systemd for Node process. | Docker Engine on any Linux host. Two containers: Node app + Nginx. Reproducible via `docker-compose.yml`. | Zero servers to manage. Vercel handles CDN, SSL, scaling, caching automatically. |
| **SSR caching** | Nginx `proxy_cache` with `proxy_cache_background_update on` and `proxy_cache_use_stale updating`. Equivalent to ISR's stale-while-revalidate. Configurable TTL per location block. | Same Nginx config, containerized. Identical behavior. | Built-in ISR via `export const config = { isr: { expiration: 300 } }`. Global CDN, 300ms purges, request collapsing. |
| **SSL** | Certbot + Let's Encrypt. Auto-renew cron job. One-time setup. | Certbot in a companion container or Traefik sidecar. | Automatic. No work. |
| **Deployment** | `git pull` → `pnpm build` → `pm2 restart`. Scriptable. | `git pull` → `docker compose up --build -d`. | `git push` → auto-deploy. Preview URLs per branch. |
| **Scaling** | Fixed capacity (the machine you provisioned). Multiple Node processes behind Nginx `upstream` for load balancing. | Same as bare-metal, containerized. | Automatic. Serverless functions scale to zero and to demand. ISR absorbs spikes at CDN. |
| **Cost** | $5–20/month for a VPS. Or free if using existing lab hardware. | Same as bare-metal (Docker is free software). | Free tier: 100 GB bandwidth, 1M function invocations/month. Paid above that. |
| **Compliance** | Full data sovereignty. Keys, relay connections, logs all stay on your hardware. | Same as bare-metal. | Data flows through Vercel's infrastructure. Review their DPA for academic use. |
| **Maintenance** | OS updates, Node upgrades, cert renewal — you own it all. ~1 hour/month. | Lower: Docker abstracts OS differences. Still need host maintenance. | Zero. Platform handles everything. |
| **Faculty lab fit** | ✅ Runs on existing lab servers. No external dependencies beyond Nostr relays. IT department can manage. | ✅ Containerized = reproducible, shareable with other lab projects. | ⚠️ External dependency. University IT policies may restrict third-party hosting for research tools. |

**Recommendation: Option B (Docker Compose) for reproducibility, Option A (bare-metal) for simplicity.** Both use identical tech (adapter-node + Nginx). Docker adds a one-time `Dockerfile` + `docker-compose.yml` cost that pays off when another lab member needs to run the stack locally, or when migrating between lab machines.

**Nginx SSR cache (ISR equivalent):**

```nginx
# /etc/nginx/sites-available/scrutiny-lens
proxy_cache_path /var/cache/nginx/scrutiny levels=1:2 keys_zone=SCRUTINY:50m 
                 max_size=500m inactive=60m use_temp_path=off;

upstream scrutiny_node {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 443 ssl http2;
    server_name scrutiny-lens.example.edu;

    # Static assets: aggressive cache (fingerprinted filenames)
    location /_app/immutable/ {
        expires max;
        add_header Cache-Control "public, immutable";
        access_log off;
        proxy_pass http://scrutiny_node;
    }

    # Product pages: SSR with cache (Google indexing targets)
    location /product/ {
        proxy_pass http://scrutiny_node;
        proxy_cache SCRUTINY;
        proxy_cache_valid 200 5m;               # Cache 200 OK for 5 min
        proxy_cache_valid 404 1m;               # Cache 404s briefly
        proxy_cache_use_stale updating error timeout http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;        # Revalidate in background
        proxy_cache_lock on;                     # Thundering herd prevention
        proxy_cache_bypass $http_authorization;  # Skip cache for authenticated users
        proxy_no_cache $http_authorization;
        add_header X-Cache-Status $upstream_cache_status always;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dynamic routes: pass through, no cache
    location / {
        proxy_pass http://scrutiny_node;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```

This Nginx configuration provides equivalent behavior to Vercel's ISR — cached SSR responses with background revalidation, thundering herd protection, and stale-serving during backend failures — entirely on your own hardware.

**Process management:**

```bash
# Option A: PM2 (simple)
pm2 start node --name "scrutiny-lens" -- -r dotenv/config build
pm2 save
pm2 startup

# Option B: systemd (no extra tool needed)
# /etc/systemd/system/scrutiny-lens.service
[Service]
WorkingDirectory=/opt/scrutiny-lens
ExecStart=/usr/bin/node build
Environment=NODE_ENV=production ORIGIN=https://scrutiny-lens.example.edu
EnvironmentFile=/opt/scrutiny-lens/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

### ADR-005: Nostr Library Layer — raw nostr-tools vs NDK vs Nostrify

**Context:** Need event creation, signing, validation, WebSocket relay communication, NIP-07 browser extension support, and eventually NIP-46 bunker signing and NIP-77 negentropy sync.

| | **Option A: raw nostr-tools** | **Option B: NDK (Nostr Development Kit)** | **Option C: Nostrify** |
|---|---|---|---|
| **Abstraction level** | Low-level primitives: `SimplePool`, `finalizeEvent`, `verifyEvent`. You wire everything yourself. | Higher-level: `NDKEvent` class, built-in caching, multi-relay coordination, outbox model. | AsyncGenerator-based relay streaming, storage abstraction, policy pipelines, signer interfaces. |
| **Bundle size** | Smallest. Only @scure/@noble deps. ~40KB gzipped for pool+signing. | Larger. More abstractions = more code shipped. | Medium. Modular imports. |
| **Migration risk** | Low. Many clients migrated from NDK → nostr-tools for bundle size (see Runstr case study). | Your code couples to NDK's API. Harder to extract later. | Newer project. Smaller ecosystem but clean abstractions. |
| **Browser + Node** | ✅ Separate entry points (`nostr-tools/pool` for Node needs `ws` polyfill). | ✅ Works in both. | ✅ Designed for cross-platform (browser/Node/Deno). |
| **Community** | 838 stars, 90 contributors. Maintained by fiatjaf (protocol creator). Used by Snort, Coracle, Damus relay. | Active community. Higher-level patterns well-documented. | Smaller but growing. JSR-native. Good type design. |
| **Fit for our shell** | Perfect. We build our own thin wrappers over nostr-tools in `@scrutiny-fabric/nostr`. Engine stays pure. | Would introduce NDK's caching/coordination opinions into our shell layer. Conflicts with our functional-core design. | Nice async patterns but adds dependency risk (small project). |

**Recommendation: Option A (raw nostr-tools).** Our architecture deliberately separates the Nostr "shell" (`@scrutiny-fabric/nostr`) from the engine. nostr-tools provides exactly the right level: WebSocket pools, event signing, verification. The thin wrapper we write over it matches our abstractions (`publishScrutinyEvent`, `queryChainForIdentifier`), not NDK's `NDKEvent` class hierarchy.

---

### ADR-006: Graph Visualization — Cytoscape.js vs D3-force vs vis-network

**Context:** Visualize event chains (10–100 nodes typical, potentially 500+ for dense binding graphs). Need hierarchical layouts (dagre), interactive node selection, edge labels showing relationship types, and zoom/pan. Must embed in Svelte 5 components.

| | **Option A: Cytoscape.js** | **Option B: D3-force** | **Option C: vis-network** |
|---|---|---|---|
| **Graph algorithms** | Rich built-in: BFS, DFS, PageRank, clustering, degree centrality. Essential for trust analysis. | None. You implement everything manually. | Basic layout only. No graph algorithms. |
| **Layout engines** | Breadthfirst, dagre (hierarchical), cola (overlap-avoidance), cose (force-directed), concentric, grid. Extensible via plugins. | d3-force for simulation. d3-dag for hierarchical. Each requires separate setup and custom code. | Hierarchical, improvedLayout (force-directed). Fewer options. |
| **WebGL support** | Opt-in renderer (`webgl: true` since PR #3314). Sprite-sheet strategy for node textures. Significant perf gain at 500+ nodes. | Canvas only (manual). SVG default = slow for >200 nodes. | Canvas only. No WebGL path. |
| **Edge styles** | Haystack (fast straight lines), bezier (bundled/unbundled), taxi, segments. Arrow support. | Manual. Bezier path calculations written by you. | Smooth curves, straight lines. Simpler. |
| **Svelte integration** | Via `onMount` + `$effect` wrapper (proven pattern in Tangled commit, community demos). DOM container managed by Cytoscape. | More natural: D3 manipulates SVG elements, Svelte binds to them. But perf degrades with SVG at >500 nodes. | Similar to Cytoscape: imperative API, canvas renderer. |
| **Maintenance** | 11K stars, actively maintained. 14 open issues. Regular releases. | 110K stars, the standard. But forces you to rebuild graph-aware interactions manually. | 4.8K stars. Lighter maintenance cadence. |
| **Performance ceiling** | ~1000 nodes / 2000 edges comfortable with haystack edges + texture caching. | SVG mode degrades at ~200 nodes. Canvas mode scales further but requires significant custom code. | Similar to Cytoscape but without WebGL fallback. |

**Recommendation: Option A (Cytoscape.js).** For a graph that needs hierarchical layouts (event chains), edge arrows showing direction, click-to-expand nodes, and built-in graph algorithms for future trust analysis — Cytoscape saves months vs building on D3. The Svelte 5 wrapper is a well-understood pattern (mount in `onMount`, reactively update via `$effect`, cleanup in destroy). D3 is the right choice for bespoke visualizations where you control every pixel; here, we want graph theory primitives that already exist in Cytoscape.

---

### ADR-007: Binary Distribution — npm global install vs Bun compile vs Dual

**Context:** CLI needs to reach developers who may or may not have Node.js installed. CI pipelines prefer single binaries. npm is the native JS distribution channel. Bun's `--compile` produces standalone executables.

| | **Option A: npm global install only** | **Option B: Bun compile only** | **Option C: Dual distribution (Tigris pattern)** |
|---|---|---|---|
| **Developer UX** | `npm install -g @scrutiny-fabric/cli`. Familiar to every JS developer. Requires Node ≥18. | Download binary, chmod +x, run. No runtime dependency. 60 MB binary size (contains Bun runtime). | Both available. User chooses: npm for convenience, binary for CI/minimal containers. |
| **CI fit** | Requires `actions/setup-node` + `npm install`. Adds ~30s to CI setup. | Single binary download. Instant execution. Ideal for GitHub Actions, Docker. | CI pipelines use binary. Individual developers use npm. |
| **Cross-compile** | Not applicable (npm distributes source, runtime handles platform). | `bun build --target bun-linux-x64|bun-darwin-arm64|...`. Cross-compile from any platform. | `bun build` handles the binary path. `npm publish` handles the source path. |
| **Maintenance** | One distribution path. No binary build step in release pipeline. | Must compile for 5 targets (macOS ARM/x64, Linux ARM/x64, Windows x64). Adds ~3 min to release workflow. | Two paths, same core code. Tigris solved this with a code-generated command registry (static imports for binary, dynamic for npm). |
| **Versioning** | npm version + semver tags. Standard. | GitHub Release artifacts + version tag. Manual or scripted upload. | Both: npm for latest stable, GitHub Releases for specific versions. |

**Recommendation: Option A (npm only) for Phase 1–2, Option C (dual) gated on user demand.** npm is how Nostr developers already consume tools. Starting there avoids premature binary build complexity. When someone requests a standalone binary for their CI pipeline, add a Bun compile step to the release workflow — the Tigris pattern shows this takes ~3 hours of one-time setup.

---

### ADR-008: Testing Framework — Vitest vs Jest vs Bun test

**Context:** Monorepo with TypeScript sources. Need fast unit tests for the engine (no DOM), component tests (jsdom), E2E tests (Playwright). Test vectors are part of the spec and must run on every commit.

| | **Option A: Vitest** | **Option B: Jest** | **Option C: Bun test** |
|---|---|---|---|
| **TypeScript** | Native. Uses Vite's transform pipeline. No `ts-jest` or babel config. | Requires `ts-jest` or `@swc/jest` transformer. Adds configuration surface. | Native TypeScript support. `bun test` works directly on `.ts` files. |
| **Speed** | ~2x faster than Jest (Vite's esbuild transform, worker threads). `isolate: false` gives ~3x boost for pure engine tests. | Slower. ts-jest type-checking mode doubles test time. | Fastest. Bun's native runtime skips Node overhead. Benchmarks show 3–5x vs Jest. |
| **Monorepo support** | Projects API with glob patterns. `defineProject` for package-level configs. Shared config inheritance. | `--projects` flag supports multiple configs. Less ergonomic than Vitest for nested setups. | Workspace-aware via `bun test --filter`. Less mature monorepo story. |
| **Svelte component testing** | `@testing-library/svelte` + `jsdom` environment. Well-supported. | Same libraries, more configuration. | Limited: Bun's DOM implementation is incomplete for component testing. |
| **UI** | Built-in dashboard (`@vitest/ui`). Watch mode with smart re-run. | Separate `jest-watch` plugins. | Built-in watch mode. More minimal. |
| **Coverage** | V8 provider (native), Istanbul provider. Works with monorepo projects. | Istanbul built-in. | Built-in coverage (`bun test --coverage`). Newer, less battle-tested. |
| **Coracle/Snort use** | ✅ Coracle uses Vitest | — | — |

**Recommendation: Option A (Vitest).** Native Vite integration means the engine and SvelteKit share the same transform pipeline. The projects API elegantly handles our 5-package monorepo. Bun test is compelling for raw speed but lacks DOM/jsdom support needed for Svelte component tests — and we cannot run component tests without a DOM environment.

### ADR-009: Repository Strategy — Monorepo vs Polyrepo

**Context:** SCRUTINY Fabric spans three distinct concerns: (1) a protocol specification that external developers may implement, (2) npm-distributed SDK packages (`@scrutiny-fabric/engine`, `@scrutiny-fabric/cli`), and (3) a self-hosted web application deployed on faculty lab infrastructure. CRoCS lab convention is one-repo-per-purpose (128 repos, including the existing `crocs-muni/scrutiny` + `crocs-muni/scrutiny-viz` split). Nostr ecosystem precedent (`nostr-protocol/nostr` + `nostr-protocol/nips`) demonstrates spec-repo separation. Need to evaluate whether pnpm workspaces monorepo or multiple focused repositories best serves these audiences.

#### Cross-Project Comparison Table

| Project | Strategy | # Repos | Structure | Key Lesson for SCRUTINY Fabric |
|---|---|---|---|---|
| **nostr-protocol** | Polyrepo by purpose | 4 | `nostr` (protocol readme) + `nips` (specs only) + DVM (docs) + kind registry | **Gold standard for spec separation.** NIPs evolved independently for years without breaking client builds. Others could write compatible relay/client implementations from NIPs alone. |
| **rust-nostr/nostr** | Monorepo (crates) + separate bindings | 1+ | 20+ Rust crates in one repo; JS/Python bindings in separate repos | When publishing npm packages, separate repos for different language ecosystems makes sense. Core logic co-located with its consumers. |
| **snort (v0l/snort)** | Single monorepo | 1 | `packages/app` + `packages/const` + `packages/devtools` via Yarn workspaces | Works for web-only apps. No SDK distribution story needed. If you don't publish packages, monorepo overhead is minimal. |
| **Socket.IO** | Migrated FROM multi-repo TO monorepo | Merged to 1 | Started as 7 separate repos in 2014. Merged in 2024: "cross-repo changes too painful, CI config duplication across repos was maddening." | **Important lesson:** splitting packages that always change together creates constant friction. Socket.IO explicitly reversed course after a decade. |
| **open-passkey (locke-inc)** | Monorepo | 1 | 30+ packages: core-{ts,go,py,rs}, server-{express,fastify,...}, react, vue, svelte, angular. Shared `spec/vectors/`. | When 6 languages share test vectors, monorepo is the only sane option. For single-language (TypeScript only), this scale is unnecessary. |
| **sip-protocol** | Polyrepo by function | 10 | `sip-protocol` (core SDK) + `sip-app` + `sip-mobile` + `sip-website` + `docs-sip` + `blog-sip` + `circuits` + `sipher` + `.github` | Each repo has independent deploy cycles. SDK versions pinned via npm. Multi-repo pain manageable when components truly deploy independently. |
| **Zora Protocol** | Monorepo | 1 | Contract packages → gen pipeline → clean published package. `protocol-deployments` has zero deps despite monorepo origin. | Elegant publish pattern: dirty internal packages build into clean external package. Applicable if we want to generate a zero-dep `@scrutiny-fabric/types` package. |
| **Aztec Protocol** | Monorepo | 1 | Multi-language: TS + C++ + Noir + Solidity. 60+ TypeScript packages. Complex bootstrap scripts. | Overkill for single-language project. The complexity tax is visible in their 3-stage bootstrap pipeline. |
| **Infisical** | Monorepo | 1 | `backend/` + `frontend/` + `docs/`. Self-hosted Docker compose. | Good self-hosted reference pattern. Entire stack cloned once, docker-compose up. But frontend/backend are tightly coupled Node apps — not analogous to us having a CLI + web app with different deploy targets. |
| **crocs-muni/scrutiny + scrutiny-viz** | Polyrepo by tool | 2+ | `scrutiny` (analysis + data collection) + `scrutiny-viz` (comparison/reporting web UI) | **Your existing pattern.** CRoCS lab conventionally separates tools by purpose. scrutiny-viz depends on scrutiny output but lives independently. |

#### Decision Matrix: 3-Repo vs Single Monorepo vs 2-Repo Hybrid

| Factor | Option A: 3 Separate Repos | Option B: Single Monorepo | Option C: 2-Repo Hybrid |
|---|---|---|---|
| | **`scrutiny-fabric`** (spec) + **`scrutiny-fabric-tools`** (pnpm workspace for engine/cli/shared) + **`scrutiny-lens`** (web app) | Single `scrutiny-fabric` with `docs/` + `packages/` + `apps/` | `scrutiny-fabric` (spec + tools monorepo) + `scrutiny-lens` (web app) |
| **Protocol openness** | ✅ Spec repo is standalone. External devs can fork/submodule just the spec without pulling implementation code. Version tags on spec repo = protocol version. | ❌ Spec buried in `docs/` inside monorepo. Nobody can subscribe to just the spec. No clean semantic versioning of protocol independent of code. | ⚠️ Spec is in the tools repo. Cleaner than monorepo but still couples spec to implementation. |
| **NPM consumer clarity** | ✅ `@scrutiny-fabric/cli` installed globally by security engineers who never touch web app code. Tools repo = exactly what's published to npm. | ⚠️ Possible but confusing. Cloning a web app repo to contribute to a CLI feels wrong. "Why do I need SvelteKit for command-line work?" | ⚠️ Same confusion as Option B but slightly better since web app is gone. Still bundles CLI + spec in one repo. |
| **Atomic cross-package changes** | ⚠️ Engine change requires: (a) publish engine to npm, (b) bump dependency in CLI, (c) bump dependency in lens. Or use `pnpm link` locally (flaky). | ✅ One commit updates engine + CLI + web app simultaneously. One PR reviews everything. No version coordination. | ✅ Engine→CLI is atomic inside tools repo. Lens depends on npm-published engine (intentional friction). |
| **CI/CD independence** | ✅ Web app deploys without running CLI tests. CLI publishes without building lens assets. Each repo has focused CI. | ❌ Every push triggers all packages. Needs `--filter=...[origin/main]` pattern to avoid building lens on CLI-only commits. Add ~1-2 days setup. | ✅ Tools CI and lens CI fully independent. Only tools CI runs engine+CLI tests. |
| **CRoCS lab conventions** | ✅ Matches existing `scrutiny` + `scrutiny-viz` pattern exactly. 128 single-purpose repos set precedent. Zero team discussion needed. | ❌ First-ever monorepo in crocs-muni org. Would need justification and buy-in for deviation. | ⚠️ Partially matches convention (lens separate is good) but tools monorepo is novel. |
| **External contributor onboarding** | ✅ Spec fix? Clone `scrutiny-fabric`. CLI bug? Clone `scrutiny-fabric-tools`. UI issue? Clone `scrutiny-lens`. Each repo <50MB. | ❌ Clone entire 150MB+ monorepo to fix a typo in protocol-spec.md. Overwhelming for first-time contributors. | ⚠️ Better than Option B (no SvelteKit bulk) but spec fixes still require full tools context. |
| **Deployment story** | ✅ Lens deploys from its own repo. Dockerfile, Nginx config, PM2/systemd unit files all in one place. Operations team sees exactly what matters. | ❌ Deployment artifacts spread across `apps/scrutiny-lens/`. Config mixed with CLI source. Less clear ops boundary. | ✅ Lens deploy is self-contained. |
| **GitHub Issues/Projects** | ✅ Spec: protocol design discussions. Tools: CLI bugs, engine features. Lens: UX issues, accessibility, SEO. Three clean Issue trackers. | ❌ Label-based triage (`project: cli`, `project: lens`, `area: spec`). Requires discipline. WordPress Openverse discussed this pain: "monorepo Issues tab is a mix of everything." | ⚠️ Spec and tool issues share one tracker. Label discipline still needed. |
| **Versioning strategy** | ✅ Protocol versioned independently (semver on spec repo). npm packages versioned via Changesets in tools repo. Lens has its own release cycle. | ⚠️ Fixed versioning across all packages or independent with care. Spec version = package version? Unclear mapping. | ⚠️ Spec version conflated with tools version. Does protocol v1.0 mean engine@1.0.0? Ambiguous. |
| **The Socket.IO lesson** | ⚠️ Risk acknowledged: engine and CLI share types. If they always change together, coordinating two repos adds friction. Mitigated by keeping them in the SAME tools repo. | ✅ No coordination risk at all. | ✅ No coordination risk between engine+CLI (same repo). |

#### Recommendation: Option A — 3 Repositories

```
crocs-muni/
│
├── scrutiny-fabric                ← SPEC REPOSITORY
│   ├── docs/protocol-spec.md      # v0.5.1 — PROTOCOL SOURCE OF TRUTH
│   ├── docs/test-vectors.md       # 7 verified test vectors
│   ├── docs/test-vectors/*.json   # Machine-readable TV fixtures
│   ├── README.md                  # Protocol overview, status, implementer guide
│   └── LICENSE                    # MIT
│   → Semantic versioning: v0.5.1, v0.6.0, v1.0.0
│   → GitHub Releases map to protocol versions
│   → External devs clone ONLY this to understand protocol
│
├── scrutiny-fabric-tools          ← SDK MONOREPO (pnpm workspaces)
│   ├── pnpm-workspace.yaml        # packages/*
│   ├── package.json               # Root: dev scripts, lint, format
│   ├── tsconfig.base.json
│   ├── vitest.config.ts           # Root Vitest projects config
│   │
│   ├── packages/
│   │   ├── shared/                → @scrutiny-fabric/shared
│   │   │   └── src/               # event-kinds.ts, tag-keys.ts, relay-urls.ts
│   │   ├── engine/                → @scrutiny-fabric/engine
│   │   │   └── src/               # types, validation, diff, chain, bindings, canonical, identifiers, crypto, errors
│   │   │   └── __tests__/fixtures/# TV JSON files (synced from spec repo via CI)
│   │   └── cli/                   → @scrutiny-fabric/cli
│   │       └── src/               # Commander.js: publish, verify, resolve, watch, key, decode
│   │
│   ├── .github/workflows/
│   │   ├── ci.yml                 # Typecheck → lint → test → build
│   │   ├── publish.yml            # Changesets: version bump → npm publish
│   │   └── sync-test-vectors.yml  # Pull latest TV JSON from scrutiny-fabric repo
│   │
│   └── CONTRIBUTING.md
│   → npm scope: @scrutiny-fabric/
│   → Publishing: Changesets (independent versioning per package)
│   → CI gate: all 7 test vectors pass before npm publish
│
└── scrutiny-lens                  ← WEB APPLICATION
    ├── package.json               # Depends on @scrutiny-fabric/engine (pinned ^version)
    ├── svelte.config.js           # adapter-node, precompress
    ├── vite.config.ts
    ├── static/                    # favicon, robots.txt
    ├── src/routes/                # SvelteKit routes
    │   ├── product/[id]/          # SSR pages (SEO-critical)
    │   ├── graph/[rootId]/        # Cytoscape visualization
    │   ├── publish/               # Event publishing wizard
    │   └── settings/              # Relay/key management
    ├── nginx/
    │   └── scrutiny-lens.conf     # proxy_cache config, SSL termination, gzip
    ├── deploy/
    │   ├── Dockerfile             # Multi-stage: build → production image
    │   ├── docker-compose.yml     # Lens + Nginx reverse proxy
    │   └── scrutiny-lens.service  # systemd unit file
    ├── .github/workflows/
    │   ├── ci.yml                 # Typecheck → lint → unit tests → E2E
    │   └── deploy.yml             # Build Docker image → push to registry
    └── README.md
    → Independent deployment lifecycle
    → Consumes engine from npm (proves SDK is real)
    → Own Issue tracker for UX/web concerns
```

#### Implementation Steps to Split Current Repo

1. **Create `scrutiny-fabric-tools` repo**: Extract `packages/` directory + root configs (tsconfig base, ESLint, Prettier, Vitest) + `.github/workflows/`
2. **Create `scrutiny-lens` repo**: Extract `apps/scrutiny-lens/` + add deployment infra (Dockerfile, Nginx config, systemd unit)
3. **Purify `scrutiny-fabric` repo**: Keep only `docs/`, `README.md`, `LICENSE`. Remove all source code, `node_modules/`, `pnpm-lock.yaml`
4. **Add `CODEOWNERS`**: Spec repo → PI. Tools repo → lead developer. Lens repo → frontend developer.
5. **Archive old `packages/scrutiny-fabric/`** PoC code (already deprecated per AGENTS.md)
6. **Set up npm scope `@scrutiny-fabric`**: Reserve namespace on npmjs.com. Configure `publishConfig.access: public`.
7. **Implement TV sync CI**: A GitHub Action in tools repo that compares TV JSON against spec repo's canonical copy. Fails CI on drift. Runs on every push and weekly cron.

#### Rejection Rationale

- **Option B (single monorepo):** Defeats goal of an open, stand-alone protocol spec. Forces potential implementers to clone a 150MB+ TypeScript/Svelte repo to read a markdown file. First-ever monorepo in crocs-muni org — deviation requires justification the project doesn't need. "Packages in the same repo tend to couple accidentally" — WordPress Openverse and Socket.IO both noted this.
- **Option C (2-repo hybrid):** Half-measure. Spec still coupled to tools. Version ambiguity (is v1.0 the protocol or the CLI?). Tools repo still presents CLI context to spec-only contributors.

#### Key Principle

> **"Packages that change together live together."** Engine + CLI + shared belong in a monorepo because every protocol-level change ripples through all three atomically. Lens lives separately because it deploys independently, consumes engine from npm (just like any external consumer should), and has a fundamentally different audience and Issue taxonomy.

This matches:
- **CRoCS convention**: `scrutiny` (tools) + `scrutiny-viz` (web) split
- **Nostr ecosystem**: `nostr-protocol/nips` (spec) + individual clients (tools)
- **Open protocol principle**: Spec repo as single source of truth, independently forkable

---

## 3. Monorepo Structure

Based on pnpm workspaces, following patterns validated by Coracle (Svelte + pnpm), Turborepo monorepo guides, and the Storyie monorepo architecture that cleanly separates platform-agnostic cores from platform-specific shells.

```
scrutiny-fabric/
├── pnpm-workspace.yaml          # packages/* + apps/*
├── package.json                 # Root: dev scripts, lint, format
├── tsconfig.base.json           # Shared TS strict config
├── turbo.json                   # Build orchestration (optional, discussed below)
├── vitest.config.ts             # Root Vitest projects config
│
├── packages/
│   ├── engine/                  # @scrutiny-fabric/engine — THE PROTOCOL CORE
│   │   ├── package.json         # "main": "./src/index.ts" (uncompiled during dev)
│   │   ├── tsconfig.json        # composite: true, references: none
│   │   ├── vitest.config.ts     # extends root, uses defineProject
│   │   └── src/
│   │       ├── index.ts         # Public API barrel export
│   │       ├── types.ts         # ScrutinyEvent, ResolvedBinding, CanonicalState, etc.
│   │       ├── validation.ts    # Event validation (§3 event-type, content structure)
│   │       ├── diff.ts          # Patch apply: wraps jsdiff, enforces §5.2 rules
│   │       ├── chain.ts         # Chain resolution: walk e root / e reply links (§7)
│   │       ├── bindings.ts      # Binding resolution: directed + symmetric
│   │       ├── canonical.ts     # Compute canonical view for any product identifier
│   │       ├── identifiers.ts   # Identifier extraction from diffs + tags
│   │       ├── crypto.ts        # Event hash verification, sig validation (via nostr-tools)
│   │       ├── errors.ts        # Typed error hierarchy (InvalidEvent, ChainCycle, etc.)
│   │       ├── test-helpers/    # Reusable test utilities for fixture loading
│   │       │   └── index.ts
│   │       └── __tests__/
│   │           ├── fixtures/    # All 7 test vectors as JSON files
│   │           │   ├── tv-1-product-event.json
│   │           │   ├── tv-2-metadata-event.json
│   │           │   ├── tv-3-binding-reply.json
│   │           │   ├── tv-4-diff-patch.json
│   │           │   ├── tv-5-chain-resolution.json
│   │           │   ├── tv-6-retract-chain.json
│   │           │   └── tv-7-identifier-mirror.json
│   │           ├── validation.test.ts
│   │           ├── diff.test.ts
│   │           ├── chain.test.ts
│   │           ├── bindings.test.ts
│   │           ├── canonical.test.ts
│   │           └── identifiers.test.ts
│   │
│   ├── nostr/                   # @scrutiny-fabric/nostr — Relay communication shell
│   │   ├── package.json         # Depends on: engine, nostr-tools
│   │   ├── tsconfig.json        # composite: true, references: [../engine]
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── publish.ts       # Sign + publish scrutiny events via window.nostr / SimplePool
│   │       ├── subscribe.ts     # Subscribe to scrutiny events on configured relays
│   │       ├── pool.ts          # SimplePool configuration (ping, reconnect, relay list)
│   │       ├── signer.ts        # NIP-07 / BunkerSigner abstraction
│   │       ├── helpers.ts       # Tag construction, event template factories
│   │       └── __tests__/
│   │           ├── publish.test.ts
│   │           └── subscribe.test.ts
│   │
│   ├── ui/                      # @scrutiny-fabric/ui — Shared Svelte components
│   │   ├── package.json         # Depends on: engine (no nostr dep! pure presentation)
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── components/
│   │       │   ├── EventCard.svelte
│   │       │   ├── DiffViewer.svelte
│   │       │   ├── ChainTimeline.svelte
│   │       │   ├── ProductBadge.svelte
│   │       │   ├── BindingEdge.svelte
│   │       │   ├── TrustIndicator.svelte
│   │       │   └── IdentifierTag.svelte
│   │       └── lib/
│   │           ├── formatters.ts    # nip19 encoding display, timestamps
│   │           └── colors.ts        # Semantic color tokens for event types
│   │
│   └── shared/                  # @scrutiny-fabric/shared — Zero-dep types & constants
│       ├── package.json         # No runtime deps
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── event-kinds.ts   # Kind constants (product=?, metadata=?, etc.)
│           ├── tag-keys.ts      # Tag key constants ("t", "e", "i", etc.)
│           └── relay-urls.ts    # Default enabled relay URLs
│
├── apps/
│   ├── cli/                     # @scrutiny-fabric/cli — Terminal interface
│   │   ├── package.json         # Depends on: engine, nostr, shared
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts         # Entry point, Commander program setup
│   │       ├── commands/
│   │       │   ├── publish.ts   # `scrutiny publish` — create + sign + relay events
│   │       │   ├── verify.ts    # `scrutiny verify` — validate chain integrity
│   │       │   ├── resolve.ts   # `scrutiny resolve` — compute canonical view
│   │       │   ├── subscribe.ts # `scrutiny watch` — live relay subscription
│   │       │   ├── key.ts       # `scrutiny key` — generate/manage identity keys
│   │       │   └── decode.ts    # `scrutiny decode` — parse nevent/npub to hex
│   │       ├── output.ts        # Colored terminal output, JSON mode for piping
│   │       └── __tests__/
│   │           ├── publish.test.ts
│   │           ├── verify.test.ts
│   │           └── integration.test.ts
│   │
│   └── scrutiny-lens/           # Web application (SvelteKit)
│       ├── package.json         # Depends on: engine, nostr, ui, shared
│       ├── svelte.config.js     # adapter-node, precompress enabled
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── static/              # favicon, robots.txt, .nojekyll
│       └── src/
│           ├── app.html         # HTML shell
│           ├── routes/
│           │   ├── +layout.svelte           # Global layout (sidebar, relay status)
│           │   ├── +layout.ts               # Global data: relay pool init
│           │   ├── +page.svelte             # Landing: search by product identifier
│           │   ├── product/[id]/
│           │   │   ├── +page.svelte         # Product detail + event timeline
│           │   │   └── +page.ts             # Load event chain for product
│           │   ├── event/[id]/
│           │   │   ├── +page.svelte         # Single event detail
│           │   │   └── +page.ts
│           │   ├── graph/[rootId]/
│           │   │   ├── +page.svelte         # Cytoscape.js visualization
│           │   │   └── +page.ts
│           │   ├── publish/
│           │   │   ├── +page.svelte         # Create/edit event wizard
│           │   │   └── +page.ts
│           │   └── settings/
│           │       ├── +page.svelte         # Relay config, key management
│           │       └── +page.ts
│           ├── lib/
│           │   ├── components/
│           │   │   ├── cytoscape/
│           │   │   │   └── GraphView.svelte   # Reusable cytoscape wrapper (see §6.4)
│           │   │   ├── layout/
│           │   │   │   ├── Sidebar.svelte
│           │   │   │   ├── Header.svelte
│           │   │   │   └── Shell.svelte
│           │   │   └── nostr/
│           │   │       ├── SignInButton.svelte    # NIP-07 login
│           │   │       └── RelayStatus.svelte     # Connection indicator
│           │   ├── stores/
│           │   │   ├── relay-pool.svelte.ts    # SimplePool singleton
│           │   │   ├── identity.svelte.ts      # Current user pubkey/signer
│           │   │   └── settings.svelte.ts      # User preferences
│           │   └── utils/
│           │       ├── nostr.ts                # thin wrappers over @scrutiny-fabric/nostr
│           │       └── routing.ts              # path builders
│           └── __tests__/
│               ├── unit/
│               │   ├── GraphView.test.ts
│               │   └── stores.test.ts
│               └── e2e/
│                   ├── publish-workflow.spec.ts
│                   └── graph-navigation.spec.ts
│
├── docs/
│   ├── protocol-spec.md          # v0.5.1 spec (existing)
│   ├── test-vectors.md           # 7 verified TVs (existing)
│   └── architecture-plan.md      # This document
│
└── scripts/
    ├── build-fixtures.ts         # Regenerate TV JSON from markdown
    └── ci-checks.sh              # One-shot: install → typecheck → lint → test
```

### Why not Turborepo? (Yet)

Turborepo adds meaningful value when:
- You have 5+ packages whose builds must be ordered
- CI caching across PRs saves real money
  
At launch (3 internal packages, 2 apps), `pnpm --filter` + `tsc --build` handles ordering adequately. Coracle and Snort run fine without Turborepo. Add it later if build times exceed 30s on CI.

### Package dependency graph

```
shared (no deps)
  ↓
engine (no deps except shared)
  ↓   ↘
nostr   ui
  ↓     ↓
  cli   scrutiny-lens
```

The engine depends on nothing except `shared`. Both `nostr` and `ui` depend on `engine`. Apps depend on what they need. No circular dependencies (enforced by `pnpm-workspace.yaml` resolution).

---

## 4. Shared Protocol Engine (`@scrutiny-fabric/engine`)

This is the **immovable center** of the architecture. Everything else is a shell around it.

### Design philosophy: Functional Core, Imperative Shell

Following the pattern used by Pactio engineering, Nexus RPC SDK, and the general FCIS literature surveyed above:

- **Functional Core (engine):** Pure functions. Input → output. No I/O, no network, no filesystem. Testable with plain Vitest assertions.
- **Imperative Shell (nostr, cli, scrutiny-lens):** Handles relay communication, filesystem access, DOM rendering, user input.

Concrete example:

```typescript
// ENGINE (pure) — never touches network
export function computeCanonicalView(
  events: ScrutinyEvent[],
  targetIdentifier: string
): CanonicalState {
  // 1. Build adjacency list from e/p tags
  // 2. Walk chains from root events
  // 3. Apply patches sequentially (jsdiff)
  // 4. Resolve bindings
  // 5. Detect cycles per §7.5 (break on higher event ID hash)
  return { state: "...", chain: [...], trust: trustGranularity };
}

// NOSTR SHELL (impure) — does I/O, delegates to engine
export async function fetchCanonicalView(
  identifier: string,
  pool: SimplePool,
  relayUrls: string[]
): Promise<CanonicalState> {
  const events = await gatherEventsForIdentifier(identifier, pool, relayUrls);
  // Filter invalid events per §3
  const valid = events.filter(validateScrutinyEvent);
  // Pure computation, no I/O
  return computeCanonicalView(valid, identifier);
}
```

### Module responsibilities

#### `types.ts`

Every protocol concept gets a named type. No `any`. Discriminated unions for event types.

```typescript
export type ScrutinyEventKind = 'product' | 'metadata' | 'binding' | 'update' | 'retract';

export interface ScrutinyEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 1; // Always kind 1
  tags: string[][];
  content: string;
  sig: string;
  parsedKind: ScrutinyEventKind; // Derived from t tags (§3)
}

export interface ParsedPatch {
  hunks: PatchHunk[];
  addedIdentifiers: string[];
  removedIdentifiers: string[];
}

export interface CanonicalState {
  identifier: string;
  resolvedContent: string;      // After all patches applied
  bindings: ResolvedBinding[];   // Active bindings
  chain: ChainEntry[];            // Ordered event sequence
  trustLevel: TrustGranularity;
  warnings: ChainWarning[];      // Non-fatal issues (missing relay hint, etc.)
}
```

#### `validation.ts`

Implements §3 rules. Events with 0 or 2+ event-type `t` tags are invalid (ignored, not errored).

```typescript
export function validateScrutinyEvent(event: unknown): event is ScrutinyEvent {
  // Structural validation: kind=1, required fields present
  // Event-type extraction: exactly one matching t tag
  // Sig verification (delegated to nostr-tools verifyEvent)
}
```

#### `diff.ts`

Wraps `jsdiff` v8 (native TypeScript, no `@types/diff` needed). Implements §5.2 rules:

```typescript
import { parsePatch, applyPatch } from 'diff';

export function applyScrutinyPatch(
  currentContent: string,
  patchText: string
): ApplyResult {
  // 1. Parse unified diff
  const patches = parsePatch(patchText);
  // 2. Validate: no shorthand hunks, --unified=3 format, no index/mode lines
  // 3. Normalize LF line endings
  // 4. Concatenate multiple fenced blocks in appearance order
  // 5. Attempt apply
  const result = applyPatch(currentContent, patches[0]);
  if (result === false) return { success: false, error: 'patch-apply-failed' };
  // 6. Extract identifier changes from applied result
  return { success: true, result, addedIds, removedIds };
}
```

#### `chain.ts`

Core chain resolution. Walks event DAG along `e root`, `e reply`, and `e binding` tags. Detects cycles per §7.5.

```typescript
export function resolveChain(
  events: Map<string, ScrutinyEvent>,
  rootEventId: string
): ChainResolution {
  // DFS traversal building ordered array
  // Cycle detection: maintain visited set, break on higher event ID hash
  // Returns: linearized chain + any warnings
}
```

#### `canonical.ts`

Computes the authoritative state for a given identifier by resolving all chains and binding graphs.

```typescript
export function computeCanonicalView(
  events: ScrutinyEvent[],
  targetIdentifier: string
): CanonicalState {
  // 1. Find root product event for targetIdentifier
  // 2. Resolve chain from root
  // 3. Sequential patch application
  // 4. Binding resolution (directed + symmetric)
  // 5. Trust computation
}
```

#### `errors.ts`

Typed error hierarchy. Every possible failure mode gets a distinct error type.

```typescript
export class ScrutinyError extends Error {
  constructor(message: string, public code: ErrorCode) { super(message); }
}

// Specific errors:
// InvalidEventError, ChainCycleError, PatchApplyError,
// MissingRootError, BindingConflictError, RetractedEventError
```

### Engine does NOT do:
- WebSocket connections (that's `@scrutiny-fabric/nostr`)
- Filesystem reads/writes (that's CLI)
- DOM manipulation (that's `scrutiny-lens`)
- Key generation or signing (that's `nostr-tools`, wrapped by nostr package)
- Any side effects whatsoever

---

## 5. CLI Architecture (`@scrutiny-fabric/cli`)

### Framework choice: Commander.js

After evaluating oclif (Salesforce), Commander.js, clipanion, cac, and citty against our requirements:

| Requirement | Commander.js | oclif | clipanion |
|-------------|-------------|-------|-----------|
| Lightweight (~15KB) | ✅ | ❌ (heavy scaffolding) | ⚠️ (~25KB) |
| Subcommands (`publish`, `verify`, etc.) | ✅ via `.command()` | ✅ native | ✅ native |
| JSON output for scripting | Trivial | Built-in `--json` | Manual |
| Plugin system | Not needed | Overkill | Not needed |
| Auto-update | Not in Phase 1 | Built-in | Must add |
| Colored output | Via chalk | Via oclif ux | Via chalk |
| Windows support | ✅ | ✅ | ✅ |
| Learning curve | Minimal | Moderate | Low |

**Verdict:** Commander.js. We have 6 commands, not 60. oclif's plugin system, auto-update, and scaffolding complexity cost more than they save. If the CLI grows to 20+ commands in Phase 3, migration to oclif is straightforward (same underlying engine APIs).

### Binary distribution: Bun `--compile`

The pattern validated by Tigris CLI's migration from npm to standalone binaries:

- **Development:** `tsx src/index.ts` or `bun run src/index.ts`
- **npm distribution (Phase 1):** Standard `npm install -g @scrutiny-fabric/cli`. Requires Node.js ≥18. Works now.
- **Standalone binaries (Phase 2+):** `bun build ./src/index.ts --compile --outfile scrutiny-fabric`

Why Bun compile + npm dual-distribution:
- npm gives instant availability to the JS/Nostr developer audience (they already have Node)
- Standalone binary serves CI pipelines and minimal containers (no Node needed)
- Same entry point, same engine code. The Tigris approach: extract shared core, two thin wrappers.

```typescript
// src/index.ts — Commander setup
#!/usr/bin/env node
import { Command } from 'commander';
import { publishCommand } from './commands/publish';
// ...

const program = new Command()
  .name('scrutiny-fabric')
  .description('Decentralized security metadata protocol CLI')
  .version('0.1.0');

program.addCommand(publishCommand);
program.addCommand(verifyCommand);
program.addCommand(resolveCommand);
program.addCommand(subscribeCommand);
program.addCommand(keyCommand);
program.addCommand(decodeCommand);

program.parse();
```

### Command Design

Every command follows the same pattern:

1. **Parse args/flags** (Commander handles this)
2. **Read inputs** (stdin, file paths, relay URLs from flags or env)
3. **Shell layer** (connect to relays via `@scrutiny-fabric/nostr`, read files via fs)
4. **Delegate to engine** (pure compute functions)
5. **Format output** (colored terminal for humans, `--json` flag for machines)

#### `scrutiny publish`

```bash
scrutiny publish product \
  --identifier "example.com/product/v1" \
  --content @sbom.spdx.json \
  --sec <hex-key>

# Outputs signed event JSON to stdout, publishes to configured relays
# --dry-run flag skips relay publish
```

#### `scrutiny verify`

```bash
scrutiny verify <event-id> \
  --relay wss://relay.damus.io

# Fetches full event chain, validates all signatures,
# verifies diff applications produce consistent state
# Exit code 0 = valid, 1 = invalid, 2 = incomplete data
```

#### `scrutiny resolve`

```bash
scrutiny resolve "example.com/product/v1" \
  --relay wss://relay.damus.io,wss://nos.lol

# Computes canonical view for identifier
# Outputs structured JSON (always machine-readable for this command)
```

#### `scrutiny watch`

```bash
scrutiny watch "example.com/product/v1" \
  --relay wss://relay.damus.io

# Live subscription, streams events as they arrive
# Pipe-friendly: scrutiny watch ... | scrutiny verify -
```

### Output modes

Following nak's pipe-friendly design:

| Mode | Trigger | Format | Use Case |
|------|---------|--------|----------|
| Human-readable | Default (TTY detected) | Colored tables, progress spinners | Interactive terminal use |
| JSON | `--json` flag | NDJSON stream (one JSON object per line) | Piping to `jq`, CI scripts |
| Silent | `--quiet` flag | Exit code only (0/1) | CI gate checks |

### Key management

Per NIP-07 best practices from Coracle/Snort analysis:

- **Never** store `nsec` in config files
- Accept `--sec <hex>` for ephemeral usage (CI bots)
- Prefer `NOSTR_SECRET_KEY` environment variable (never appears in shell history)
- For persistent identity: generate keypair with `scrutiny key generate`, store encrypted
- NIP-46 bunker signer support in Phase 2 (uses `BunkerSigner` from nostr-tools v2.x)

### Progress indicators

Long-running operations (relay queries, chain resolution on deep graphs) get progress feedback using `ora` spinner library. Same pattern as Tigris CLI and nak.

```typescript
const spinner = ora('Resolving chain...').start();
try {
  const result = resolveChain(events, rootId);
  spinner.succeed(`Chain resolved: ${result.length} events`);
} catch (err) {
  spinner.fail(`Chain resolution failed: ${err.message}`);
}
```

---

## 6. Web App Architecture (`apps/scrutiny-lens`)

### Deployment model: Self-hosted SSR via adapter-node + Nginx

**Decision: adapter-node behind Nginx reverse proxy with proxy_cache for ISR-equivalent caching. Deployed on lab infrastructure (bare-metal or Docker). Product pages SSR so Google indexes them.**

Rationale:

| Requirement | Strategy | Rationale |
|-------------|----------|-----------|
| **Google-indexable product pages** | SSR (`+page.server.ts`) fetches chain from Nostr relays server-side, renders full HTML | Search engines receive complete `<title>`, `<meta description>`, and `<h1>` in the initial HTML response. No client JS needed for crawling. |
| **Repeat-visitor latency** | Nginx `proxy_cache` with `proxy_cache_background_update` and `proxy_cache_use_stale`. Same stale-while-revalidate pattern as Vercel ISR, but on your hardware. | Relay queries add ~500ms–2s latency. Cache amortizes this across visitors. Cache TTL configurable per route. |
| **Social sharing previews** | OG meta tags set per-product in `<svelte:head>` during SSR | When linked on Twitter/Discord/Slack, the unfurl shows the product identifier, binding count, and trust level. |
| **Faculty lab sovereignty** | All data stays on university hardware. No third-party platform dependency. Nostr relay connections come from your IP space. | Academic research tools often have data residency / IT policy constraints that make Vercel difficult. Self-hosting eliminates procurement hurdles. |
| **Infrastructure cost** | Uses existing lab servers or one $5–20/month VPS. Docker optional. Let's Encrypt free SSL. | Zero recurring platform fees beyond the server itself. |

Configuration:

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,            // Gzip static assets at build time
    }),
  },
};
```

```typescript
// .env (production)
ORIGIN=https://scrutiny-lens.example.edu
PORT=3000
HOST=127.0.0.1                     // Only listen on localhost (Nginx handles public traffic)
ADDRESS_HEADER=X-Forwarded-For     // Behind Nginx reverse proxy
XFF_DEPTH=1
```

**Per-route rendering strategy:**

| Route | SSR? | Nginx cache? | Why |
|-------|------|--------------|-----|
| `/` (landing/search) | Yes | No | Fresh content each visit |
| `/product/[id]` | Yes | Yes (5 min) | **SEO-critical.** Cached because chain resolution hits multiple relays |
| `/event/[id]` | Yes | Yes (5 min) | Deep-linking benefit; less SEO-critical but cache-worthy |
| `/graph/[rootId]` | Shell only | Yes (10 min, shell only) | Cytoscape.js needs DOM. SSR delivers frame; graph initializes client-side |
| `/publish` | Yes | No | Form, never cached |
| `/settings` | Yes | No | Per-user config |

**Nginx reverse proxy configuration:**

The key insight: Nginx's `proxy_cache` with `proxy_cache_background_update` and `proxy_cache_use_stale updating` provides identical stale-while-revalidate behavior to Vercel ISR — entirely on your own infrastructure.

```nginx
# /etc/nginx/sites-available/scrutiny-lens

# Define cache storage
proxy_cache_path /var/cache/nginx/scrutiny levels=1:2 keys_zone=SCRUTINY:50m
                 max_size=500m inactive=60m use_temp_path=off;

upstream scrutiny_node {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 443 ssl http2;
    server_name scrutiny-lens.example.edu;

    ssl_certificate     /etc/letsencrypt/live/scrutiny-lens.example.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scrutiny-lens.example.edu/privkey.pem;

    # Static assets with content-hashed filenames — aggressive browser cache
    location /_app/immutable/ {
        expires max;
        add_header Cache-Control "public, immutable";
        access_log off;
        proxy_pass http://scrutiny_node;
    }

    # Product pages: SSR output cached by Nginx (Google indexing targets)
    location /product/ {
        proxy_pass http://scrutiny_node;
        proxy_cache SCRUTINY;
        proxy_cache_valid 200 5m;                   # Cache OK for 5 minutes
        proxy_cache_valid 404 1m;                   # Brief cache for 404s
        proxy_cache_use_stale updating error timeout http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;            # Re-fetch in background subrequest
        proxy_cache_lock on;                         # Thundering herd: only 1 request hits Node
        proxy_cache_bypass $http_authorization;      # Logged-in users bypass cache
        proxy_no_cache $http_authorization;
        add_header X-Cache-Status $upstream_cache_status always;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Everything else: pass through to Node, no cache
    location / {
        proxy_pass http://scrutiny_node;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```

**Process management options:**

```bash
# Option A: PM2 (simplest)
pm2 start node --name "scrutiny-lens" -- -r dotenv/config build
pm2 save && pm2 startup

# Option B: systemd (no extra tooling)
# /etc/systemd/system/scrutiny-lens.service
[Service]
User=scrutiny
WorkingDirectory=/opt/scrutiny-lens
ExecStart=/usr/bin/node build
Environment=NODE_ENV=production
Environment=ORIGIN=https://scrutiny-lens.example.edu
EnvironmentFile=/opt/scrutiny-lens/.env.production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now scrutiny-lens
```

**Optional Docker setup:**

```dockerfile
# Dockerfile (multi-stage)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "build"]
```

```yaml
# docker-compose.yml
services:
  scrutiny-lens:
    build: .
    restart: always
    environment:
      - ORIGIN=https://scrutiny-lens.example.edu
    env_file: .env.production
    networks:
      - scrutiny

  nginx:
    image: nginx:stable-alpine
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/letsencrypt:ro
    ports:
      - "443:443"
      - "80:80"
    depends_on:
      - scrutiny-lens
    networks:
      - scrutiny

networks:
  scrutiny:
```

### Server-side data fetching

Same pattern as described in the engine design: the server creates a `SimplePool` per-request, queries relays, feeds results into the pure engine functions.

```typescript
// src/routes/product/[id]/+page.server.ts
import { gatherAndResolveProduct } from '$lib/server/resolver';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const productId = decodeURIComponent(params.id);
  const result = await gatherAndResolveProduct(productId);

  if (!result.found) {
    throw error(404, `Product "${productId}" not found`);
  }

  // Hint to Nginx: cache this response for 5 minutes
  // (Nginx proxy_cache respects Cache-Control from upstream)
  setHeaders({
    'cache-control': 'public, max-age=300, s-maxage=300',
  });

  return {
    productId,
    canonicalView: result.canonicalView,
    chainLength: result.chain.length,
    resolvedAt: new Date().toISOString(),
  };
};
```

```typescript
// src/lib/server/resolver.ts — NEVER imported in client code
import { computeCanonicalView, validateScrutinyEvent } from '@scrutiny-fabric/engine';
import { createRelayPool, queryChain } from '$lib/server/nostr';
import { SERVER_RELAY_URLS } from '$env/static/private';

export async function gatherAndResolveProduct(identifier: string) {
  const pool = createRelayPool(SERVER_RELAY_URLS.split(','));
  const raw = await queryChain(pool, identifier);
  const valid = raw.filter(validateScrutinyEvent);

  try {
    const view = computeCanonicalView(valid, identifier);
    return { found: true, canonicalView: view, chain: view.chain, bindings: view.bindings };
  } catch (err) {
    if (err instanceof ScrutinyError && err.code === 'MISSING_ROOT') {
      return { found: false };
    }
    throw err;
  }
}
```

### SEO Metadata Strategy

Every product page gets unique, server-rendered `<meta>` tags injected via `<svelte:head>`. Since these are rendered during SSR, Googlebot sees them without executing JavaScript.

```svelte
<!-- src/routes/product/[id]/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = `${data.productId} — Security Metadata`;
  const description = `${data.chainLength} protocol events, ${data.canonicalView.bindings?.length ?? 0} security bindings. Last verified: ${data.resolvedAt}`;
  const canonicalUrl = `https://scrutiny-lens.example.edu/product/${encodeURIComponent(data.productId)}`;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:site_name" content="SCRUTINY Lens" />
  <meta property="og:image" content="https://scrutiny-lens.example.edu/og-default.png" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>
```

**OG image:** Phase 3 uses a static 1200×630 PNG with the SCRUTINY logo. Phase 4 can add dynamic OG images via a SvelteKit `+server.ts` endpoint using `satori` + `@resvg/resvg-js` if per-product visual previews add value.

### Data flow: SSR vs Client navigation

```
First visit or crawler hit:
  Browser/Nginx → Node SSR (adapter-node)
    → SimplePool.query(relays, filter)
    → engine.computeCanonicalView(events, identifier)
    → Render HTML with inline data + meta tags
    → Nginx caches the response (5 min TTL)
    → Googlebot sees complete HTML

Subsequent client navigation (human user clicking around):
  SvelteKit client router → fetch('/product/X/__data.json')
    → Nginx cache HIT (serves cached JSON instantly)
  OR
    → Node SSR (re-runs query only if cache expired)
  → Hydrate component without full page reload

Next visitor within cache window:
  Browser → Nginx → Serves cached HTML directly (Node never touched)
```

The critical constraint: **Googlebot does not execute JavaScript for indexing.** The SSR path ensures every product page has its title, description, and structured content in the raw HTML payload. The Nginx cache layer prevents relay queries from being a bottleneck even if dozens of crawlers hit the same product simultaneously.

### Component Architecture

Following Feature-Sliced Design (FSD) principles validated for SvelteKit:

```
src/
├── app/           # Global: router, providers, auth guard
├── pages/         # Route-level composition (maps to routes/)
├── widgets/       # Reusable UI blocks combining features
├── features/      # User workflows: publish, inspect, resolve
├── entities/      # Core domain objects: ScrutinyEvent, Product, Binding
└── shared/        # Generic UI: buttons, inputs, modals (aliased to @scrutiny-fabric/ui)
```

Strict rule: **Dependencies flow downward.** `shared` → `entities` → `features` → `widgets` → `pages` → `app`. Never upward.

### State Management (Svelte 5 Runes)

No external state library. Svelte 5 runes (`$state`, `$derived`) handle everything. Deep reactivity (`$state.raw`) for large event arrays imported from the protocol engine to avoid Proxy overhead.

```typescript
// lib/stores/relay-pool.svelte.ts
import { SimplePool } from 'nostr-tools/pool';

let _pool: SimplePool;

export function getPool(): SimplePool {
  if (!_pool) {
    _pool = new SimplePool({
      enablePing: true,
      enableReconnect: true,
    });
  }
  return _pool;
}
```

**Pattern:** Store modules export factory functions, not singletons. Prevents SSR state leakage across requests (critical: one server process handles multiple concurrent users during SSR).

### Cytoscape.js Integration

A reusable Svelte 5 wrapper component (`GraphView.svelte`) based on the proven patterns from Tangled's implementation and community examples:

```svelte
<script lang="ts">
  import cytoscape from 'cytoscape';
  import dagre from 'cytoscape-dagre';
  import type { ElementDefinition, Stylesheet } from 'cytoscape';
  
  cytoscape.use(dagre);

  interface Props {
    elements: cytoscape.ElementDefinition[];
    stylesheet?: cytoscape.Stylesheet[];
    layoutOptions?: cytoscape.LayoutOptions;
    onNodeClick?: (nodeId: string) => void;
    onBackgroundClick?: () => void;
  }

  let {
    elements = [],
    stylesheet = [],
    layoutOptions = { name: 'dagre', rankDir: 'TB', spacingFactor: 1.5 },
    onNodeClick,
    onBackgroundClick,
  }: Props = $props();

  let containerDiv: HTMLDivElement | undefined = $state();
  let cyInstance: cytoscape.Core | null = $state(null);

  onMount(() => {
    if (!containerDiv) return;
    cyInstance = cytoscape({
      container: containerDiv,
      elements,
      style: stylesheet,
      layout: layoutOptions as cytoscape.LayoutOptions,
      pixelRatio: 1,           // Performance optimization per docs
      wheelSensitivity: 0.2,  
      hideEdgesOnViewport: true, // For large graphs
      textureOnViewport: true,   // Smooth pan/zoom on large graphs
    });

    // Event handlers
    cyInstance.on('tap', 'node', (evt) => onNodeClick?.(evt.target.id()));
    cyInstance.on('tap', (evt) => {
      if (evt.target === cyInstance) onBackgroundClick?.();
    });

    return () => { cyInstance?.destroy(); cyInstance = null; };
  });

  // Reactive: elements changed
  $effect(() => {
    if (!cyInstance) return;
    cyInstance.batch(() => {
      cyInstance.elements().remove();
      cyInstance.add(elements);
    });
    cyInstance.layout(layoutOptions).run();
  });
</script>

<div bind:this={containerDiv} class="graph-container"></div>

<style>
  .graph-container { width: 100%; height: 100%; }
</style>
```

**Performance optimizations** (from Cytoscape.js perf docs):
- `pixelRatio: 1` — reduces GPU memory on HiDPI screens
- `curve-style: haystack` — straight edge lines, cheapest render path
- `hideEdgesOnViewport: true` — hides edges during pan/zoom on large graphs
- `textureOnViewport: true` — uses cached texture during interactions
- `min-zoomed-font-size` — hide labels when zoomed out
- WebGL renderer opt-in (`renderer: { name: 'canvas', webgl: true }`) if we hit rendering bottlenecks at 500+ nodes

### Layout Strategy (Cola/Dagre)

The SCRUTINY graph is fundamentally a **directed acyclic graph** with tree-like chain structures. Dagre layout is ideal for:
- Hierarchical display showing event chains top-to-bottom
- Left-to-right for detailed event inspection
- Rank alignment showing temporal ordering

Cola layout is better for:
- Binding-heavy views (many lateral edges connecting separate chains)
- Avoiding overlapping nodes in dense graphs

The `GraphView` component accepts `layoutOptions` as a prop, allowing different views to choose different layouts.

### Authentication

NIP-07 (browser extension like nos2x, Alby, Flamingo) for signing. Pattern from nostr-tools docs:

```typescript
// lib/nostr/signer.ts
export function getNip07Signer() {
  if (!window.nostr) throw new Error('No NIP-07 extension found');
  return window.nostr;
}

export async function signAndPublishScrutinyEvent(
  event: UnsignedScrutinyEvent,
  relays: string[]
) {
  const signed = await getNip07Signer().signEvent(event);
  const pool = getPool();
  await Promise.all(relays.map(url => 
    pool.publish([url], signed)
  ));
}
```

---

## 7. Testing Strategy

### Philosophy: Test Vectors First

The 7 test vectors in `docs/test-vectors.md` (verified against `git apply --check`) are the **executable specification**. Every engine module must pass all TVs before any other tests matter.

### Vitest project configuration

Following Vitest's monorepo recommendations (not workspace — direct project configurations):

```typescript
// vitest.config.ts (ROOT)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/engine',
      'packages/nostr',
      'packages/ui',
      'apps/cli',
      'apps/scrutiny-lens',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/engine/src/**/*.ts'],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
```

Each package's config (`packages/engine/vitest.config.ts`):

```typescript
import { defineProject } from 'vitest/config';
import baseConfig from '../../vitest.config.shared'; // Shared base

export default defineProject({
  ...baseConfig,
  test: {
    name: 'engine',
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

### Test layers

#### Layer 0: Test Vector Validation (engine)

```typescript
// packages/engine/src/__tests__/test-vectors.test.ts
import { describe, it, expect } from 'vitest';
import tv1 from './fixtures/tv-1-product-event.json' assert { type: 'json' };

describe('Test Vector Suite', () => {
  it('TV-1: Validates product event structure', () => {
    expect(validateScrutinyEvent(tv1)).toBe(true);
    expect(tv1.parsedKind).toBe('product');
  });
  // ... repeat for all 7 TVs
});
```

#### Layer 1: Pure Engine Unit Tests

- Every exported function tested in isolation
- No relay connections, no filesystem
- Mock inputs from fixture JSON
- Target: 90%+ line coverage on engine package

#### Layer 2: Nostr Package Tests

- Mock SimplePool responses (Vitest mock factory)
- Test retry logic, connection failure handling
- Verify correct filter construction for relay queries
- Environment: `node` (no DOM needed)

#### Layer 3: UI Component Tests

```typescript
// Vitest with jsdom
import { render, screen } from '@testing-library/svelte';
import EventCard from '$lib/components/EventCard.svelte';

it('renders event kind badge', () => {
  render(EventCard, { props: { event: mockProductEvent } });
  expect(screen.getByText('product')).toBeInTheDocument();
});
```

#### Layer 4: E2E Tests (Playwright)

```typescript
// apps/scrutiny-lens/src/__tests__/e2e/publish-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('full publish workflow', async ({ page }) => {
  await page.goto('/publish');
  // Fill form, submit, verify relay publication
});
```

#### Layer 5: CLI Integration Tests

```typescript
// apps/cli/src/__tests__/integration.test.ts
import { execSync } from 'child_process';

it('resolves product identifier via CLI', () => {
  const output = execSync(
    'node dist/index.js resolve "example.com/product/v1" --json'
  ).toString();
  const result = JSON.parse(output);
  expect(result.identifier).toBe('example.com/product/v1');
});
```

### CI test matrix

| Platform | Node | Bun | Purpose |
|----------|------|-----|---------|
| ubuntu-latest | 22.x | ✅ | Primary CI |
| ubuntu-latest | 20.x | - | LTS compatibility |
| windows-latest | 22.x | - | Windows CLI verification |
| macos-latest | 22.x | - | macOS CLI verification |

### Coverage targets

| Package | Branches | Lines | Rationale |
|---------|----------|-------|-----------|
| `engine` | 90% | 95% | Protocol correctness demands near-exhaustive coverage |
| `nostr` | 70% | 80% | Relay interaction inherently has many failure modes; mock what you can |
| `ui` | 60% | 75% | Visual components benefit more from snapshot/E2E testing |
| `cli` | 60% | 70% | Integration tests cover more ground than unit tests here |

---

## 8. CI/CD Pipeline

### GitHub Actions workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck          # tsc --noEmit across all packages
      - run: pnpm lint               # ESLint + Prettier check
      - run: pnpm test -- --coverage # Vitest with coverage
      - run: pnpm build              # Verify everything compiles
      
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  e2e:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      # ... setup ...
      - run: pnpm exec playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: test-results/

  cli-integration:
    needs: quality
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      # ... setup ...
      - run: pnpm --filter @scrutiny-fabric/cli test:integration
```

### Release pipeline

```
git tag v0.1.0
→ GitHub Release created
→ npm publish (@scrutiny-fabric/engine, @scrutiny-fabric/cli, @scrutiny-fabric/nostr)
→ bun build --compile (cross-compile linux/macos/windows binaries)
→ Attach binaries to GitHub Release
→ Deploy scrutiny-lens static build to GitHub Pages / IPFS
```

Changesets for version management (standard pnpm monorepo pattern):

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

---

## 9. Performance Optimization

### Engine performance

The diff engine's hot path is `parsePatch` → `applyPatch`. From jsdiff v8 benchmarks:
- `applyPatch` on ~1000-line files: <1ms
- Chain resolution with 100 events: ~5ms

**No performance concerns** for Phase 1–2 workloads (hundreds of events per product, not millions).

If Phase 3 brings bulk scanning (thousands of products):

| Optimization | When | Expected gain |
|--------------|------|---------------|
| Event cache (`Map<id, event>`) | Day 1 (built in) | O(1) lookup |
| LRU canonical view cache | When >100 concurrent resolves | 10-50x repeated queries |
| Batch relay queries (negantropy) | When syncing full relay DBs | 100x fewer bytes over wire |
| Worker thread for chain resolution | When >10K events in a single chain | Offloads main thread |

### Cytoscape.js performance (from research)

Cytoscape.js rendering scales well up to ~1000 nodes/2000 edges with optimizations. The SCRUTINY graph for a typical product will have 10–100 events — well within comfort zone.

If visualizing entire relay contents (thousands of unrelated events):

| Strategy | Effect |
|----------|--------|
| `curve-style: 'haystack'` | 3-5x faster edge rendering vs bezier |
| `hideEdgesOnViewport: true` | Eliminates edge redraw during pan/zoom |
| `textureOnViewport: true` | Caches viewport during interaction |
| Virtual scrolling (pagination) | Never render >500 nodes simultaneously |
| LOD (level of detail) | Collapse sub-chains at zoomed-out view |

### Bundle size optimization (web app)

```typescript
// vite.config.ts (scrutiny-lens)
export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          cytoscape: ['cytoscape', 'cytoscape-dagre'],
          nostr: ['nostr-tools'],
          diff: ['diff'],
        },
      },
    },
  },
});
```

Expected split sizes:
- `cytoscape` chunk: ~400KB (loaded only on graph route, lazy)
- `nostr` chunk: ~80KB (loaded on all pages)
- `diff` chunk: ~40KB (loaded only on publish/detail routes)
- App shell: ~50KB

### Svelte 5 reactivity optimization

From Svelte 5 performance research (Issue #14721):
- Use `$state.raw` for large event arrays (avoids ~20% Proxy overhead)
- Keep derived computations in the engine (pure TypeScript, no Svelte reactivity overhead)
- Avoid deep reactivity on protocol event objects (they're immutable once received from relays)

```typescript
// Good: raw state for large immutable data
let events: ScrutinyEvent[] = $state.raw([]);

// Good: derived computed in engine, not in Svelte
let canonicalView: CanonicalState | null = $state(null);
$effect(() => {
  canonicalView = computeCanonicalView(events, identifier);
});

// Bad: deeply reactive large arrays
// let events: ScrutinyEvent[] = $state([]); // adds Proxy ~20% overhead
```

---

## 10. Dependency Manifest

### Production dependencies

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `nostr-tools` | ^2.23.0 | Nostr event creation, signing, validation, relay communication | nostr, cli, lens |
| `diff` (jsdiff) | ^8.0.0 | Unified diff parsing and application | engine |
| `zod` | ^3.24.0 | Runtime type validation (engine boundaries, event parsing) | engine |
| `cytoscape` | ^3.31.0 | Graph visualization | lens |
| `cytoscape-dagre` | ^2.5.0 | Directed graph layout for Cytoscape | lens |
| `commander` | ^13.0.0 | CLI argument parsing | cli |
| `chalk` | ^5.4.0 | Terminal color output | cli |
| `ora` | ^8.2.0 | Terminal spinners for long operations | cli |
| `bits-ui` | latest | shadcn-svelte UI primitives | lens, ui |
| `lucide-svelte` | latest | Icon library (per AGENTS.md constraint) | lens, ui |

### Development dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.x | Test runner |
| `@vitest/coverage-v8` | ^4.x | Code coverage |
| `playwright` | latest | E2E browser tests |
| `@playwright/test` | latest | Playwright test runner |
| `@testing-library/svelte` | latest | Svelte component testing |
| `typescript` | ^5.7.0 | Type checker |
| `eslint` | ^9.x | Linter |
| `prettier` | ^3.x | Formatter |
| `@sveltejs/kit` | ^2.x | Svelte framework |
| `@sveltejs/adapter-node` | ^4.x | Self-hosted Node.js deployment with SSR |
| `@sveltejs/vite-plugin-svelte` | ^5.x | Vite plugin for Svelte |
| `svelte` | ^5.x | Component framework |
| `tailwindcss` | ^4.x | CSS framework |
| `@changesets/cli` | ^2.x | Version management |
| `satori` | ^0.x | SVG → PNG OG image generation (Phase 4) |
| `@resvg/resvg-js` | ^2.x | Render SVG to PNG for OG images (Phase 4) |

### Peer dependency notes

Per nostr-tools v2 docs: requires TypeScript ≥5.0. Our monorepo uses ≥5.7 consistently.

adapter-node produces a self-contained Node.js server (`node build`). Run behind Nginx for SSL termination, static asset caching, and proxy_cache for SSR response caching.

---

## 11. Phase-Based Implementation Roadmap

### Phase 0: Foundation (Week 1–2)
**Goal:** Monorepo exists, engine passes all test vectors.

1. Scaffold monorepo (`pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`)
2. Create `@scrutiny-fabric/shared` package (event kinds, tag keys, relay URLs)
3. Create `@scrutiny-fabric/engine` package
4. Implement `types.ts`, `validation.ts`, `errors.ts`
5. Convert 7 test vectors to Vitest test files (JSON fixtures + assertions)
6. **Gate:** All 7 TVs pass. CI green on `pnpm typecheck && pnpm test`.

### Phase 1: Engine Complete (Week 3–5)
**Goal:** `computeCanonicalView` works for all TV scenarios.

1. Implement `diff.ts` (jsdiff wrapper, format validation, multi-block concatenation)
2. Implement `chain.ts` (DFS traversal, cycle detection)
3. Implement `bindings.ts` (directed + symmetric binding resolution)
4. Implement `canonical.ts` (orchestrate all above)
5. Implement `identifiers.ts` (extract IDs from diff content, mirror tags)
6. Add engine-specific tests beyond TVs (edge cases: empty chains, conflicting patches, cycle breaks)
7. **Gate:** 90%+ coverage on engine package. All spec sections covered by at least one test.

### Phase 2: CLI MVP (Week 6–8)
**Goal:** `scrutiny publish` and `scrutiny verify` work end-to-end.

1. Create `@scrutiny-fabric/nostr` package (SimplePool wrapper, NIP-07, publish helpers)
2. Create `@scrutiny-fabric/cli` package with Commander setup
3. Implement `publish` command (create event JSON, sign, relay)
4. Implement `verify` command (fetch chain, validate, exit code)
5. Implement `key` command (generate, display npub)
6. Add CLI integration tests (mock relay responses via Vitest)
7. npm publish dry-run
8. **Gate:** `scrutiny publish` → relay → `scrutiny verify` roundtrip succeeds on 3 test relays.

### Phase 3: Web App MVP (Week 9–12)
**Goal:** scrutiny-lens deployed on lab server with adapter-node + Nginx. Core visualization works.

1. Create `@scrutiny-fabric/ui` package (shared Svelte components)
2. Scaffold SvelteKit app with adapter-node
3. Implement server-side relay pool (`$lib/server/nostr-pool.ts`) for SSR data fetching
4. Set up Nginx reverse proxy with proxy_cache on product routes (see ADR-004 config)
5. Configure process management (PM2 or systemd, optionally Docker)
6. Implement identity store (NIP-07 client-only integration)
7. Build publishing wizard (`/publish` route)
8. Build product detail view with SEO metadata + cache headers (`/product/[id]`)
9. Build event detail page (`/event/[id]`)
10. Integrate Cytoscape.js with GraphView wrapper, implement `/graph/[rootId]`
11. Add OG meta tags to product pages with static fallback image
12. Add Certbot/Let's Encrypt SSL automation
13. E2E tests for publish → view → graph navigation flow
14. **Gate:** Product pages return full HTML with correct `<title>` + `<meta description>` (verified via `curl`, not browser). Google Search Console validates indexability. Nginx cache HIT confirmed via `X-Cache-Status` header.

### Phase 4: Polish & Hardening (Week 13+)
**Goal:** Production readiness.

1. Relay fault tolerance (connection retry, failover, stale event detection)
2. Search/discovery UX (find products by identifier prefix)
3. Trust visualization (color-coded nodes based on chain trust granularity)
4. Bulk verification (CLI batch mode)
5. Standalone binary builds (Bun `--compile`)
6. Comprehensive error messages (every engine error surfaced with actionable text in UI)
7. Accessibility audit (axe-core Vitest integration)
8. Performance profiling (Lighthouse budget, Cytoscape render budget)

---

## 12. Cross-Cutting Concerns

### Error handling strategy

Three tiers, inspired by Pactio's functional-core pattern:

1. **Engine errors** — typed exceptions (`ChainCycleError`, `InvalidEventError`). Pure computation failures. Never contain sensitive data.
2. **Shell errors** — caught at the I/O boundary (relay timeout, filesystem permissions, NIP-07 rejection). Translated to user-friendly messages with recovery suggestions.
3. **Panics** — unrecoverable (corrupt local storage, impossible state). Logged with full context, never shown raw to user.

Error propagation: Engine throws typed errors → Shell catches them → Shell renders contextual messages (CLI: red text with fix suggestion; Web: toast notification with action button).

### Logging

- **Engine:** No logging (pure functions). Errors are values, not console statements.
- **CLI:** `debug` npm package. `DEBUG=scrutiny:* scrutiny-fabric verify ...` enables verbose output.
- **Web:** Console only in development. No production console logs (use structured telemetry only if Phase 4+ adds analytics).

### Security invariants

Every CI run must verify:

1. **No private key exposure** — grep for `nsec`, hex key length strings in committed code, test fixtures
2. **Signature verification before chain admission** — enforced at type level: `UnsignedEvent` vs `SignedEvent`
3. **Event immutability** — engine never mutates received events; all operations return new objects
4. **Relay URL sanitization** — reject non-wss:// URLs in production relay lists

### Documentation standards

- **JSDoc on every exported function** in engine, nostr, and shared packages
- **README per package** with purpose statement, dependency rationale, usage example
- **Architecture Decision Records (ADRs)** for significant choices (SSR with Nginx caching, Commander vs oclif, Cytoscape vs alternatives, adapter-node self-hosted deployment)
- **Test vector docs** kept as executable specification (generate fixture JSON from markdown tables)

---

## 13. Anti-Patterns & Pitfalls

### Don't: Share Nostr state across packages as mutable globals

Coracle learned this hard way. Its `engine/` directory evolved to separate Nostr state (which needs cleanup, reconnection handling) from pure utilities. Our equivalent separation is `@scrutiny-fabric/nostr` (shell, manages state) vs `@scrutiny-fabric/engine` (core, stateless).

### Don't: Import nostr-tools in engine

The engine must stay pure. Importing `SimplePool`, relay logic, or signer code into the engine creates a dependency loop and prevents tree-shaking. Engine imports from `shared` only.

### Don't: Import `$lib/server/` modules in client code

SvelteKit enforces this boundary but custom resolvers can bypass it. Server-side relay pools and environment variables (`$env/static/private`) MUST never ship to the browser. The engine is safe (no I/O), but the nostr package's relay connection code is split:

```typescript
// ✅ Safe for both server and client
import { computeCanonicalView } from '@scrutiny-fabric/engine';

// ✅ Client-safe: wraps NIP-07 window.nostr signer
import { getNip07Signer, createBrowserPool } from '@scrutiny-fabric/nostr/client';

// ❌ Never imported in +page.svelte or +page.ts
// Only imported in +page.server.ts or $lib/server/
import { createServerPool } from '$lib/server/nostr-pool';
```

The `@scrutiny-fabric/nostr` package exposes two entry points:
- `@scrutiny-fabric/nostr` — Common utilities, event construction helpers (safe everywhere)
- `@scrutiny-fabric/nostr/client` — Browser-specific: NIP-07 signer wrapper, `SimplePool` with `.sub()`, `window.nostr`
- Server pool logic stays in `$lib/server/` within the lens app (not in a shared package, because only the web app needs SSR relay access)

### Don't: Use Svelte stores that persist across SSR requests

During SSR, one Node process handles many concurrent product-ID requests. Module-level mutable state (Svelte stores, module-scoped variables) leaks between requests. Use `$state` runes scoped to component lifecycle, never module-level shared state.

**Pattern:** The `SimplePool` for server-side relay communication MUST be created per-request inside the `load` function or a request-scoped helper. Never as a module singleton — otherwise relay connections from request A bleed into request B's query results.

### Don't: Hard-code relay URLs in engine

Default relay list lives in `@scrutiny-fabric/shared/relay-urls.ts`. It's imported by shells (CLI, web). Engine never references specific URLs.

### Don't: Skip `isolate: false` in Vitest without verifying safety

Vitest default is `isolate: true` (sandbox per test file). For engine unit tests, `isolate: false` gives ~3x speed improvement and is safe because engine tests have no shared mutable state. But UI tests (jsdom environment) MUST use `isolate: true` to prevent DOM pollution.

### Avoid: Cytoscape bezier edges for large graphs

From Cytoscape.js research (Issue #3309), bezier curves have O(n²) calculation time for parallel edges. SCRUTINY binding graphs can have many parallel edges. Default to `curve-style: 'haystack'` (straight lines, random offset) which is 5x+ faster.

### Avoid: Running Cytoscape layout on every element update

Use `cy.batch()` to group element additions, then run layout once. Layout recomputation on each `add()` call causes quadratic slowdown for graphs >100 nodes.

---

## 14. Appendix: Research References

The following projects, libraries, and analyses informed this architecture:

### Nostr Ecosystem
- **nostr-tools** (v2.23, npm): 838 stars, 90 contributors, production-grade. Only depends on @scure/@noble. Benchmark shows 86x slower than trusted mode but 6.9x faster than pure JS. nostr-wasm bridge available for perf-critical signing.
- **NDK** (Nostr Development Kit): Higher-level abstraction with caching, multi-relay coordination. Too heavy for our needs. Several projects migrated away from NDK toward nostr-tools for bundle size and simplicity.
- **Nostrify** (@nostrify/nostrify): AsyncGenerator-based relay streaming, JSR-native. Excellent pattern reference for relay communication abstractions.
- **nak** (fiatjaf/nak, Go): The gold standard for Nostr CLI design. Pipe-friendly, `--json` flags, negentropy sync, relay management. Our `scrutiny watch` and `scrutiny req` commands follow its ergonomics.
- **nostcat** (blakejakopovic/nostcat): WebSocket client for relay scripting. Demonstrates clean stdin/stdout pipe design.

### SvelteKit + Nostr Clients
- **Coracle** (coracle-social/coracle): 354 stars, Svelte 75%, pnpm monorepo. Architecture splits into `util/` (stateless), `engine/` (Nostr state), `partials/` (generic Svelte components), `app/` (application-specific). Funded by OpenSats since 2023. Our `engine` + `nostr` + `ui` split mirrors this.
- **Flotilla** (coracle-social/flotilla): Discord-like Nostr client, SPA with VITE_ env vars for customization. Shows white-label SvelteKit Nostr pattern.
- **Snort** (v0l/snort): React-based Nostr UI. Validates static deployment for social Nostr clients (different use case — SCRUTINY needs SSR for SEO on public product pages).
- **Welshman** (coracle-social/welshman): Extracted toolkit from Coracle. Demonstrates library extraction from production code.

### Monorepo Architecture
- **Storyie** monorepo: pnpm workspaces, `apps/` vs `packages/` split, `workspace:*` protocol. Clean TypeScript references pattern.
- **pnpm workspaces guide** (brockherion.dev): Shared tsconfig, project references, composite builds.
- **Turborepo + Vitest integration** (turborepo.dev): Hybrid approach (Vitest projects for local dev, Turbo tasks for CI caching). Adopted selectively.
- **Feature-Sliced Design for SvelteKit**: Entity/Feature/Widget/Page layering with unidirectional dependency rule. Prevents circular imports.
- **Vigerust monorepo**: SvelteKit + shared components + centralized config using Turborepo. Validates `@org/ui` package pattern.

### CLI Architecture
- **oclif** (Salesforce/open-source): Powers Heroku and Salesforce CLIs. Plugin system, auto-update, packagers. Overkill for our 6-command CLI today; migration path documented.
- **Commander.js**: ~15KB, battle-tested, handles 90% of CLI needs. Our choice for Phase 1–2.
- **cli-forge** (AgentEnder): Type-safe CLI builder. Interesting but too new (August 2024 first release). Monitor for future adoption.
- **zx** (google/zx, 45K stars): JavaScript shell scripting with bash integration. Useful for CI helper scripts. Not for the main CLI (needs proper Commands).
- **Tigris CLI** Bun migration: Demonstrated dual-distribution (npm + Bun compile). Generated command registry from YAML specs. Static import pattern for bundling.
- **Bunli**: CLI framework wrapping Bun compile. Simplifies cross-platform builds. Consider adopting if compiling for 5+ targets becomes tedious.

### Graph Visualization
- **Cytoscape.js** (11K stars): The de facto JS graph library. Canvas renderer with opt-in WebGL mode (PR #3314). Performance profiles well-characterized.
- **Cytoscape + Svelte wrapper** (Tangled commit): Reference implementation for Svelte 5 Cytoscape component. Uses `$effect` for reactive element updates, `onMount` for initialization, cleanup on destroy.
- **D3 force-directed in Svelte** (happybeing): Canvas mode with second context for hit detection is 10x faster than SVG for >500 nodes. Consider for alternative visualization but Cytoscape covers initial needs.

### Protocol & Identity Infrastructure (Cross-domain validation)
- **DKMS** (Hyperledger Aries): DID layers (DID → cloud agent → edge wallet). Microledgers for pairwise relationships. Validates SCRUTINY's decentralized identity model.
- **Weaver IIN** (Hyperledger Cacti): Identity exchange via DIDs across DLT networks. Network DIDs, membership credentials, trust anchors.
- **TradeChain**: Dual-ledger architecture (IDML for DIDs, TML for trade events). ZKP-based private credential proofs. CP-ABE for access control.
- **W3C Traceability Interop**: DID discovery via `did:web`, VC exchange, OAuth2 authentication across supply chains. Validates identifier-centric design.
- **SCITT / GUAC / in-toto**: Subject of previous cross-protocol vulnerability analysis. Their architectures informed our "minimal surface area" principle.

### Diff Engine
- **jsdiff** (kpdecker/jsdiff, 9K stars): Rewritten in TypeScript (v8). Supports Git extended headers, unified diff format, multi-file patches. `applyPatch` with fuzzy matching (`fuzzFactor`). Our exact format requirements map cleanly to jsdiff API.

### Testing
- **Vitest monorepo patterns**: `defineProject`, shared config, `isolate: false` for engine, `projects` array in root config.
- **Vitest related** (`vitest related --run FILE`): Change-based test selection for CI speed.
- **@fuf-stack/vitest-config**: Production-grade shared Vitest config patterns. Separate workspace-level (root) and project-level (package) configs.

---

*End of Architecture Plan — v1.0*