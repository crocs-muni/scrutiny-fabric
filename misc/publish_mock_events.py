#!/usr/bin/env python3
"""
SCRUTINY Fabric — Mock Event Publisher
Publishes a rich set of test events to a local (or remote) Nostr relay.

Usage:
    python publish_mock_events.py [--relay ws://localhost:7777]

Requires: pip install nostr-sdk
"""

import asyncio
import argparse
import json
from nostr_sdk import Keys, Client, EventBuilder, Tag, Kind, NostrSigner

# ---------------------------------------------------------------------------
# Relay target
# ---------------------------------------------------------------------------
RELAY = "ws://localhost:7777"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def t(value: str) -> Tag:
    return Tag.parse(["t", value])

def label_ns(namespace: str) -> Tag:
    return Tag.parse(["L", namespace])

def label_val(value: str, namespace: str) -> Tag:
    return Tag.parse(["l", value, namespace])

def identifier(value: str) -> Tag:
    return Tag.parse(["i", value])

def e_root(event_id: str, relay_hint: str, pubkey_hint: str) -> Tag:
    return Tag.parse(["e", event_id, relay_hint, "root", pubkey_hint])

def q_ref(event_id: str, relay_hint: str, pubkey_hint: str) -> Tag:
    return Tag.parse(["q", event_id, relay_hint, pubkey_hint])

def scrutiny_base(type_tag: str) -> list:
    return [t("scrutiny_fabric"), t(type_tag), t("scrutiny_v032")]


async def publish_event(client: Client, signer: NostrSigner, content: str, tags: list, label: str) -> str:
    pk = await signer.get_public_key()
    unsigned = EventBuilder(Kind(1), content).tags(tags).build(pk)
    signed = await signer.sign_event(unsigned)
    await client.send_event(signed)
    eid = signed.id().to_hex()
    print(f"  ✓ {label}")
    print(f"    id: {eid}")
    return eid


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(relay: str):
    print(f"\n🔗 Connecting to relay: {relay}\n")

    # Generate 4 actor keypairs
    vendor_a   = Keys.generate()
    vendor_b   = Keys.generate()
    researcher = Keys.generate()
    auditor    = Keys.generate()

    va_pk  = vendor_a.public_key().to_hex()
    vb_pk  = vendor_b.public_key().to_hex()
    re_pk  = researcher.public_key().to_hex()
    au_pk  = auditor.public_key().to_hex()

    print("Generated keypairs:")
    print(f"  VENDOR_A   (Infineon)    {va_pk}")
    print(f"  VENDOR_B   (NXP)         {vb_pk}")
    print(f"  RESEARCHER               {re_pk}")
    print(f"  AUDITOR                  {au_pk}")
    print()

    # Create one client per actor (each with its own signer)
    async def make_client(keys: Keys):
        signer = NostrSigner.keys(keys)
        client = Client(signer)
        await client.add_relay(relay)
        await client.connect()
        return client, signer

    client_va, signer_va = await make_client(vendor_a)
    client_vb, signer_vb = await make_client(vendor_b)
    client_re, signer_re = await make_client(researcher)
    client_au, signer_au = await make_client(auditor)

    # -----------------------------------------------------------------------
    # PRODUCTS
    # -----------------------------------------------------------------------
    print("── Products ──────────────────────────────────────────────────────")

    p1_id = await publish_event(client_va, signer_va,
        "Infineon SLE97 — NFC dual-interface smart card IC. CC EAL6+ (BSI-DSZ-CC-0973) certified.",
        scrutiny_base("scrutiny_product") + [
            identifier("cpe:2.3:h:infineon:sle97:-:*:*:*:*:*:*:*"),
            identifier("cc:BSI-DSZ-CC-0973"),
            label_ns("scrutiny:product:vendor"),   label_val("Infineon Technologies AG",     "scrutiny:product:vendor"),
            label_ns("scrutiny:product:name"),     label_val("SLE97",                        "scrutiny:product:name"),
            label_ns("scrutiny:product:version"),  label_val("SLE97CXXX / SLE97DXXX family", "scrutiny:product:version"),
            label_ns("scrutiny:product:category"), label_val("Smart Card IC",                "scrutiny:product:category"),
        ], "P1 — Infineon SLE97 (Smart Card)")

    p2_id = await publish_event(client_vb, signer_vb,
        "NXP SE050C2 — IoT-grade secure element for edge devices. CC EAL6+ (BSI-DSZ-CC-1085).",
        scrutiny_base("scrutiny_product") + [
            identifier("cpe:2.3:h:nxp:se050c2:-:*:*:*:*:*:*:*"),
            identifier("cc:BSI-DSZ-CC-1085"),
            label_ns("scrutiny:product:vendor"),   label_val("NXP Semiconductors",  "scrutiny:product:vendor"),
            label_ns("scrutiny:product:name"),     label_val("SE050C2",              "scrutiny:product:name"),
            label_ns("scrutiny:product:version"),  label_val("C2",                   "scrutiny:product:version"),
            label_ns("scrutiny:product:category"), label_val("Secure Element",       "scrutiny:product:category"),
        ], "P2 — NXP SE050C2 (Secure Element)")

    p3_id = await publish_event(client_re, signer_re,
        "OpenSSL 3.0.7 — Open-source TLS/SSL and general-purpose cryptography library. FIPS 140-3 module candidate.",
        scrutiny_base("scrutiny_product") + [
            identifier("purl:pkg:github/openssl/openssl@3.0.7"),
            identifier("cpe:2.3:a:openssl:openssl:3.0.7:*:*:*:*:*:*:*"),
            label_ns("scrutiny:product:vendor"),   label_val("OpenSSL Project",       "scrutiny:product:vendor"),
            label_ns("scrutiny:product:name"),     label_val("OpenSSL",               "scrutiny:product:name"),
            label_ns("scrutiny:product:version"),  label_val("3.0.7",                 "scrutiny:product:version"),
            label_ns("scrutiny:product:category"), label_val("Cryptographic Library", "scrutiny:product:category"),
        ], "P3 — OpenSSL 3.0.7 (Crypto Library)")

    # -----------------------------------------------------------------------
    # METADATA
    # -----------------------------------------------------------------------
    print("\n── Metadata ──────────────────────────────────────────────────────")

    m1_id = await publish_event(client_re, signer_re,
        "CVE-2022-4304: Timing-based side-channel in OpenSSL RSA decryption. "
        "Attacker can potentially decrypt traffic via many trial messages. Affects 3.0.0-3.0.6. Fixed in 3.0.7.",
        scrutiny_base("scrutiny_metadata") + [
            identifier("cve:CVE-2022-4304"), identifier("cwe:CWE-385"),
            label_ns("scrutiny:metadata:measurement_category"), label_val("vulnerability", "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:severity"),             label_val("HIGH",           "scrutiny:metadata:severity"),
            label_ns("scrutiny:metadata:cvss_score"),           label_val("7.5",            "scrutiny:metadata:cvss_score"),
        ], "M1 — CVE-2022-4304 (RSA Timing Oracle)")

    m2_id = await publish_event(client_re, signer_re,
        "CVE-2022-4450: PEM_read_bio_ex() double-free in OpenSSL. "
        "Second call frees same memory twice, leading to crashes or RCE. Affects 3.0.0-3.0.6.",
        scrutiny_base("scrutiny_metadata") + [
            identifier("cve:CVE-2022-4450"), identifier("cwe:CWE-415"),
            label_ns("scrutiny:metadata:measurement_category"), label_val("vulnerability", "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:severity"),             label_val("HIGH",           "scrutiny:metadata:severity"),
            label_ns("scrutiny:metadata:cvss_score"),           label_val("7.4",            "scrutiny:metadata:cvss_score"),
        ], "M2 — CVE-2022-4450 (PEM Double-Free)")

    m3_id = await publish_event(client_au, signer_au,
        "BSI-DSZ-CC-0973: Common Criteria EAL6+ certification for the Infineon SLE97 smart card IC family. "
        "Issued by BSI. Covers Protection Profiles PP-0084 and PP-0100.",
        scrutiny_base("scrutiny_metadata") + [
            identifier("cc:BSI-DSZ-CC-0973"),
            label_ns("scrutiny:metadata:measurement_category"), label_val("certification",                                        "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:standard"),             label_val("Common Criteria EAL6+",                                "scrutiny:metadata:standard"),
            label_ns("scrutiny:metadata:issuer"),               label_val("Bundesamt fuer Sicherheit in der Informationstechnik", "scrutiny:metadata:issuer"),
        ], "M3 — BSI CC EAL6+ Cert (Infineon SLE97)")

    m4_id = await publish_event(client_au, signer_au,
        "Independent penetration test of NXP SE050C2. "
        "Tests: SCA, fault injection, logical protocol attacks, glitch testing. "
        "No exploitable vulnerabilities found. Firmware 4.2.1. March 2024.",
        scrutiny_base("scrutiny_metadata") + [
            label_ns("scrutiny:metadata:measurement_category"), label_val("test",           "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:tool"),                 label_val("Custom SCA Rig", "scrutiny:metadata:tool"),
            label_ns("scrutiny:metadata:tool"),                 label_val("ChipWhisperer",  "scrutiny:metadata:tool"),
            label_ns("scrutiny:metadata:result"),               label_val("pass",            "scrutiny:metadata:result"),
            label_ns("scrutiny:metadata:firmware_version"),     label_val("4.2.1",           "scrutiny:metadata:firmware_version"),
        ], "M4 — Pentest Report (NXP SE050C2)")

    m5_id = await publish_event(client_au, signer_au,
        "Security audit of OpenSSL 3.0.x covering QUIC transport, FIPS provider, and providers architecture. "
        "3 medium-severity and 12 informational findings. Conducted by Trail of Bits.",
        scrutiny_base("scrutiny_metadata") + [
            label_ns("scrutiny:metadata:measurement_category"), label_val("audit",                                "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:auditor"),              label_val("Trail of Bits",                        "scrutiny:metadata:auditor"),
            label_ns("scrutiny:metadata:result"),               label_val("3 medium, 12 informational findings",  "scrutiny:metadata:result"),
        ], "M5 — Security Audit (OpenSSL 3.0.x)")

    m6_id = await publish_event(client_re, signer_re,
        "Analysis of RSA key generation on Infineon SLE97 family. "
        "Updated keygen confirmed not susceptible to ROCA (CVE-2017-15361). "
        "Prime distribution tested across 50,000 key pairs — no bias detected.",
        scrutiny_base("scrutiny_metadata") + [
            label_ns("scrutiny:metadata:measurement_category"), label_val("analysis",                         "scrutiny:metadata:measurement_category"),
            label_ns("scrutiny:metadata:tool"),                 label_val("Sage Math",                        "scrutiny:metadata:tool"),
            label_ns("scrutiny:metadata:tool"),                 label_val("Custom prime-distribution tester", "scrutiny:metadata:tool"),
            label_ns("scrutiny:metadata:result"),               label_val("pass",                             "scrutiny:metadata:result"),
            label_ns("scrutiny:metadata:sample_count"),         label_val("50000",                            "scrutiny:metadata:sample_count"),
        ], "M6 — RSA Keygen Analysis (SLE97, post-ROCA)")

    # -----------------------------------------------------------------------
    # BINDINGS
    # -----------------------------------------------------------------------
    print("\n── Bindings ──────────────────────────────────────────────────────")

    b1_id = await publish_event(client_re, signer_re,
        "CVE-2022-4304 (RSA timing oracle) is a known vulnerability in OpenSSL 3.0.7.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p3_id, relay, re_pk), q_ref(m1_id, relay, re_pk),
            label_ns("scrutiny:binding:relationship"), label_val("vulnerability", "scrutiny:binding:relationship"),
        ], "B1 — CVE-2022-4304 vulnerability → OpenSSL 3.0.7")

    b2_id = await publish_event(client_re, signer_re,
        "CVE-2022-4450 (PEM double-free) affects OpenSSL 3.0.x.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p3_id, relay, re_pk), q_ref(m2_id, relay, re_pk),
            label_ns("scrutiny:binding:relationship"), label_val("vulnerability", "scrutiny:binding:relationship"),
        ], "B2 — CVE-2022-4450 vulnerability → OpenSSL 3.0.7")

    b3_id = await publish_event(client_au, signer_au,
        "BSI CC EAL6+ certificate BSI-DSZ-CC-0973 certifies the Infineon SLE97.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p1_id, relay, va_pk), q_ref(m3_id, relay, au_pk),
            label_ns("scrutiny:binding:relationship"), label_val("certification", "scrutiny:binding:relationship"),
        ], "B3 — BSI cert certification → Infineon SLE97")

    b4_id = await publish_event(client_au, signer_au,
        "Independent pentest covers the NXP SE050C2 at firmware 4.2.1.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p2_id, relay, vb_pk), q_ref(m4_id, relay, au_pk),
            label_ns("scrutiny:binding:relationship"), label_val("test", "scrutiny:binding:relationship"),
        ], "B4 — Pentest test → NXP SE050C2")

    b5_id = await publish_event(client_au, signer_au,
        "Trail of Bits audit covers OpenSSL 3.0.x QUIC and FIPS provider.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p3_id, relay, re_pk), q_ref(m5_id, relay, au_pk),
            label_ns("scrutiny:binding:relationship"), label_val("audit", "scrutiny:binding:relationship"),
        ], "B5 — Trail of Bits audit → OpenSSL 3.0.7")

    b6_id = await publish_event(client_re, signer_re,
        "Post-ROCA RSA analysis confirms SLE97 updated keygen is not susceptible.",
        scrutiny_base("scrutiny_binding") + [
            e_root(p1_id, relay, va_pk), q_ref(m6_id, relay, re_pk),
            label_ns("scrutiny:binding:relationship"), label_val("analysis", "scrutiny:binding:relationship"),
        ], "B6 — RSA analysis → Infineon SLE97")

    # -----------------------------------------------------------------------
    # UPDATE (adds FIPS CMVP ID to P3)
    # -----------------------------------------------------------------------
    print("\n── Update ────────────────────────────────────────────────────────")

    u1_id = await publish_event(client_re, signer_re, "",
        scrutiny_base("scrutiny_update") + [
            e_root(p3_id, relay, re_pk),
            identifier("purl:pkg:github/openssl/openssl@3.0.7"),
            identifier("cpe:2.3:a:openssl:openssl:3.0.7:*:*:*:*:*:*:*"),
            identifier("atr:CMVP#4282"),
            label_ns("scrutiny:product:fips_status"), label_val("Under Review — CMVP #4282", "scrutiny:product:fips_status"),
        ], "U1 — Update P3: add FIPS CMVP#4282 identifier")

    # -----------------------------------------------------------------------
    # RETRACTION (retracts B2)
    # -----------------------------------------------------------------------
    print("\n── Retraction ────────────────────────────────────────────────────")

    r1_id = await publish_event(client_re, signer_re,
        "Retracting B2: CVE-2022-4450 was mistakenly bound to OpenSSL 3.0.7; "
        "it only affects 3.0.0-3.0.6 which do NOT contain the fix.",
        scrutiny_base("scrutiny_retract") + [
            e_root(b2_id, relay, re_pk),
        ], "R1 — Retract B2 (wrong product version)")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n" + "─" * 60)
    print("✅ All 16 events published!\n")
    print("Trusted pubkeys to add in Lens Settings → Trust:")
    print(f"  VENDOR_A   {va_pk}")
    print(f"  VENDOR_B   {vb_pk}")
    print(f"  RESEARCHER {re_pk}")
    print(f"  AUDITOR    {au_pk}")
    print()
    print("Product IDs to search in Lens:")
    print(f"  P1 (Infineon SLE97):  {p1_id}")
    print(f"  P2 (NXP SE050C2):     {p2_id}")
    print(f"  P3 (OpenSSL 3.0.7):   {p3_id}")
    print()

    summary = {
        "relay": relay,
        "pubkeys": {"VENDOR_A": va_pk, "VENDOR_B": vb_pk, "RESEARCHER": re_pk, "AUDITOR": au_pk},
        "products": {"P1_SLE97": p1_id, "P2_SE050C2": p2_id, "P3_OpenSSL": p3_id},
        "metadata": {"M1_CVE_4304": m1_id, "M2_CVE_4450": m2_id, "M3_BSI_cert": m3_id,
                     "M4_pentest": m4_id, "M5_audit": m5_id, "M6_roca_analysis": m6_id},
        "bindings": {"B1": b1_id, "B2": b2_id, "B3": b3_id, "B4": b4_id, "B5": b5_id, "B6": b6_id},
        "updates": {"U1": u1_id},
        "retractions": {"R1": r1_id},
    }
    out_path = "misc/mock_event_ids.json"
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"📄 ID map saved to: {out_path}")

    await client_va.disconnect()
    await client_vb.disconnect()
    await client_re.disconnect()
    await client_au.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish SCRUTINY Fabric mock events.")
    parser.add_argument("--relay", default=RELAY, help="Relay URL to publish to")
    args = parser.parse_args()
    asyncio.run(main(args.relay))
