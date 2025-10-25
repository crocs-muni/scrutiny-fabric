#!/usr/bin/env python3
"""Quick test to verify relay connection works with RelayUrl"""
import asyncio
from nostr_sdk import Client, RelayUrl

async def test_relay():
    client = Client()
    try:
        # Test adding relay with RelayUrl
        relay_url = RelayUrl.parse("wss://relay.damus.io")
        print(f"Parsed relay: {relay_url}")
        
        await client.add_relay(relay_url)
        print("✓ Successfully added relay to client")
        
        await client.connect()
        print("✓ Successfully connected to relay")
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass

if __name__ == "__main__":
    result = asyncio.run(test_relay())
    print(f"\nTest {'PASSED' if result else 'FAILED'}")
