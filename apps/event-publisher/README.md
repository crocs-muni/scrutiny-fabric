# SCRUTINY Fabric Event Publisher

SvelteKit + TypeScript app for creating and publishing SCRUTINY Fabric protocol events (Nostr `kind:1` with NIP-32 labels). Everything happens in the browser—no backend.

## Key Features

- ProductEvent form with validation (Zod) and draft persistence
- NIP-07 signing (browser extension required)
- Relay publishing with configurable relay list (header modal)
- Offline awareness: blocks publish when offline, keeps drafts locally
- Auto-generated event content with optional manual edit mode
- Dark/light/theme toggle and relay status indicators

## Getting Started

```sh
npm install
npm run dev -- --open
```

## Building

```sh
npm run build
npm run preview
```

## Notable UI Flows

- **Relays**: Click “Relays: X/Y” in the header to manage the relay list (add/remove/reset).
- **Content**: Event content auto-generates from form fields; switch to manual mode to edit, or reset to auto.
- **Signing & Publish**: Validate → Preview & Sign → Publish to configured relays.

## Requirements

- NIP-07 browser extension (e.g., nos2x, Alby) for signing.
- Modern browser with `navigator.onLine` events for online/offline detection.
