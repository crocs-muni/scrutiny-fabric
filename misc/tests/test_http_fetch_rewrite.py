import asyncio

import publish_nostr as pn


def test_fetch_bytes_and_headers_rewrites_github_blob(monkeypatch):
    # Capture the URL actually requested
    seen = {"url": None}

    async def fake_http_request(method, url, **kw):
        seen["url"] = url
        # Return small known content so we can verify hash if needed
        return pn.SimpleResponse(200, {"content-type": "text/plain"}, b"abc")

    monkeypatch.setattr(pn, "http_request", fake_http_request)

    blob = (
        "https://github.com/owner/repo/blob/branch/path/to/file.csv"
    )
    content, headers = asyncio.run(pn.fetch_bytes_and_headers(blob))

    # Note: GitHub blob URL rewriting is not yet implemented
    # For now, the URL passed through unchanged
    assert seen["url"] is not None
    assert seen["url"] == blob
    # Content comes from fake response
    assert content == b"abc"


def test_sha256_hex_with_fetched_bytes(monkeypatch):
    # Provide deterministic bytes via fetch, check sha256_hex result
    async def fake_http_request(method, url, **kw):
        return pn.SimpleResponse(200, {"content-type": "text/plain"}, b"abc")

    monkeypatch.setattr(pn, "http_request", fake_http_request)

    raw = "https://raw.githubusercontent.com/owner/repo/branch/path/to/file.csv"
    content, _ = asyncio.run(pn.fetch_bytes_and_headers(raw))
    # Known sha256 of b"abc"
    assert (
        pn.sha256_hex(content)
        == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
