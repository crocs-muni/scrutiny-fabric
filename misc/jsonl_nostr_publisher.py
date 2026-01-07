#!/usr/bin/env python3
"""
Nostr Event Publisher using nostr-sdk
Reads unsigned events from JSONL, signs them, and publishes to relay(s).
"""

import json
import asyncio
from nostr_sdk import Keys, Client, EventBuilder, NostrSigner, RelayUrl, Tag, Kind

async def publish_events(jsonl_file: str, private_key_hex: str, relay_urls: list):
    """
    Load unsigned events from JSONL, sign and publish them.

    Args:
        jsonl_file: Path to JSONL file with unsigned events
        private_key_hex: Hex-encoded private key (nsec without prefix)
        relay_urls: List of relay WebSocket URLs
    """

    # Initialize keys and signer
    keys = Keys.parse(private_key_hex)
    signer = NostrSigner.keys(keys)

    # Initialize client
    client = Client(signer)

    # Add relays
    print("Adding relays...")
    for url in relay_urls:
        relay = RelayUrl.parse(url)
        await client.add_relay(relay)

    # Connect to relays
    print("Connecting to relays...")
    await client.connect()

    # Process events from JSONL
    print(f"\nProcessing events from {jsonl_file}...")
    event_count = 0
    success_count = 0

    with open(jsonl_file, 'r') as f:
        for line_num, line in enumerate(f, 1):
            try:
                # Parse unsigned event
                unsigned_data = json.loads(line.strip())

                # Extract components
                kind = Kind(unsigned_data['kind'])
                content = unsigned_data['content']
                tag_arrays = unsigned_data['tags']

                # Convert tag arrays to Tag objects
                tags = [Tag.parse(tag_array) for tag_array in tag_arrays]

                # Build event with all components
                builder = EventBuilder(kind, content).tags(tags)

                # Send event
                output = await client.send_event_builder(builder)

                event_count += 1

                # Check results
                if output.success:
                    success_count += 1
                    print(f"✓ [{line_num}] Published: {output.id.to_hex()}")
                    print(f"  Sent to: {output.success}")
                else:
                    print(f"✗ [{line_num}] Failed to publish")
                    print(f"  Failed relays: {output.failed}")

                # Rate limiting
                await asyncio.sleep(10.1)

            except Exception as e:
                print(f"✗ Line {line_num} failed: {e}")
                continue

    print("\n" + "=" * 60)
    print(f"Complete! Published {success_count}/{event_count} events")
    print("=" * 60)

async def main():
    print("=" * 60)
    print("Nostr Event Publisher (using nostr-sdk)")
    print("=" * 60)

    # Get user input
    jsonl_file = input("\nJSONL file path: ").strip()

    print("\nPrivate key format options:")
    print("  - Hex: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  # FAKE EXAMPLE KEY - DO NOT USE")
    print("  - Bech32: nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq  # FAKE EXAMPLE KEY - DO NOT USE")
    private_key = input("Private key: ").strip()

    relay_input = input("Relay URL(s) (comma-separated): ").strip()
    relay_urls = [url.strip() for url in relay_input.split(',')]

    # Confirm
    print(f"\n{'=' * 60}")
    print(f"Will publish to {len(relay_urls)} relay(s):")
    for url in relay_urls:
        print(f"  - {url}")
    print(f"{'=' * 60}")

    confirm = input("\nProceed? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("Aborted.")
        return

    # Publish events
    await publish_events(jsonl_file, private_key, relay_urls)

if __name__ == "__main__":
    asyncio.run(main())
