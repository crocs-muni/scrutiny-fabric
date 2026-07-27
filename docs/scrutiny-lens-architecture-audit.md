# SCRUTINY Lens — Architecture Audit & Remediation Plan

**Date:** 2026-05-16
**Scope:** Full source audit of `apps/scrutiny-lens/`
**Verdict:** The app has a solid foundation but is built against the wrong protocol version, uses deprecated patterns, and will become technical debt quickly if not addressed.

---

## Part 1 — Critical Issues (Blockers)

### C1 — Protocol Version Mismatch: Built for v0.5.2, Spec is v0.5.3

This is the most severe finding. Every layer of the app — types, stores, pages, formatters, graph — references event types and tag schemas that were **removed** in v0.5.3.

| v0.5.2 Concept (coded in app) | v0.5.3 Replacement | Impacted files |
|---|---|---|
| `update` event type | `patch` event type | 7 files |
| `retract` event type | NIP-09 kind 5 deletion | 7 files |
| NIP-32 labels (`l` tags, `scrutiny:product:vendor`, `scrutiny:binding:relationship`) | Removed entirely; products use `content` prose + `i` tags | 4 files |
| `q` tag binding endpoint | `e` tag with `link` marker | 3 files |
| Relationship vocabulary (`test`, `vulnerability`, `certification`, `audit`, `contains`, etc.) | Removed; bindings use free-form `content` only | 4 files |
| `buildBindingEvent()` with `anchor`/`other`/`relationship` params | New binding model with `e root`/`e link` only | 1 file |

**Concrete broken paths:**
- `event/[eventId]` displays "Update Event" and "Retraction Event" types that will never appear
- `search` filters out `update`/`retract` types but doesn't handle `patch`/kind-5
- `publish/binding` wizard builds events using the old `anchor`/`other`/`relationship` API from the engine
- NIP-32 labels displayed in event detail panels won't render — v0.5.3 events don't carry them
- `getLabelValue(event, "scrutiny:binding:relationship")` returns null for all v0.5.3 bindings
- `subscriptions.ts` bridges `#q` filter tags for the old binding query model

### C2 — Wrong Icon Library (Material Symbols)

AGENTS.md mandates **Lucide-Svelte ONLY**. The event detail page uses `material-symbols-outlined` class with Google Material Symbols codepoints (`memory`, `description`, `link`, `smart_toy`, `arrow_downward`, `attach_file`, `edit_note`, `block`) at **15+ locations** in `event/[eventId]/+page.svelte`.

**Impact:** UI will show missing/broken icons when Google Fonts aren't loaded. Breaks the consistency mandate. Adds a runtime dependency (Google Fonts CDN) not declared in CSP.

### C3 — Svelte 4 Legacy Patterns Across All Stores

AGENTS.md says "use runed/$state/$derived, avoid Svelte 4 legacy patterns." Every store file uses `writable()`/`derived()`/`get()` from `svelte/store`:

| File | Lines | Pattern Used | Should Be |
|---|---|---|---|
| `eventStore.ts` | 86 | `writable`, `derived`, `.subscribe()`, `get()` trick | `$state` maps, `$derived` arrays |
| `relayStore.ts` | 166 | `writable`, `derived`, `get()` | `$state` arrays/maps, `$derived` |
| `trustStore.ts` | 71 | `writable`, `derived`, `get()` | `$state` set, `$derived` count |
| `sessionStore.ts` | 57 | `writable`, `.update()`, `get()` | `$state` object |
| `settingsStore.ts` | 12 | `writable` | `$state` object |

**Impact:** The `get(eventStore)` pattern in `eventStore.ts` line 82-84 (`getEvent()`) subscribes and immediately unsubscribes — a known anti-pattern. Stores can't be composed reactively with `$derived`. SSR-unfriendly (stores leak across requests).

### C4 — Monolithic Route Pages (1277, 677, 686 LOC)

`event/[eventId]/+page.svelte` does everything in one file:
- Event fetching + binding traversal + targeting queries (lines 322-401)
- Trust filtering with admission set computation (67-84, 380-391)
- Graph data building + Cytoscape wiring (295-419)
- Product selection + chat context assembly (154-177, 403-505)
- Chat UI with message rendering, citations, input, suggestions (423-1119)
- Event detail panel with labels, identifiers, artifacts (568-864)
- URL state management for selected products (482-505)
- NIP-32 label parsing (`getLabels`, `getLabelValue` — 210-229)
- Binding endpoint rendering with old `q` tag model (686-738)

**Zero separation of concerns.** There's no `+page.ts` data loader, no extracted components, no composition. Every concern lives in one file. This is the primary source of future technical debt.

### C5 — No SSR / No Data Loaders

Every route page fetches data in `onMount` (client-side only). There are zero `+page.ts` or `+page.server.ts` files anywhere in the app. This means:
- No server-side rendering of event pages (empty HTML shell → JS hydration → data fetch)
- No SEO for product pages
- No Google indexing of SCRUTINY product data
- Users see spinners on every page load, even for previously visited events
- NDK is browser-only (`getNdk()` throws on server), locking out SSR entirely
- The architecture plan explicitly calls for SSR on product pages with Nginx caching

### C6 — Dead ai-service Proxies

3 SvelteKit server routes (`routes/api/chat/*`) proxy to the now-deleted ai-service at `localhost:8001`. The `settingsStore` references `/api/chat` as the default. These will 500 at runtime.

### C7 — Heavy Relay Layer (NDK)

The architecture plan (ADR-005) explicitly chose `nostr-tools` over NDK for its lower-level primitives and smaller bundle size. The app uses `@nostr-dev-kit/ndk` (v2.15.2) instead, which:
- Pulls in a full SDK (classes, caching, outbox, user profiles) when only `SimplePool.subscribe()` is needed
- Adds `@nostr-dev-kit/ndk-cache-dexie` as another dependency
- Forces browser-only architecture (prevents SSR)
- Bundle size is significantly larger than `nostr-tools`

---

## Part 2 — Major Issues (High Urgency)

### M1 — Protocol Type Spread (7 Files, Same Bug)

The old `update`/`retract` event types are hardcoded in these locations:
- `eventStore.ts:37-38` — `eventsByType` group
- `formatters.ts:43-44` — `eventTypeLabel`
- `EventTypeBadge.svelte:19-20,27-28` — labels + colors
- `graph/types.ts:15` — `GraphNode.type` union
- `graph/cytoscapeAdapter.ts:18-19,29,61` — colors, shapes, stylesheet
- `search/+page.svelte:66,195,205` — `isSearchableEvent`, `eventStatsMap`
- `event/[eventId]/+page.svelte:205-206,291,370-371` — event title, type color, filtering

Every one needs to change from `update`→`patch` and `retract`→NIP-09 handling.

### M2 — Binding Model Inconsistency

The engine's `buildBindingEvent()` currently accepts `anchor`/`other`/`relationship` params. The app passes these in `publish/binding/+page.svelte:179-184`. The v0.5.3 binding model is `e root` + `e link` with no relationship parameter. The engine API must change, and the app must follow.

### M3 — NIP-32 Label Extraction Still Active

`event/[eventId]` has `getLabels()` and `getLabelValue()` functions (lines 210-229) that parse NIP-32 `l` tags. These will never find data in v0.5.3 events. They produce empty arrays silently. The label rendering block (lines 775-800) always shows "Labels" section header but renders nothing — confusing UX.

### M4 — Search Filters Obsolete Event Types

`search/+page.svelte:66` filters out `update` and `retract` types from search results. The `eventStatsMap` (172-219) counts `update` and `retract` events targeting search results. Both are dead code against v0.5.3. The stats counters (bindings count, updates count on search cards) show "🔄 0" for all products.

### M5 — Graph Legend Wrong

GraphView legend (lines 148-160) shows "Product" (blue circle) and "Metadata" (amber diamond) but is missing "Binding" — bindings aren't rendered as nodes in the current graph builder (`buildGraphData` line 301 skips bindings). The legend is incomplete.

---

## Part 3 — Moderate Issues (Should Fix)

- **MOD-1:** `extractBindingReferencedEventIds()` supports `q` tags for "legacy" bindings — cleanup after migration
- **MOD-2:** Chat UI + chat state management is embedded in `event/[eventId]` — not reusable on other pages
- **MOD-3:** No route-level data loading — `+layout.svelte` does `initRelays()` + `initTrust()` in `$effect` but no loading state is shared to children
- **MOD-4:** `eventStore.getEvent()` (line 80-85) uses the subscribe-then-get anti-pattern instead of reactive access
- **MOD-5:** `settingsStore` is unused beyond the `aiServiceUrl` field — dead `showUntrusted` field (trustStore has its own)
- **MOD-6:** `publish/metadata` has no category field guidance — the old `scrutiny:metadata:category` labels are gone
- **MOD-7:** No error boundaries — if a relay query fails, the whole page shows "Event not found"
- **MOD-8:** Export and Filter buttons on event page are non-functional (dead UI)
- **MOD-9:** `truncateHex` used inconsistently — sometimes 8 chars, sometimes 12 chars
- **MOD-10:** Chat uses non-streaming `sendChatMessage()` — the streaming `streamChatMessage()` function exists in `ai/client.ts` but is never called

---

## Part 4 — What's Good (Preserve)

- **GraphView + CytoscapeAdapter:** Clean adapter pattern, proper Svelte 5 `$props()`/`$effect()`, Lucide icons, well-factored stylesheet
- **NIP-07 integration:** `publish.ts` handles async extension detection, timeout, signing, and multi-relay broadcast correctly
- **Security layer:** `sanitize.ts` HTML escaping, relay URL validation/normalization, ws:// allowed only for localhost
- **Trust filtering consistency:** Admission set computation is identical in both `onMount` and `$effect` (though duplication should be extracted)
- **Tailwind v4 + CSS setup:** Clean theme mapping, dark mode, custom dither utilities, font stacks
- **NDK caching:** `ndk-cache-dexie` provides automatic relay→cache→UI flow without manual cache calls
- **Relay lifecycle:** `relayStore.ts` + `pool.ts` coordinate relay state (add/remove/toggle/enabled) correctly with NDK pool sync
- **IndexedDB migration:** `db.ts` handles schema upgrades cleanly (v1→v2 dropped unused stores)
- **Publish drafts:** Draft persistence in IndexedDB with save-on-edit pattern (`$effect` → `saveDraft`) is solid

---

## Part 5 — Dependency Audit

| Dependency | Used? | Architecture Plan says? | Verdict |
|---|---|---|---|
| `@nostr-dev-kit/ndk` | Yes — pool, subscriptions, publishing | `nostr-tools` (ADR-005) | **Replace** |
| `@nostr-dev-kit/ndk-cache-dexie` | Yes — auto-caching | n/a | **Replace with nostr-tools equivalent** |
| `cytoscape` + `cytoscape-dagre` | Yes — GraphView | Cytoscape.js (ADR-006) | Keep |
| `idb` | Yes — publish drafts | Not specified | Keep (lightweight) |
| `isomorphic-dompurify` | Not found in source | n/a | **Remove** (unused, 0 imports) |
| `marked` | Yes — Markdown in chat | Not specified | Keep |
| `svelte-streamdown` | Yes (probably in prompt-kit) | Not specified | Keep |
| `@shikijs/themes` | Not found in source | n/a | **Remove** (unused) |
| `@internationalized/date` | Not found in source | n/a | **Remove** (unused, 0 imports) |
| `runed` | No actual usage found | Recommended | **Should use** (for `$state`/`$derived`) |
| `mode-watcher` | Yes — dark mode | Not specified | Keep |
| `clsx` + `tailwind-merge` | Yes — `cn()` in utils.ts | Not specified | Keep |
| `bits-ui` | Yes — shadcn components | shadcn-svelte (AGENTS.md) | Keep |
| `tailwind-variants` | Not found in source | Not specified | **Remove** (unused, use `clsx`+`twMerge`) |
| `svelte-sonner` | Yes — toast notifications | Not specified | Keep |
| `svelte-toolbelt` | Yes (bits-ui dep) | Not specified | Keep (transitive) |

**5 unused dependencies** should be removed to clean up the dependency tree and reduce bundle size.

---

## Part 6 — Architecture Comparison: Current vs Planned

| Concern | Architecture Plan | Current Code | Gap |
|---|---|---|---|
| **Engine layer** | Pure TS functions in `@scrutiny-fabric/engine` | Imported from `@scrutiny-fabric/scrutiny-fabric` | OK — engine exists |
| **Nostr layer** | Thin wrappers over `nostr-tools` `SimplePool` | `@nostr-dev-kit/ndk` (heavy SDK) | Wrong library |
| **State management** | Svelte 5 runes (`$state`/`$derived`) | Svelte 4 `writable`/`derived` | Wrong pattern |
| **SSR** | Product pages SSR with Nginx caching | Client-only rendering (no SSR) | Missing entirely |
| **Component composition** | Shared `@scrutiny-fabric/ui` package | Everything in route pages | Missing entirely |
| **Data loading** | `+page.ts` loaders, proper loading states | `onMount` fetch, spinner-only | Missing entirely |
| **Icon library** | Lucide-Svelte ONLY | Mixed (Lucide + Material Symbols) | Violates mandate |
| **Graph** | Cytoscape.js + dagre, adapter pattern | Cytoscape.js + dagre, adapter | Matches plan |
| **UI components** | shadcn-svelte via jsrepo | shadcn-svelte via jsrepo | Matches plan |
| **Styling** | Tailwind v4 | Tailwind v4 + custom CSS | Matches plan |
| **AI integration** | DSPy pipeline, persona system | Dead proxy routes to deleted service | Needs full rebuild |
| **Publishing** | NIP-07 signing, multi-relay publish | NIP-07 signing, multi-relay publish | Matches plan |

---

## Part 7 — Remediation Plan

### Phase 1: Protocol Alignment (Must Do First)

Everything else depends on the protocol model being correct.

| # | Action | Files affected | Effort |
|---|---|---|---|
| P1.1 | Align engine `@scrutiny-fabric/scrutiny-fabric` exports with v0.5.3 spec: remove `update`/`retract` types, add `patch`, remove relationship vocabulary exports, update `buildBindingEvent` to use `e root`/`e link` model, remove NIP-32 label builders | `packages/scrutiny-fabric/src/` | Large |
| P1.2 | Replace `ScrutinyType` union: `update`→`patch`, remove `retract` | `eventStore.ts`, all consumers | Small |
| P1.3 | Replace NIP-32 label parsing with `content`-based display | `event/[eventId]`, `publish/binding` | Medium |
| P1.4 | Update binding model: `q`→`e link`, `anchor`/`other`→`root`/`link` | `subscriptions.ts`, `binding-tags.ts`, `publish/binding` | Medium |
| P1.5 | Remove relationship vocabulary from UI (no structured types in v0.5.3) | `publish/binding`, `formatters.ts` | Small |
| P1.6 | Update graph node types: `update`→`patch`, remove `retract` | `types.ts`, `cytoscapeAdapter.ts`, `EventTypeBadge.svelte` | Small |
| P1.7 | Replace Material Symbols icons with Lucide equivalents | `event/[eventId]` | Small |

### Phase 2: Architectural Cleanup

| # | Action | Files affected | Effort |
|---|---|---|---|
| P2.1 | Migrate all stores from `writable`/`derived` to `$state`/`$derived` | All 5 store files | Medium |
| P2.2 | Extract components from `event/[eventId]`: `EventDetailPanel`, `EventList`, `ChatPanel`, `ProductSelector` | New files in `$lib/components/` | Large |
| P2.3 | Extract data fetching into `+page.ts` loaders for SSR | `event/[eventId]`, `search` | Large |
| P2.4 | Replace `@nostr-dev-kit/ndk` with `nostr-tools` `SimplePool` | `pool.ts`, `subscriptions.ts`, `publish.ts` | Medium |
| P2.5 | Remove unused dependencies: `isomorphic-dompurify`, `@shikijs/themes`, `@internationalized/date`, `tailwind-variants` | `package.json` | Tiny |
| P2.6 | Remove dead ai-service proxy routes and client code | `routes/api/chat/*`, `lib/ai/*`, `settingsStore.ts` | Small |
| P2.7 | Remove dead Filter/Export buttons | `event/[eventId]` | Tiny |
| P2.8 | Add `runed` usage for `$state`/`$derived` (remove manual import) | All stores | Small |

### Phase 3: Quality

| # | Action | Effort |
|---|---|---|
| P3.1 | Add SSR with `+page.ts` data loaders and `adapter-node` | Large |
| P3.2 | Build shared UI components (`EventCard`, `DiffViewer`, `ChainTimeline`) | Medium |
| P3.3 | Add streaming chat (already wired in client, just switch from `sendChatMessage` to `streamChatMessage`) | Small |
| P3.4 | Add `+error.svelte` error boundaries | Small |
| P3.5 | Add `+layout.ts` for shared loading state propagation | Small |

---

## Part 8 — File-Level Quick Reference

| File | LOC | Issues | Action |
|---|---|---|---|
| `routes/event/[eventId]/+page.svelte` | 1277 | C1, C2, C4, M2, M3 | Rewrite with component decomposition |
| `routes/search/+page.svelte` | 677 | C1, C4, M4 | Extract search logic, update filters |
| `routes/publish/binding/+page.svelte` | 686 | C1, C4, M2 | Simplify for v0.5.3 binding model |
| `routes/publish/product/+page.svelte` | 230 | C1 (NIP-32 labels) | Minor update |
| `routes/publish/metadata/+page.svelte` | 225 | C1 (category labels) | Minor update |
| `routes/+layout.svelte` | 114 | MOD-3 (no loading state) | Add loading indicator |
| `lib/stores/eventStore.ts` | 86 | C1, C3 | Migrate to runes, update types |
| `lib/stores/relayStore.ts` | 166 | C3 | Migrate to runes |
| `lib/stores/trustStore.ts` | 71 | C3 | Migrate to runes |
| `lib/stores/sessionStore.ts` | 57 | C3 | Migrate to runes |
| `lib/stores/settingsStore.ts` | 12 | C3, C6 | Migrate to runes, remove aiServiceUrl |
| `lib/nostr/pool.ts` | 93 | C7 | Replace NDK with nostr-tools |
| `lib/nostr/subscriptions.ts` | 309 | C1, C7 | Replace NDK, remove `#q` bridge |
| `lib/nostr/publish.ts` | 193 | C7 | Replace NDK with nostr-tools |
| `lib/graph/GraphView.svelte` | 233 | Good | Keep as-is |
| `lib/graph/cytoscapeAdapter.ts` | 283 | C1 (node types) | Update node types, keep adapter |
| `lib/graph/types.ts` | 70 | C1 (GraphNode.type) | Update type union |
| `lib/utils/formatters.ts` | 67 | C1 (labels) | Update event type labels |
| `lib/utils/binding-tags.ts` | 27 | M1 (`q` tag compat) | Remove `q` tag support |
| `lib/security/sanitize.ts` | 78 | Good | Keep as-is |
| `lib/cache/*` | 180 | Good | Keep as-is |
| `lib/ai/*` | 202 | C6 | Remove (dead code) |
| `lib/components/EventTypeBadge.svelte` | 39 | C1 (types, colors) | Update event types |
| `routes/api/chat/*` | 3 files | C6 | Remove (dead proxies) |
| `app.css` | 302 | Good | Keep as-is |