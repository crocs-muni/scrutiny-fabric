# Scrutiny Nostr

Implementation of a Nostr overlay protocol for publishing and binding product/metadata events.

## Quick Start

```bash
# Install dependencies (requires pnpm)
pnpm install

# Development
pnpm dev:pub      # Start event publisher (SvelteKit) - http://localhost:5173
pnpm dev:lens     # Start lens demo (React) - http://localhost:5174

# Build for production
pnpm build
```

## Project Structure

```
scrutiny-nostr/
├── apps/
│   ├── scrutiny-event-publisher/  # SvelteKit publisher app
│   └── scrutiny-lens-demo/        # React demo client
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

- [ ] Svelte app needs linting setup (eslint not configured)
- [ ] Root scripts need cross-platform support for Windows
- [ ] Add CI/CD pipeline for automated builds
- [ ] Consider adding e2e tests for both apps
- [ ] Protocol spec needs versioning system

## License

MIT
