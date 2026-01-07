"""Publish a pre-signed Nostr event (JSON) to one or more relays.

Usage:
  python publish_event_json.py [-r relay1,relay2] [event.json]

If no file is given, reads JSON from stdin.
The JSON should be a complete signed event (id, pubkey, created_at, kind, tags, content, sig).
This script will try to publish the event 'as-is' using the installed nostr_sdk Client.
It attempts a few common client entrypoints and reports per-relay results.
"""
import argparse
import asyncio
import json
import sys
from typing import Any, Dict, List

try:
    from nostr_sdk import Client
except Exception as e:
    print("Error: nostr-sdk not available. Install with: pip install nostr-sdk", file=sys.stderr)
    raise


async def publish_event_to_relays(event: Dict[str, Any], relays: List[str]) -> None:
    client = Client()
    for r in relays:
        try:
            await client.add_relay(r)
        except Exception:
            print(f"Warning: could not add relay {r}")
    try:
        await client.connect()
    except Exception as e:
        print(f"Warning: could not connect to relays: {e}")

    # Try a sequence of likely client methods that accept pre-signed events/dicts
    send_attempts = [
        "send_event",  # common
        "send_event_dict",
        "send_event_json",
        "send_raw_event",
        "publish_event",
        "publish",
        "send_event_builder",
    ]

    send_fn = None
    for name in send_attempts:
        if hasattr(client, name):
            send_fn = getattr(client, name)
            break

    if send_fn is None:
        # Fallback: try 'send_event_builder' by constructing a minimal wrapper
        print("No known publish method found on Client. Cannot publish pre-signed event.", file=sys.stderr)
        await client.disconnect()
        raise RuntimeError("Client has no known publish method")

    # If the method exists, call it. We pass the dict/JSON and let the SDK handle it.
    try:
        # If the callable is a coroutine function
        res = await send_fn(event)
        print("Publish returned:", res)
    except Exception as e:
        # Some SDK methods expect JSON string
        try:
            res = await send_fn(json.dumps(event))
            print("Publish returned:", res)
        except Exception as e2:
            await client.disconnect()
            raise RuntimeError(f"Publish failed: {e} / {e2}")

    await client.disconnect()


def load_event(path: str) -> Dict[str, Any]:
    if path == "-":
        data = sys.stdin.read()
    else:
        with open(path, "r", encoding="utf-8") as f:
            data = f.read()
    try:
        obj = json.loads(data)
    except Exception as e:
        raise RuntimeError(f"Invalid JSON: {e}")
    # Basic validation
    for k in ("id", "pubkey", "created_at", "kind", "tags", "content", "sig"):
        if k not in obj:
            raise RuntimeError(f"Missing required event field: {k}")
    return obj


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("file", nargs="?", default="-", help="Path to event JSON file (or - for stdin)")
    p.add_argument("-r", "--relays", default="wss://relay.damus.io", help="Comma-separated relay URLs")
    args = p.parse_args(argv)

    try:
        event = load_event(args.file)
    except Exception as e:
        print(f"Error loading event: {e}", file=sys.stderr)
        return 2

    relays = [r.strip() for r in args.relays.split(",") if r.strip()]

    try:
        asyncio.run(publish_event_to_relays(event, relays))
    except Exception as e:
        print(f"Publish error: {e}", file=sys.stderr)
        return 3
    print("Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
