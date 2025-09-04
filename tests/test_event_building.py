import asyncio
import json
from typing import Dict, List

import publish_nostr as pn


def _load_event_json_from_stdout(stdout: str) -> Dict:
    """
    Helper to extract the JSON blob printed by build_sign_preview_publish.
    Finds the first '{' and the last '}' and parses the substring.
    """
    start = stdout.find("{")
    end = stdout.rfind("}")
    assert start != -1 and end != -1 and end > start, "Could not locate JSON in output"
    blob = stdout[start : end + 1]
    return json.loads(blob)


def _tag_values(event_js: Dict, name: str) -> List[str]:
    """
    Return all second elements for tags with given name; normalize by stripping
    a leading '#' so it works for hashtag values with/without '#'.
    """
    vals: List[str] = []
    for t in event_js.get("tags", []):
        if isinstance(t, list) and len(t) >= 2 and t[0] == name:
            v = t[1]
            if isinstance(v, str) and v.startswith("#"):
                v = v[1:]
            vals.append(v)
    return vals


def test_build_product_like_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    content = "📦 SCRUTINY Product – Test"
    tags: List[pn.Tag] = []
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_PRODUCT_BASE)
    tags.append(pn.Tag.identifier("org.example.vendor:test-1"))
    tags.append(pn.Tag.parse(["url", "https://example.com"]))

    builder = pn.EventBuilder.text_note(content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    assert js["kind"] == 1
    tvals = _tag_values(js, "t")
    # Expect SCRUTINY namespace, product type, and version tag present
    assert "scrutiny_mo" in tvals
    assert "scrutiny_product" in tvals
    assert "scrutiny_v01" in tvals

    # d-tag and url tag present
    dvals = _tag_values(js, "d")
    assert "org.example.vendor:test-1" in dvals
    uvals = _tag_values(js, "url")
    assert "https://example.com" in uvals


def test_build_metadata_event_via_helper_no_network(monkeypatch, capsys):
    # Arrange fake fetch to avoid network and return deterministic data
    async def fake_fetch(url: str):
        return b"DATA", {"content-type": "application/pdf"}

    monkeypatch.setattr(pn, "fetch_bytes_and_headers", fake_fetch)
    # Avoid interactive confirm() in preview
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    # Force DRY_RUN to skip PoW and publishing, but keep preview JSON
    old_dry = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        keys = pn.Keys.generate()
        eid, published = asyncio.run(
            pn.build_and_publish_metadata_event(
                keys=keys,
                relay_urls=[],
                source_url="https://files.example.com/report.pdf",
                title="Report",
                offer_blossom=False,  # skip blossom branch
            )
        )
        assert isinstance(eid, str) and len(eid) == 64
        assert published is False  # preview path didn’t publish

        out = capsys.readouterr().out
        js = _load_event_json_from_stdout(out)

        assert js["kind"] == 1
        # metadata tags present
        assert "https://files.example.com/report.pdf" in _tag_values(js, "url")
        assert "application/pdf" in _tag_values(js, "m")
        assert "4" in _tag_values(js, "size")  # len(b"DATA") == 4

        tvals = _tag_values(js, "t")
        assert "scrutiny_mo" in tvals
        assert "scrutiny_metadata" in tvals
        assert "scrutiny_v01" in tvals
    finally:
        pn.DRY_RUN = old_dry


def test_build_binding_like_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    # Fake product/metadata event ids (hex)
    prod = "a" * 64
    meta = "b" * 64

    content = "🔗 SCRUTINY Binding"
    tags: List[pn.Tag] = []
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_BINDING_BASE)
    tags.append(pn.Tag.parse(["e", meta, "", "mention"]))
    tags.append(pn.Tag.parse(["e", prod, "", "mention"]))

    builder = pn.EventBuilder.text_note(content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    assert js["kind"] == 1
    e_ids = _tag_values(js, "e")
    assert meta in e_ids and prod in e_ids
    tvals = _tag_values(js, "t")
    assert "scrutiny_binding" in tvals


def test_build_update_like_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    root = "c" * 64
    new_url = "https://cdn.example.com/new.bin"
    new_x = "d" * 64

    content = "✏️ SCRUTINY Update"
    tags: List[pn.Tag] = []
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_UPDATE_BASE, pn.TAG_METADATA_BASE)
    tags.append(pn.Tag.parse(["e", root, "", "root"]))
    tags.append(pn.Tag.parse(["url", new_url]))
    tags.append(pn.Tag.parse(["x", new_x]))

    builder = pn.EventBuilder.text_note(content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    assert js["kind"] == 1
    assert root in _tag_values(js, "e")
    assert new_url in _tag_values(js, "url")
    assert new_x in _tag_values(js, "x")
    tvals = _tag_values(js, "t")
    assert "scrutiny_update" in tvals
    assert "scrutiny_metadata" in tvals


def test_build_contestation_like_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    contested = "e" * 64
    alternative = "f" * 64

    content = "⚖️ SCRUTINY Contestation"
    tags: List[pn.Tag] = []
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_CONTEST_BASE, pn.TAG_METADATA_BASE)
    tags.append(pn.Tag.parse(["e", contested, "", "root"]))
    tags.append(pn.Tag.parse(["e", alternative, "", "mention"]))

    builder = pn.EventBuilder.text_note(content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    e_ids = _tag_values(js, "e")
    assert contested in e_ids and alternative in e_ids
    tvals = _tag_values(js, "t")
    assert "scrutiny_contestation" in tvals
    assert "scrutiny_metadata" in tvals


def test_build_confirmation_like_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    root = "1" * 64
    evidence = "2" * 64

    content = "✅ SCRUTINY Confirmation"
    tags: List[pn.Tag] = []
    tags = pn.add_scrutiny_t_tags(tags, pn.TAG_CONFIRM_BASE, pn.TAG_METADATA_BASE)
    tags.append(pn.Tag.parse(["e", root, "", "root"]))
    tags.append(pn.Tag.parse(["e", evidence, "", "mention"]))

    builder = pn.EventBuilder.text_note(content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    e_ids = _tag_values(js, "e")
    assert root in e_ids and evidence in e_ids
    tvals = _tag_values(js, "t")
    assert "scrutiny_confirmation" in tvals
    assert "scrutiny_metadata" in tvals


def test_build_delete_event():
    keys = pn.Keys.generate()
    signer = pn.NostrSigner.keys(keys)

    target = pn.EventId.parse("3" * 64)
    content = "🗑️ SCRUTINY Delete"
    tags: List[pn.Tag] = [pn.Tag.event(target)]
    builder = pn.EventBuilder(pn.Kind(5), content).tags(tags)
    ev = asyncio.run(builder.sign(signer))
    js = json.loads(ev.as_json())

    assert js["kind"] == 5
    # 'e' tag includes the event id of the target
    assert target.to_hex() in _tag_values(js, "e")