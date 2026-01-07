#!/usr/bin/env python3
"""Relay URL handling without network.

This test verifies that RelayUrl.parse works and that a Client accepts add_relay
without attempting a network connection. This keeps the suite fast and stable.
"""
import asyncio
from nostr_sdk import Client, RelayUrl


def test_can_add_relay_without_connect():
    async def _run():
        # Parse a valid WSS relay URL and add it to a fresh client; do not connect.
        relay_url = RelayUrl.parse("wss://relay.damus.io")
        client = Client()
        try:
            await client.add_relay(relay_url)
            # If no exception is raised, the client accepted the relay configuration.
            assert True
        finally:
            # Ensure we leave the client in a clean state.
            try:
                await client.disconnect()
            except Exception:
                pass

    asyncio.run(_run())
