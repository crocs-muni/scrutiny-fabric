# SCRUTINY Fabric

Implementation of a Nostr overlay protocol for publishing and binding product/metadata events.

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

```
scrutiny-fabric/
├── apps/
│   ├── event-publisher/  # Svelte publisher app
│   └── lens-demo/        # React demo client
├── docs/                          # Protocol specification
├── package.json                   # Workspace configuration
└── pnpm-workspace.yaml
```

## Apps

### Event Publisher (`pnpm dev:pub`)
Svelte web app for publishing Nostr events (products, metadata, bindings).

### Lens Demo (`pnpm dev:lens`)
React web app demo for visualizing and interacting with Scrutiny events in Nostr.

## Protocol

See [docs/protocol-spec.md](docs/protocol-spec.md) for detailed protocol specification.

## Requirements

- Node.js 20+
- pnpm 9.0.0+

## Known Issues & TODOs

- [ ] Lens demo is still pretty chatty in the console (debug `console.log` in event categorization/relationship mapping)
- [ ] Legacy event detection is best-effort (multiple historical tag variants exist in the wild); consider adding fixtures + tests
- [ ] Relay queries can get large (many `#t` variants + follow-up fetches); consider tuning filters/backoff for strict relays

- [ ] Add CI to run:
	- `pnpm -r build` (apps)
	- `pnpm -r test` (where available)
	- `pytest` for `misc/tests`
- [ ] Add unit tests for `getLegacyScrutinyReason()` / legacy badge rendering
- [ ] Consider centralizing SCRUTINY tag variant lists (query + detection) to avoid drift
- [ ] Add linting for the Svelte app (and align repo-wide formatting/lint rules)

## License

MIT
