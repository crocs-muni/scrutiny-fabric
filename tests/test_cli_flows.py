import asyncio
import json
from typing import Any, Callable, Dict, List, Mapping, Optional, Union

import publish_nostr as pn


def _extract_event_json_from_stdout(stdout: str) -> Dict:
    start = stdout.find("{")
    end = stdout.rfind("}")
    assert start != -1 and end != -1 and end > start, "No JSON found in preview output"
    return json.loads(stdout[start : end + 1])


def _tvals(js: Dict) -> List[str]:
    vals = []
    for t in js.get("tags", []):
        if isinstance(t, list) and len(t) >= 2 and t[0] == "t":
            v = t[1]
            if isinstance(v, str) and v.startswith("#"):
                v = v[1:]
            vals.append(v)
    return vals


def _tag_vals(js: Dict, name: str) -> List[str]:
    return [t[1] for t in js.get("tags", []) if isinstance(t, list) and len(t) >= 2 and t[0] == name]


def _make_prompt_stub(plan: Mapping[str, Union[str, List[str]]]) -> Callable[..., str]:
    """
    Return a prompt() stub that serves answers from a plan mapping.
    If plan[label] is a list, serve values sequentially (pop-by-index).
    Falls back to provided default, or "" if none.
    """
    counters: Dict[str, int] = {}

    def _stub(
        label: str,
        default: Optional[str] = None,
        typ: Any = str,
        show_default: bool = True,
    ) -> str:
        if label in plan:
            v = plan[label]
            if isinstance(v, list):
                idx = counters.get(label, 0)
                ans = v[idx] if idx < len(v) else ""
                counters[label] = idx + 1
            else:
                ans = v
        else:
            ans = default if default is not None else ""

        # Coerce to expected type if requested
        if typ is int:
            try:
                return str(int(str(ans)))
            except Exception:
                # fall back to default as int, then to 0
                try:
                    return str(int(str(default or "0")))
                except Exception:
                    return "0"

        return str(ans)

    return _stub


def test_cli_product_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Answers for product flow prompts
    prompt_plan = {
        "Product name/title": "Test Widget",
        "vendor (text)": "Acme",
        "product_name (text)": "Widget",
        "purl (id)": "pkg:generic/widget@1.0.0",
        "release_date (YYYY-MM-DD)": "2025-01-31",
        "sbom_sha256 (64-hex, leave blank to auto compute if sbom_url given)": "",
    }
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub(prompt_plan))
    monkeypatch.setattr(
        pn,
        "prompt_https_optional",
        lambda label: "https://example.com" if "Canonical URL" in label else "",
    )
    monkeypatch.setattr(pn, "prompt_d_tag_optional", lambda: "org.example.vendor:test-1")
    monkeypatch.setattr(pn, "prompt_semver_or_text", lambda label: ("1.0.0", "semver"))
    # Valid 13-field CPE
    monkeypatch.setattr(
        pn,
        "prompt_cpe23_optional",
        lambda: "cpe:2.3:a:vendor:product:1.0:*:*:*:*:*:*:*",
    )
    # No picture and don't publish
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_product_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        tvals = _tvals(js)
        assert "scrutiny_mo" in tvals
        assert "scrutiny_product" in tvals
        assert "scrutiny_v01" in tvals

        assert "org.example.vendor:test-1" in _tag_vals(js, "d")
        assert "https://example.com" in _tag_vals(js, "url")

        # Some labels present (l tags)
        ltags = [t for t in js.get("tags", []) if t and t[0] == "l"]
        assert len(ltags) >= 3
    finally:
        pn.DRY_RUN = old


def test_cli_metadata_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Avoid network in hash step
    async def fake_fetch(url: str):
        return b"DATA", {"content-type": "application/pdf"}

    monkeypatch.setattr(pn, "fetch_bytes_and_headers", fake_fetch)

    # Prompt answers
    monkeypatch.setattr(pn, "prompt_https_optional", lambda label: "https://files.example.com/report.pdf")
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub({"Short title (optional, default: report.pdf)": "Report"}))
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_metadata_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        assert "https://files.example.com/report.pdf" in _tag_vals(js, "url")
        assert "application/pdf" in _tag_vals(js, "m")
        assert "4" in _tag_vals(js, "size")

        tvals = _tvals(js)
        assert "scrutiny_mo" in tvals
        assert "scrutiny_metadata" in tvals
        assert "scrutiny_v01" in tvals
    finally:
        pn.DRY_RUN = old


def test_cli_binding_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Provide event IDs directly
    monkeypatch.setattr(pn, "prompt_event_ids_list", lambda label, relays: ["a" * 64] if "Product" in label else ["b" * 64])
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub({"Optional note (Enter to skip)": ""}))
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_binding_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        e_vals = _tag_vals(js, "e")
        assert "a" * 64 in e_vals or "b" * 64 in e_vals
        tvals = _tvals(js)
        assert "scrutiny_binding" in tvals
    finally:
        pn.DRY_RUN = old


def test_cli_update_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Original event id
    monkeypatch.setattr(pn, "prompt_single_event_id", lambda label, relays: "c" * 64)

    # "Select (1-3)" -> choose Metadata (2) so we can update url/x
    prompt_plan = {
        "Select (1-3)": "2",
        "Update note (free text)": "small change",
    }
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub(prompt_plan))

    # Update url/x path
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: True if "Provide a new URL" in (a[0] if a else "") else False)
    monkeypatch.setattr(pn, "prompt_https_optional", lambda label: "https://cdn.example.com/new.bin")
    async def fake_fetch(url: str):
        return b"XX", {"content-type": "application/octet-stream"}
    monkeypatch.setattr(pn, "fetch_bytes_and_headers", fake_fetch)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_update_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        assert "c" * 64 in _tag_vals(js, "e")
        assert "https://cdn.example.com/new.bin" in _tag_vals(js, "url")
        assert any(v for v in _tag_vals(js, "x"))
        tvals = _tvals(js)
        assert "scrutiny_update" in tvals
        assert "scrutiny_metadata" in tvals
    finally:
        pn.DRY_RUN = old


def test_cli_contestation_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Contest an event and reference an alternative metadata event (choice 1)
    monkeypatch.setattr(pn, "prompt_single_event_id", lambda label, relays: ("e" * 64) if "Contested" in label else ("f" * 64))
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub({"Select (1-2)": "1", "Short reason (optional)": "mismatch"}))
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_contestation_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        e_vals = _tag_vals(js, "e")
        assert "e" * 64 in e_vals and "f" * 64 in e_vals
        tvals = _tvals(js)
        assert "scrutiny_contestation" in tvals
        assert "scrutiny_metadata" in tvals
    finally:
        pn.DRY_RUN = old


def test_cli_confirmation_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Confirm a Metadata event (type 2), with existing evidence id (path 1)
    monkeypatch.setattr(pn, "prompt_single_event_id", lambda label, relays: "1" * 64)
    prompt_plan = {
        "Select (1-3)": "2",  # Metadata
        "Confirmation note (optional)": "ok",
        "Select (1-2, Enter to skip)": "1",
    }
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub(prompt_plan))
    # Provide the evidence id
    monkeypatch.setattr(pn, "prompt_single_event_id", lambda label, relays: "1" * 64 if "Original event ID" in label else "2" * 64)
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: False)

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_confirmation_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 1
        e_vals = _tag_vals(js, "e")
        assert "1" * 64 in e_vals and "2" * 64 in e_vals
        tvals = _tvals(js)
        assert "scrutiny_confirmation" in tvals
        assert "scrutiny_metadata" in tvals
    finally:
        pn.DRY_RUN = old


def test_cli_delete_event_preview(monkeypatch, capsys):
    keys = pn.Keys.generate()
    nsec = keys.secret_key().to_bech32()

    async def fake_inputs():
        return nsec, ["wss://relay.damus.io"]

    monkeypatch.setattr(pn, "get_user_inputs_async", fake_inputs)

    # Proceed with delete, then enter two event IDs, then blank to stop
    monkeypatch.setattr(pn, "confirm", lambda *a, **k: True)

    plan = {
        "Event ID (hex/note/nevent/naddr/NIP-19 URI/URL)": ["a" * 64, "b" * 64, ""],
        "Reason (optional)": "cleanup",
    }
    monkeypatch.setattr(pn, "prompt", _make_prompt_stub(plan))

    old = pn.DRY_RUN
    pn.DRY_RUN = True
    try:
        asyncio.run(pn.create_delete_event())
        out = capsys.readouterr().out
        js = _extract_event_json_from_stdout(out)

        assert js["kind"] == 5
        e_vals = _tag_vals(js, "e")
        assert "a" * 64 in e_vals and "b" * 64 in e_vals
    finally:
        pn.DRY_RUN = old