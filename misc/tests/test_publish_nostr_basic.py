import asyncio
import json
from types import SimpleNamespace

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
    # Simple format without reverse DNS triggers warning
    msg = pn.validate_d_tag("badprefix:prod")
    assert isinstance(msg, str)
    msg = pn.validate_d_tag("nxp:j3a080")
    assert isinstance(msg, str)
    msg = pn.validate_d_tag("org.example:cpe:2.3:a:bad")
    assert isinstance(msg, str) and "Do not put CPE" in msg


def test_content_hashtags_basic():
    txt = pn.content_hashtags(pn.TAG_PRODUCT_BASE)
    assert "#scrutiny_fabric" in txt
    assert "#scrutiny_product" in txt
    assert "#scrutiny_v02" in txt


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

def test_add_scrutiny_t_tags_counts_and_values():
    tags = []
    before = len(tags)
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_PRODUCT_BASE, pn.TAG_METADATA_BASE)
    after = len(tags)
    # Should add namespace + 2 kinds + version = 4 tags
    assert after - before == 4

    # Normalize Tag objects back to vector form for inspection
    vecs = [t.as_vec() if hasattr(t, "as_vec") else [] for t in tags]
    # Extract all "t" tag values
    tvals = [v[1][1:] if v and v[0] == "t" and isinstance(v[1], str) and v[1].startswith("#") else v[1]
             for v in vecs if v and v[0] == "t"]

    assert "scrutiny_fabric" in tvals
    assert "scrutiny_product" in tvals
    assert "scrutiny_metadata" in tvals
    assert "scrutiny_v02" in tvals


def test_blossom_upload_missing_url_field_returns_none(monkeypatch):
    async def fake_http_request(method, url, **kw):
        # No url/href/location in JSON
        data = json.dumps({"message": "ok"}).encode("utf-8")
        return pn.SimpleResponse(200, {"content-type": "application/json"}, data)

    monkeypatch.setattr(pn, "http_request", fake_http_request)
    out = asyncio.run(
        pn.blossom_upload(
            "https://blossom.example", b"DATA", "file.bin", use_nip98=False, keys=None
        )
    )
    assert out is None


def test_blossom_upload_http_exception_returns_none(monkeypatch):
    async def fake_http_request(method, url, **kw):
        raise RuntimeError("server error")

    monkeypatch.setattr(pn, "http_request", fake_http_request)
    out = asyncio.run(
        pn.blossom_upload(
            "https://blossom.example", b"DATA", "file.bin", use_nip98=False, keys=None
        )
    )
    assert out is None


def test_http_request_retry_then_success(monkeypatch):
    """
    Simulate urlopen raising once (HTTP 500) and then succeeding.
    We patch pn.urlopen, which is used by http_request via asyncio.to_thread.
    """
    calls = {"n": 0}

    class FakeResp:
        def __init__(self, code, content=b"{}", headers=None):
            self._code = code
            self._content = content
            self.headers = headers or {"Content-Type": "application/json"}

        def getcode(self):
            return self._code

        def read(self):
            return self._content

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(req, timeout=60):
        calls["n"] += 1
        if calls["n"] == 1:
            # First call: behave like a server error (500)
            return FakeResp(500, b"server error")
        # Second call: success 200 with JSON body
        return FakeResp(200, b'{"ok": true}', {"Content-Type": "application/json"})

    monkeypatch.setattr(pn, "urlopen", fake_urlopen)

    # method=GET → no body
    resp = asyncio.run(pn.http_request("GET", "https://example.com/api"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert calls["n"] >= 2  # retried at least once

def test_parse_pubkey_to_hex_raw_hex():
    assert pn.parse_pubkey_to_hex("f" * 64) == "f" * 64

def test_parse_tlvs_simple():
    # TLV: type=0 len=3 "abc", type=2 len=32 pubkey bytes
    payload = b"\x00\x03abc" + b"\x02\x20" + (b"\x01" * 32)
    tlvs = pn._parse_tlvs(payload)
    assert 0 in tlvs and tlvs[0][0] == b"abc"
    assert 2 in tlvs and tlvs[2][0] == (b"\x01" * 32)


def test_fetch_relay_min_pow_variants(monkeypatch):
    # Fake http_request to return different JSON payloads by URL substring
    async def fake_http_request(method, url, **kw):
        if "relay.damus.io" in url:
            content = json.dumps({"limitation": {"min_pow_difficulty": 15}}).encode("utf-8")
        elif "relay.other" in url:
            content = json.dumps({"limits": {"pow": 5}}).encode("utf-8")
        else:
            content = json.dumps({}).encode("utf-8")
        return pn.SimpleResponse(200, {"content-type": "application/json"}, content)

    monkeypatch.setattr(pn, "http_request", fake_http_request)

    max_pow, diag = asyncio.run(pn.fetch_relay_min_pow(["wss://relay.damus.io", "wss://relay.other"]))
    assert max_pow == 15
    # diag should have two entries with reachable True
    r = [d for d in diag if d["url"].endswith("relay.damus.io")][0]
    assert r["reachable"] is True
    assert r["min_pow"] == 15
    r2 = [d for d in diag if d["url"].endswith("relay.other")][0]
    assert r2["reachable"] is True
    assert r2["min_pow"] == 5
    # forced should mark only the one with max_pow
    assert any(d["forced"] for d in diag) is True


def test_publish_event_broadcast_success(monkeypatch):
    # Fake Client implementation to capture send_event_builder calls
    class FakeClient:
        inst_counter = 0
        fail_instances = set()

        def __init__(self, signer=None):
            FakeClient.inst_counter += 1
            self.idx = FakeClient.inst_counter
            self.relays = []
            self.connected = False

        async def add_relay(self, r):
            self.relays.append(r)

        async def connect(self):
            self.connected = True

        async def send_event_builder(self, builder):
            if self.idx in FakeClient.fail_instances:
                raise RuntimeError("forced failure")
            # Return object with .id.to_hex()
            return SimpleNamespace(id=SimpleNamespace(to_hex=lambda: "f" * 64))

        async def disconnect(self):
            self.connected = False

    monkeypatch.setattr(pn, "Client", FakeClient)

    old_mode = pn.PUBLISH_MODE
    old_dry = pn.DRY_RUN
    pn.PUBLISH_MODE = "broadcast"
    pn.DRY_RUN = False
    FakeClient.inst_counter = 0
    FakeClient.fail_instances = set()

    try:
        keys = pn.Keys.generate()
        builder = pn.EventBuilder.text_note("hello broadcast")
        eid = asyncio.run(pn.publish_event_with_client(keys, ["wss://relay.one"], builder))
        assert eid == "f" * 64
    finally:
        pn.PUBLISH_MODE = old_mode
        pn.DRY_RUN = old_dry
        FakeClient.inst_counter = 0
        FakeClient.fail_instances = set()


def test_publish_event_first_success_with_initial_failure(monkeypatch):
    class FakeClient:
        inst_counter = 0
        fail_instances = set()

        def __init__(self, signer=None):
            FakeClient.inst_counter += 1
            self.idx = FakeClient.inst_counter
            self.relays = []
            self.connected = False

        async def add_relay(self, r):
            self.relays.append(r)

        async def connect(self):
            self.connected = True

        async def send_event_builder(self, builder):
            if self.idx in FakeClient.fail_instances:
                raise RuntimeError("forced failure")
            return SimpleNamespace(id=SimpleNamespace(to_hex=lambda: "a" * 64))

        async def disconnect(self):
            self.connected = False

    monkeypatch.setattr(pn, "Client", FakeClient)
    FakeClient.inst_counter = 0
    FakeClient.fail_instances = {1}  # first instance will fail

    old_mode = pn.PUBLISH_MODE
    old_dry = pn.DRY_RUN
    pn.PUBLISH_MODE = "first_success"
    pn.DRY_RUN = False

    try:
        keys = pn.Keys.generate()
        builder = pn.EventBuilder.text_note("first_success test")
        eid = asyncio.run(pn.publish_event_with_client(keys, ["wss://relay.one", "wss://relay.two"], builder))
        assert eid == "a" * 64
    finally:
        pn.PUBLISH_MODE = old_mode
        pn.DRY_RUN = old_dry
        FakeClient.inst_counter = 0
        FakeClient.fail_instances = set()
