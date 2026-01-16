# SCRUTINY Fabric

A decentralized, permissionless protocol built on Nostr for binding security-relevant metadata to products. SCRUTINY Fabric enables transparent, auditable, and verifiable security information sharing through cryptographic signatures and hash verification. It supports comprehensive product lifecycle tracking, from certification and test results to vulnerability disclosures and performance benchmarks.

The protocol uses standard Nostr `kind:1` text notes with structured hashtags (`t` tags) and NIP-32 labels for semantic metadata. Events are immutable anchors that can be updated via reply chains, contested with evidence, and confirmed by independent parties. This creates a decentralized knowledge graph for security-critical products like smart cards, HSMs, cryptographic libraries, and hardware security modules.

> [!warning]
> **Work in Progress - Experimental Prototype**
>
> SCRUTINY Fabric is in early development and should not be used for production security decisions. The protocol specification and implementation is incomplete:
>
> - **Protocol**: Core specification defined (v0.2) with all event types documented
> - **Lens Demo**: Functional React app for viewing events; supports legacy formats
> - **Event Publisher**: Basic Svelte app for product events only; metadata and binding creation not yet implemented
> - **Python Tooling**: CLI tools for publishing events; basic tests included
>
> Features like full metadata publishing, binding creation, update/contestation UI, and relay optimizations are planned but not implemented. Expect breaking changes and use at your own risk. Contributions welcome!

## Quick Start

```bash
# Install dependencies (requires pnpm)
pnpm install

# Development
pnpm dev:pub      # Start event publisher (Svelte)
pnpm dev:lens     # Start lens demo (React)

# Build for production
pnpm build
```

## Project Structure

```bash
scrutiny-nostr/
├── apps/
│   ├── event-publisher/  # Svelte publisher app
│   └── lens-demo/        # React demo client
├── docs/                 # Protocol specification
├── misc/                 # Python tooling and depracated cli
├── package.json          # Workspace configuration
└── pnpm-workspace.yaml
```

## Apps

### Event Publisher (`pnpm dev:pub`)
A SvelteKit web application for creating and publishing SCRUTINY Fabric events to Nostr relays. Users can define products (e.g., smart cards, HSMs), ~~metadata (test results, certifications, vulnerabilities), and create bindings that link them together~~ (planned for future releases).

Supports NIP-07 wallet integration for signing events and includes form validation for protocol compliance.

### Lens Demo (`pnpm dev:lens`)
A React-based demo web application for exploring and visualizing SCRUTINY Fabric events from Nostr relays. Features an interactive graph view showing relationships between products, metadata, and bindings. Includes detailed event viewers, author filtering, and support for legacy event formats. Demonstrates real-time querying and rendering of the decentralized security knowledge graph.

## Protocol

SCRUTINY Fabric defines six event types for comprehensive security metadata management:

- **Product Events**: Immutable anchors for security products (smart cards, HSMs, libraries)
- **Metadata Events**: Pointers to relevant external data
- **Binding Events**: Links one or more products to one or more metadata events, establishing semantic relationships
- **Update Events**: Auditable corrections and additions via NIP-10 reply chains
- **Contestation Events**: Formal disputes with counter-evidence
- **Confirmation Events**: Independent endorsements and replications

All events use Nostr `kind:1` notes with structured `t` tags for categorization and NIP-32 labels for rich metadata.

See [docs/SCRUTINY_SPEC.md](docs/SCRUTINY_SPEC.md) for the complete protocol specification.

## Requirements

- Node.js 20+
- pnpm 9.0.0+

## Known Issues & TODOs

- [ ] Lens demo is still pretty chatty in the console (debug `console.log` in event categorization/relationship mapping)
- [ ] Legacy event detection is best-effort (multiple historical tag variants exist in the wild); consider adding fixtures + tests
- [ ] Relay queries can get large (many `#t` variants + follow-up fetches); consider tuning filters/backoff for strict relays
- [ ] Implement full metadata event publishing in Event Publisher app
- [ ] Implement binding event creation in Event Publisher app
- [ ] Add interactions for update, contestation, and confirmation events in Event Publisher app
- [ ] Optimize relay queries and add caching for better performance
- [ ] Add CI to run:
	- `pnpm -r build` (apps)
	- `pnpm -r test` (where available)
	- `pytest` for `misc/tests`
- [ ] Add unit tests for `getLegacyScrutinyReason()` / legacy badge rendering
- [ ] Consider centralizing SCRUTINY tag variant lists (query + detection) to avoid drift
- [ ] Add linting for the Svelte app (and align repo-wide formatting/lint rules)
- [ ] Add NIP-03 - OpenTimestamps Attestations for Events

## License

MIT
