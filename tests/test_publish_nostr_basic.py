import asyncio
import json

import publish_nostr as pn


def test_validate_sha256_hex_ok():
    pn.validate_sha256_hex("a" * 64)


def test_validate_sha256_hex_bad():
    try:
        pn.validate_sha256_hex("g" * 64)
        assert False, "Expected ValueError for non-hex"
    except ValueError:
        pass


def test_validate_semver_ok():
    pn.validate_semver("1.2.3")
    pn.validate_semver("1.2.3-beta+meta")


def test_validate_semver_bad():
    for bad in ["01.2.3", "1.2", "1.2.3.4", "abc"]:
        try:
            pn.validate_semver(bad)
            assert False, f"Expected ValueError for {bad}"
        except ValueError:
            pass


def test_validate_date_format():
    pn.validate_date_yyyy_mm_dd("2025-01-31")
    for bad in ["2025-1-1", "20250131", "2025/01/31"]:
        try:
            pn.validate_date_yyyy_mm_dd(bad)
            assert False, f"Expected ValueError for {bad}"
        except ValueError:
            pass


def test_validate_https_url():
    pn.validate_https_url("https://example.com/path")
    try:
        pn.validate_https_url("http://example.com")
        assert False, "Expected ValueError for non-https"
    except ValueError:
        pass


def test_validate_wss_url():
    pn.validate_wss_url("wss://relay.damus.io")
    try:
        pn.validate_wss_url("ws://relay.example")
        assert False, "Expected ValueError for non-wss"
    except ValueError:
        pass


def test_validate_d_tag():
    assert pn.validate_d_tag("org.example.vendor:product-1") is None
    msg = pn.validate_d_tag("")
    assert isinstance(msg, str) and "Empty d-tag" in msg
    msg = pn.validate_d_tag("badprefix:prod")
    assert isinstance(msg, str) and "reverse DNS" in msg
    msg = pn.validate_d_tag("org.example:cpe:2.3:a:bad")
    assert isinstance(msg, str) and "Do not put CPE" in msg


def test_content_hashtags_basic():
    txt = pn.content_hashtags(pn.TAG_PRODUCT_BASE)
    assert "#scrutiny_mo" in txt
    assert "#scrutiny_product" in txt
    assert "#scrutiny_v01" in txt


def test_normalize_and_validate_cpe23_padding():
    cpe_short = "cpe:2.3:a:vendor:product:1.0"
    norm = pn.normalize_cpe23(cpe_short)
    parts = norm.split(":")
    assert len(parts) == 13
    pn.validate_cpe23(norm)


def test_validate_cpe23_bad_part():
    bad = "cpe:2.3:x:vendor:product:1.0::::::::"
    try:
        pn.validate_cpe23(bad)
        assert False, "Expected ValueError for bad part"
    except ValueError:
        pass


def test_strip_wrappers_extracts_token():
    url = "https://njump.me/note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"
    token = pn._strip_wrappers(url)
    assert token.startswith("note1")


def test_find_candidate_token_hex():
    hexid = "f" * 64
    token = pn._find_candidate_token(f"prefix {hexid} suffix")
    assert token == hexid


def test_parse_nostr_id_local_only_hex_roundtrip():
    hexid = "f" * 64
    out = pn.parse_nostr_id_local_only(hexid)
    assert out == hexid


def test_parse_nostr_id_local_only_invalid():
    try:
        pn.parse_nostr_id_local_only("not-a-valid-id")
        assert False, "Expected ValueError for invalid id"
    except ValueError:
        pass


def test_convert_ws_to_http():
    assert pn.convert_ws_to_http("wss://relay.example/x") == "https://relay.example/x"
    assert pn.convert_ws_to_http("ws://relay.example") == "http://relay.example"
    assert pn.convert_ws_to_http("https://relay.example") == "https://relay.example"
    assert pn.convert_ws_to_http("foo://bar") is None


def test_sha256_hex_known():
    assert (
        pn.sha256_hex(b"abc")
        == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )


def test_url_basename():
    assert pn.url_basename("https://host/path/file.txt") == "file.txt"
    assert pn.url_basename("https://host/") == "host"


def test_guess_mime_headers():
    m = pn.guess_mime({"content-type": "application/json; charset=utf-8"}, "https://x")
    assert m == "application/json"


def test_guess_mime_extension():
    m = pn.guess_mime({}, "https://example.com/image.png")
    assert m in ("image/png", None)


def test_decode_nprofile_invalid():
    try:
        pn.decode_nprofile("nprofile1qqqqqqqqqqqqqq")
        assert False, "Expected ValueError for invalid nprofile"
    except ValueError:
        pass


def test_decode_naddr_invalid():
    try:
        pn.decode_naddr("naddr1qqqqqqqqqqqqqq")
        assert False, "Expected ValueError for invalid naddr"
    except ValueError:
        pass


def test_blossom_upload_no_auth_success(monkeypatch):
    async def fake_http_request(method, url, **kw):
        data = json.dumps({"url": "https://blob.example/abc"}).encode("utf-8")
        return pn.SimpleResponse(200, {"content-type": "application/json"}, data)

    monkeypatch.setattr(pn, "http_request", fake_http_request)
    out = asyncio.run(
        pn.blossom_upload(
            "https://blossom.example", b"DATA", "file.bin", use_nip98=False, keys=None
        )
    )
    assert out == "https://blob.example/abc"


def test_blossom_upload_invalid_base_returns_none():
    out = asyncio.run(
        pn.blossom_upload("http://not-https.example", b"DATA", "file.bin", use_nip98=False, keys=None)
    )
    assert out is None


def test_publish_event_with_client_dry_run(monkeypatch):
    # Avoid network by using DRY_RUN and a simple note event
    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        keys = pn.Keys.generate()
        builder = pn.EventBuilder.text_note("hello")
        eid_hex = asyncio.run(pn.publish_event_with_client(keys, [], builder))
        assert isinstance(eid_hex, str) and len(eid_hex) == 64
    finally:
        pn.DRY_RUN = old