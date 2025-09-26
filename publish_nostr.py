import io
import asyncio
import base64
import hashlib
import json
import os
import re
import sys
import secrets
import getpass
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# Optional for accurate image dimensions
try:
    from PIL import Image  # type: ignore
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False

# Nostr SDK (required)
try:
    from nostr_sdk import (
        Client,
        Keys,
        NostrSigner,
        EventBuilder,
        Kind,
        EventId,
        Tag,
        Filter,
        PublicKey,
    )
except ImportError:
    print("Error: nostr-sdk not installed. Please run: pip install nostr-sdk", file=sys.stderr)
    sys.exit(1)


# --------------------------
# SCRUTINY constants/config
# --------------------------

# Base tags
SCRUTINY_NS_BASE = "scrutiny_mo"
SCRUTINY_VERSION = "scrutiny_v01"
TAG_PRODUCT_BASE = "scrutiny_product"
TAG_METADATA_BASE = "scrutiny_metadata"
TAG_BINDING_BASE = "scrutiny_binding"
TAG_UPDATE_BASE = "scrutiny_update"
TAG_CONTEST_BASE = "scrutiny_contestation"
TAG_CONFIRM_BASE = "scrutiny_confirmation"

# Test tag profile toggle (append _v01 to namespace/type tags, version stays 'scrutiny_v01')
TAG_PROFILE_TEST = False

# Recommended PoW baseline (NIP-13)
DEFAULT_POW = int(os.getenv("SCRUTINY_POW", "10"))

# Dry-run toggle
DRY_RUN = False

# Publish mode: "broadcast" or "first_success"
PUBLISH_MODE = "broadcast"


# --------------------------
# Minimal I/O helpers
# --------------------------

class Abort(Exception):
    pass


def echo(msg: str, err: bool = False) -> None:
    print(msg, file=sys.stderr if err else sys.stdout)


def prompt(label: str, default: Optional[str] = None, type: Any = str, show_default: bool = True) -> Any:
    suffix = f" [{default}]" if show_default and default is not None else ""
    while True:
        val = input(f"{label}{suffix}: ").strip()
        if not val and default is not None:
            val = str(default)
        if type is int:
            try:
                return int(val)
            except Exception:
                echo("Please enter a valid integer.", err=True)
                continue
        return val


def confirm(label: str, default: bool = False) -> bool:
    suffix = " [Y/n]" if default else " [y/N]"
    ans = input(f"{label}{suffix}: ").strip().lower()
    if not ans:
        return default
    return ans in ("y", "yes")


# --------------------------
# Tag profile + hashtags
# --------------------------

def prof(s: str) -> str:
    if s == SCRUTINY_VERSION:
        return s
    return f"{s}_v01" if TAG_PROFILE_TEST else s


def content_hashtags(*kinds: str) -> str:
    tags = [prof(SCRUTINY_NS_BASE)]
    tags.extend(prof(k) for k in kinds)
    tags.append(SCRUTINY_VERSION)
    return " ".join(f"#{t}" for t in tags)


def add_scrutiny_t_tags(tags: List[Any], *kinds: str) -> List[Any]:
    # rust-nostr Python 'Tag.hashtag' examples often pass '#'-prefixed values
    tags.append(Tag.hashtag(f"#{prof(SCRUTINY_NS_BASE)}"))
    for k in kinds:
        tags.append(Tag.hashtag(f"#{prof(k)}"))
    tags.append(Tag.hashtag(f"#{SCRUTINY_VERSION}"))
    return tags


# --------------------------
# Validation helpers
# --------------------------

def validate_https_url(u: str) -> None:
    try:
        p = urlparse(u)
        if p.scheme.lower() != "https":
            raise ValueError("URL must use https://")
        if not p.netloc:
            raise ValueError("URL must include host")
    except Exception as e:
        raise ValueError(f"Invalid URL '{u}': {e}")


def validate_wss_url(u: str) -> None:
    try:
        p = urlparse(u)
        if p.scheme.lower() != "wss":
            raise ValueError("Relay must use wss://")
        if not p.netloc:
            raise ValueError("Relay URL must include host")
    except Exception as e:
        raise ValueError(f"Invalid relay URL '{u}': {e}")


def validate_sha256_hex(h: str) -> None:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", h or ""):
        raise ValueError("Must be 64 hex chars (sha256)")


def validate_semver(v: str) -> None:
    if not v:
        return
    semver_re = re.compile(
        r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
        r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
        r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
    )
    if not semver_re.fullmatch(v):
        raise ValueError("Invalid semver format (e.g., 1.2.3, 1.2.3-beta+meta)")


def validate_date_yyyy_mm_dd(d: str) -> None:
    if not d:
        return
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
        raise ValueError("Date must be YYYY-MM-DD")


def validate_d_tag(d: str) -> Optional[str]:
    if not d:
        return (
            "Empty d-tag, recommended to use reverse-DNS like "
            "'org.vendor:product-<version>'"
        )
    if "cpe:" in d.lower() or "pkg:" in d.lower():
        return "Do not put CPE/PURL in d-tag, use labels for cpe23/purl"
    if ":" not in d or d.count(":") != 1:
        return "d-tag should be reverse-DNS-like: 'org.vendor:product-<version>'"
    prefix, suffix = d.split(":")
    if not re.fullmatch(r"[a-z0-9]+(\.[a-z0-9-]+)+", prefix):
        return (
            "d-tag prefix should look like reverse DNS "
            "(e.g., org.example.vendor)"
        )
    if not suffix:
        return "d-tag must include product identifier after ':'"
    return None


def normalize_cpe23(cpe: str) -> str:
    if not cpe:
        raise ValueError("Empty CPE string")
    parts = cpe.split(":")
    if parts[0] != "cpe":
        raise ValueError("CPE must start with 'cpe:'")
    if len(parts) < 3:
        raise ValueError("CPE must include version and part fields (e.g., cpe:2.3:a:...)")
    if len(parts) < 13:
        parts = parts + ["*"] * (13 - len(parts))
    if len(parts) != 13:
        raise ValueError("CPE must have 13 colon-separated fields")
    return ":".join(parts)


def validate_cpe23(cpe: str) -> None:
    if not cpe:
        raise ValueError("Empty CPE string")
    parts = cpe.split(":")
    if len(parts) != 13 or parts[0] != "cpe":
        raise ValueError("CPE must have 13 colon-separated fields starting with 'cpe:'")
    _, cpe_version, part = parts[0], parts[1], parts[2]
    if not cpe_version:
        raise ValueError("CPE version missing (e.g., 2.3)")
    if part not in ("a", "o", "h"):
        raise ValueError("CPE part must be one of: a (app), o (OS), h (hardware)")
    
def validate_purl(p: str) -> None:
    """
    Minimal Package URL validation.
    Spec: https://github.com/package-url/purl-spec
    Accepts forms like:
      pkg:<type>/<name>@<version>
      pkg:<type>/<namespace>/<name>@<version>?qualifiers#subpath
    We enforce:
      - starts with "pkg:"
      - has a type and a name
    """
    if not p or not isinstance(p, str):
        raise ValueError("Empty purl")
    if not p.startswith("pkg:"):
        raise ValueError("purl must start with 'pkg:'")

    # Basic structure check after 'pkg:'
    rest = p[4:]
    if "/" not in rest:
        raise ValueError("purl must include a type and a name")
    # Split off qualifiers/subpath
    rest_main = rest.split("?", 1)[0].split("#", 1)[0]
    # Ensure there's at least type and name
    parts = rest_main.split("/")
    if len(parts) < 2:
        raise ValueError("purl must include a type and a name")
    ptype = parts[0].strip()
    name = parts[-1].strip()  # name is last segment (after namespace)
    if not ptype or not name:
        raise ValueError("purl missing type or name")


# --------------------------
# Input prompt helpers with validation
# --------------------------

def prompt_private_key() -> str:
    """Prompt for nsec private key; validate by parsing (hidden input)."""
    while True:
        try:
            nsec = getpass.getpass(
                "Enter your Nostr private key (nsec format): "
            ).strip()
        except Exception:
            # Fallback to visible prompt if getpass isn't available
            nsec = prompt(
                "Enter your Nostr private key (nsec format)", show_default=False
            ).strip()

        if not nsec.lower().startswith("nsec"):
            echo("Private key must be in nsec format.", err=True)
            continue
        try:
            _ = Keys.parse(nsec)  # validation only
            return nsec
        except Exception as e:
            echo(f"Invalid private key: {e}", err=True)


def prompt_relays() -> List[str]:
    """Prompt for comma-separated relay URLs; ensure all are wss://host."""
    while True:
        raw = prompt("Enter relay URLs (comma-separated)", default="wss://relay.damus.io")
        urls = [u.strip() for u in raw.split(",") if u.strip()]
        if not urls:
            echo("Please enter at least one relay.", err=True)
            continue
        all_ok = True
        for u in urls:
            try:
                validate_wss_url(u)
            except Exception as e:
                echo(str(e), err=True)
                all_ok = False
        if all_ok:
            return urls


def prompt_https_optional(label: str) -> str:
    """Prompt for optional https URL; empty allowed; validate if present."""
    while True:
        val = prompt(label, default="", show_default=False)
        if not val.strip():
            return ""
        try:
            validate_https_url(val.strip())
            return val.strip()
        except Exception as e:
            echo(str(e), err=True)


def prompt_d_tag_optional() -> str:
    """Prompt optional d-tag; if present, must pass validate_d_tag without warnings."""
    while True:
        d = prompt(
            "d-tag stable identifier (reverse-DNS, e.g., org.vendor:product-<version>) (optional, Enter to skip)",
            default="", show_default=False
        )
        if not d.strip():
            return ""
        warn = validate_d_tag(d.strip())
        if warn:
            echo(f"d-tag invalid: {warn}", err=True)
            continue
        return d.strip()


def prompt_semver_or_text(label: str) -> Tuple[str, Optional[str]]:
    """Prompt for version; if not semver ask user whether to re-enter or store as text."""
    while True:
        v = prompt(label, default="", show_default=False)
        if not v.strip():
            return "", None
        try:
            validate_semver(v.strip())
            return v.strip(), "semver"
        except Exception:
            echo("Not a valid semver (e.g., 1.2.3).", err=True)
            if confirm("Keep it as plain text?", default=True):
                return v.strip(), "text"
            # else loop to re-enter


def prompt_cpe23_optional() -> str:
    """Prompt optional CPE 2.3; normalize and validate; loop until valid or empty."""
    while True:
        cpe = prompt("cpe23 (id)", default="", show_default=False)
        if not cpe.strip():
            return ""
        try:
            cpe_norm = normalize_cpe23(cpe.strip())
            validate_cpe23(cpe_norm)
            return cpe_norm
        except Exception as e:
            echo(f"Invalid cpe23: {e}", err=True)

def prompt_purl_optional() -> str:
    """Prompt optional purl; validate if present; loop until valid or empty."""
    while True:
        val = prompt("purl (id)", default="", show_default=False)
        if not val.strip():
            return ""
        try:
            validate_purl(val.strip())
            return val.strip()
        except Exception as e:
            echo(f"Invalid purl: {e}", err=True)

def prompt_sha256_optional(label: str) -> str:
    while True:
        h = prompt(label, default="", show_default=False)
        if not h.strip():
            return ""
        try:
            validate_sha256_hex(h.strip())
            return h.strip()
        except Exception as e:
            echo(str(e), err=True)


def prompt_date_optional() -> str:
    while True:
        d = prompt("release_date (YYYY-MM-DD)", default="", show_default=False)
        if not d.strip():
            return ""
        try:
            validate_date_yyyy_mm_dd(d.strip())
            return d.strip()
        except Exception as e:
            echo(str(e), err=True)


# --------------------------
# Minimal HTTP (urllib + retry/backoff)
# --------------------------

class SimpleResponse:
    def __init__(self, status_code: int, headers: Dict[str, str], content: bytes):
        self.status_code = status_code
        self.headers = headers
        self.content = content

    def json(self) -> Any:
        return json.loads(self.content.decode("utf-8"))


def _convert_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    return {k: v for k, v in (headers or {}).items()}


async def http_request(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[bytes] = None,
    files: Optional[Dict[str, Tuple[str, bytes]]] = None,
    max_retries: int = 3,
) -> SimpleResponse:
    """
    Minimal HTTP client using urllib with sane default headers.
    """
    assert method.upper() in ("GET", "POST")
    attempt = 0
    last_exc: Optional[Exception] = None

    def _add_default_headers(h: Dict[str, str]) -> Dict[str, str]:
        # Make header lookup case-insensitive
        lower = {k.lower(): k for k in h.keys()}
        if "user-agent" not in lower:
            h["User-Agent"] = "scrutiny-cli/0.1 (+https://github.com/)"
        if "accept" not in lower:
            h["Accept"] = "*/*"
        # Some hosts refuse GETs without a Referer
        if method.upper() == "GET" and "referer" not in lower:
            h["Referer"] = url
        return h

    while attempt < max_retries:
        try:
            req_headers = _convert_headers(headers)
            req_headers = _add_default_headers(req_headers)

            body: Optional[bytes] = None
            if method.upper() == "GET":
                body = None
            else:
                if files:
                    # Multipart form-data for single/multiple files
                    boundary = "----ScrutinyBoundary" + secrets.token_hex(12)
                    req_headers[
                        "Content-Type"
                    ] = f"multipart/form-data; boundary={boundary}"
                    parts: List[bytes] = []
                    for field_name, (filename, file_bytes) in files.items():
                        parts.append(f"--{boundary}\r\n".encode())
                        disposition = (
                            'Content-Disposition: form-data; name="'
                            f'{field_name}"; filename="{filename}"\r\n'
                        )
                        parts.append(disposition.encode())
                        parts.append(
                            b"Content-Type: application/octet-stream\r\n\r\n"
                        )
                        parts.append(file_bytes)
                        parts.append(b"\r\n")
                    parts.append(f"--{boundary}--\r\n".encode())
                    body = b"".join(parts)
                else:
                    if data is None:
                        body = b""
                        if "Content-Type" not in req_headers:
                            req_headers["Content-Type"] = (
                                "application/octet-stream"
                            )
                    else:
                        body = data
                        if "Content-Type" not in req_headers:
                            req_headers["Content-Type"] = (
                                "application/octet-stream"
                            )

            req = Request(url=url, data=body, headers=req_headers,
                          method=method.upper())

            def _do() -> SimpleResponse:
                with urlopen(req, timeout=60) as resp:
                    content = resp.read()
                    hdrs = {k.lower(): v for k, v in resp.headers.items()}
                    return SimpleResponse(resp.getcode(), hdrs, content)

            resp = await asyncio.to_thread(_do)

            # retry on server errors / 429
            if resp.status_code >= 500 or resp.status_code == 429:
                raise RuntimeError(f"HTTP {resp.status_code}")
            return resp
        except (HTTPError, URLError, RuntimeError, Exception) as e:
            last_exc = e
            # For 4xx other than 429, retrying rarely helps; but keep
            # a short backoff for idempotent GETs
            await asyncio.sleep((2 ** attempt) * 0.5)
            attempt += 1

    raise last_exc if last_exc else RuntimeError("HTTP request failed")


async def fetch_bytes_and_headers(url: str) -> Tuple[bytes, Dict[str, str]]:
    validate_https_url(url)
    echo(f"Fetching content from: {url}")
    resp = await http_request("GET", url)
    content = resp.content
    headers = resp.headers
    echo(f"Fetched {len(content)} bytes")
    return content, headers


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def url_basename(url: str) -> str:
    try:
        u = urlparse(url)
        if u.path and u.path != "/":
            name = os.path.basename(u.path.rstrip("/"))
            return name or u.netloc
        return u.netloc or url
    except Exception:
        return url


def guess_mime(headers: Dict[str, str], url: str) -> Optional[str]:
    ct = headers.get("content-type")
    if ct:
        return ct.split(";")[0].strip()
    import mimetypes
    m, _ = mimetypes.guess_type(url)
    return m


def guess_image_dim(data: bytes, mime: Optional[str]) -> Optional[str]:
    """Use Pillow if available; fall back to header parse for PNG/JPEG/GIF."""
    if PIL_AVAILABLE:
        try:
            with Image.open(io.BytesIO(data)) as im:  # type: ignore
                w, h = im.size
                if w > 0 and h > 0:
                    return f"{w}x{h}"
        except Exception:
            pass
    return None


# --------------------------
# NIP-98 HTTP Auth
# --------------------------

# """
# async def build_nip98_auth_header(
#     full_url: str,
#     method: str,
#     body: Optional[bytes],
#     keys: Keys,
# ) -> Optional[Dict[str, str]]:
#     try:
#         signer = NostrSigner.keys(keys)
#         tags: List[Any] = []
#         tags.append(Tag.parse(["u", full_url]))
#         tags.append(Tag.parse(["method", method.upper()]))
#         if body:
#             digest = sha256_hex(body)
#             tags.append(Tag.parse(["payload", digest]))
#         ev = await EventBuilder(Kind(27235), "").tags(tags).sign(signer)
#         raw = ev.as_json().encode("utf-8")
#         hdr = {"Authorization": f"Nostr {base64.b64encode(raw).decode('ascii')}"}
#         return hdr
#     except Exception:
#         return None
# """


async def blossom_upload(
    blossom_base: str,
    data: bytes,
    filename: Optional[str],
    use_nip98: bool,
    keys: Optional[Keys],
) -> Optional[str]:
    try:
        validate_https_url(blossom_base)
        base = blossom_base.rstrip("/")
        url = f"{base}/upload"
        files = {"file": (filename or "blob", data)}

        try:
            resp = await http_request("POST", url, files=files)
            js = resp.json()
            ret = js.get("url") or js.get("href") or js.get("location")
            if ret:
                validate_https_url(ret)
                echo(f"✓ Blossom uploaded: {ret}")
                return ret
        except Exception as e:
            echo(f"Blossom upload (no-auth) failed: {e}")

        # NIP-98 disabled:
        # if use_nip98 and keys:
        #     try:
        #         hdrs = await build_nip98_auth_header(url, "POST", data, keys)
        #         if not hdrs:
        #             raise RuntimeError("Could not build NIP-98 header")
        #         resp2 = await http_request("POST", url, headers=hdrs, files=files)
        #         js2 = resp2.json()
        #         ret2 = js2.get("url") or js2.get("href") or js2.get("location")
        #         if ret2:
        #             validate_https_url(ret2)
        #             echo(f"✓ Blossom uploaded (NIP-98): {ret2}")
        #             return ret2
        #         echo("Blossom (NIP-98) returned no URL field, ignoring")
        #     except Exception as e2:
        #         echo(f"Blossom upload (NIP-98) failed: {e2}")
    except Exception as e:
        echo(f"Blossom upload failed: {e}")
    return None


def convert_ws_to_http(url: str) -> Optional[str]:
    try:
        p = urlparse(url)
        if p.scheme == "wss":
            return f"https://{p.netloc}{p.path or ''}"
        if p.scheme == "ws":
            return f"http://{p.netloc}{p.path or ''}"
        if p.scheme in ("https", "http"):
            return url
        return None
    except Exception:
        return None


async def fetch_relay_min_pow(relay_urls: List[str]) -> Tuple[int, List[Dict[str, Any]]]:
    max_pow = 0
    diag: List[Dict[str, Any]] = []
    headers = {"Accept": "application/nostr+json"}
    keys_to_check = [
        "min_pow_difficulty",
        "minPoW",
        "minPoWDifficulty",
        "pow",
        "pow_difficulty",
        "required_pow",
        "min_difficulty",
        "difficulty",
    ]
    for rurl in relay_urls:
        entry = {"url": rurl, "reachable": False, "min_pow": None, "forced": False}
        try:
            http = convert_ws_to_http(rurl)
            if not http:
                diag.append(entry)
                continue
            resp = await http_request("GET", http, headers=headers)
            if resp.status_code != 200:
                diag.append(entry)
                continue
            info = resp.json() if resp.content else {}
            lim = info.get("limitation") or info.get("limits") or {}
            best = None
            for k in keys_to_check:
                v = lim.get(k)
                if isinstance(v, int):
                    best = v if best is None else max(best, v)
            entry["reachable"] = True
            entry["min_pow"] = best
            if isinstance(best, int) and best > max_pow:
                max_pow = best
        except Exception:
            pass
        diag.append(entry)
    for e in diag:
        e["forced"] = (e.get("min_pow") == max_pow and isinstance(e.get("min_pow"), int))
    return max_pow, diag


# --------------------------
# Bech32 + NIP-19 helpers (manual naddr/nprofile decode)
# --------------------------

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_BECH32_CHARSET_MAP = {c: i for i, c in enumerate(_BECH32_CHARSET)}


def _bech32_polymod(values: List[int]) -> int:
    GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        b = (chk >> 25) & 0xFF
        chk = ((chk & 0x1FFFFFF) << 5) ^ v
        for i in range(5):
            chk ^= GEN[i] if ((b >> i) & 1) else 0
    return chk


def _bech32_hrp_expand(hrp: str) -> List[int]:
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def _bech32_verify_checksum(hrp: str, data: List[int]) -> bool:
    return _bech32_polymod(_bech32_hrp_expand(hrp) + data) == 1


def _bech32_decode_to_words(bech: str) -> Tuple[Optional[str], Optional[List[int]]]:
    if (bech.lower() != bech and bech.upper() != bech) or any(
        ord(x) < 33 or ord(x) > 126 for x in bech
    ):
        return None, None
    bech = bech.lower()
    pos = bech.rfind("1")
    if pos < 1 or pos + 7 > len(bech):
        return None, None
    hrp = bech[:pos]
    data_part = bech[pos + 1 :]
    try:
        data = [_BECH32_CHARSET_MAP[c] for c in data_part]
    except KeyError:
        return None, None
    if not _bech32_verify_checksum(hrp, data):
        return None, None
    return hrp, data[:-6]


def _convertbits(data: List[int], frombits: int, tobits: int, pad: bool) -> Optional[bytes]:
    acc = 0
    bits = 0
    ret = bytearray()
    maxv = (1 << tobits) - 1
    max_acc = (1 << (frombits + tobits - 1)) - 1
    for value in data:
        if value < 0 or (value >> frombits):
            return None
        acc = ((acc << frombits) | value) & max_acc
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return bytes(ret)


def _nip19_payload(bech32_str: str) -> Tuple[str, bytes]:
    hrp, words = _bech32_decode_to_words(bech32_str)
    if hrp is None or words is None:
        raise ValueError("Invalid bech32 string")
    b = _convertbits(words, 5, 8, False)
    if b is None:
        raise ValueError("Invalid bech32 payload conversion")
    return hrp, b


def _parse_tlvs(payload: bytes) -> Dict[int, List[bytes]]:
    i = 0
    tlvs: Dict[int, List[bytes]] = {}
    while i + 2 <= len(payload):
        t = payload[i]
        l = payload[i + 1]
        i += 2
        if i + l > len(payload):
            break
        v = payload[i : i + l]
        i += l
        tlvs.setdefault(t, []).append(v)
    return tlvs


def _strip_wrappers(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return s
    if s.lower().startswith("nostr:"):
        s = s[6:]
    try:
        u = urlparse(s)
        if u.scheme in ("http", "https") and u.path:
            last = os.path.basename(u.path.rstrip("/"))
            if re.fullmatch(r"(n(sec|pub|profile|event|addr)|note)1[0-9a-z]+", last):
                return last
    except Exception:
        pass
    return s


def _find_candidate_token(s: str) -> str:
    s = s.strip()
    m = re.search(r"(n(?:sec|pub|profile|event|addr)|note)1[0-9a-z]+", s, re.I)
    if m:
        return m.group(0)
    m2 = re.search(r"[0-9a-fA-F]{64}", s)
    if m2:
        return m2.group(0).lower()
    return s


def decode_nprofile(nprofile: str) -> Tuple[str, List[str]]:
    s = _strip_wrappers(nprofile)
    s = _find_candidate_token(s)
    if not s.lower().startswith("nprofile1"):
        raise ValueError("Not an nprofile")
    hrp, payload = _nip19_payload(s.lower())
    if hrp != "nprofile":
        raise ValueError("Invalid nprofile bech32")
    tlvs = _parse_tlvs(payload)
    pk_items = tlvs.get(0) or []
    if not pk_items or len(pk_items[0]) != 32:
        raise ValueError("nprofile missing pubkey (TLV 0 len 32)")
    pk_hex = pk_items[0].hex()
    relays: List[str] = []
    for r in tlvs.get(1) or []:
        try:
            relays.append(r.decode("utf-8"))
        except Exception:
            continue
    return pk_hex, relays


def parse_pubkey_to_hex(s: str) -> str:
    tok = _find_candidate_token(_strip_wrappers(s))
    if tok.lower().startswith("nprofile1"):
        pk_hex, _rels = decode_nprofile(tok)
        return pk_hex
    try:
        # Handles npub1... and raw hex
        pk = PublicKey.parse(tok)
        return pk.to_hex()
    except Exception:
        pass
    raise ValueError("Unsupported pubkey format; expected npub/nprofile/hex")


def decode_naddr(naddr: str) -> Tuple[int, str, str, List[str]]:
    """Return (kind, author_pubkey_hex, identifier, relays[]) by parsing TLVs."""
    s = _strip_wrappers(naddr)
    s = _find_candidate_token(s)
    if not s.lower().startswith("naddr1"):
        raise ValueError("Not an naddr")

    hrp, payload = _nip19_payload(s.lower())
    if hrp != "naddr":
        raise ValueError("Invalid naddr bech32")
    tlvs = _parse_tlvs(payload)

    ids = tlvs.get(0) or []
    if not ids:
        raise ValueError("naddr missing identifier (TLV 0)")
    try:
        ident = ids[0].decode("utf-8")
    except Exception:
        raise ValueError("naddr identifier (TLV 0) is not valid UTF-8")

    authors = tlvs.get(2) or []
    if not authors or len(authors[0]) != 32:
        raise ValueError("naddr missing author pubkey (TLV 2 len 32)")
    pk_hex = authors[0].hex()

    kinds = tlvs.get(3) or []
    if not kinds or len(kinds[0]) != 4:
        raise ValueError("naddr missing kind (TLV 3 len 4)")
    kind = int.from_bytes(kinds[0], "big", signed=False)

    rels_raw = tlvs.get(1) or []
    rels: List[str] = []
    for r in rels_raw:
        try:
            rels.append(r.decode("utf-8"))
        except Exception:
            continue

    return kind, pk_hex, ident, rels


def parse_nostr_id_local_only(input_str: str) -> str:
    """
    Resolve event id to hex strictly locally (no network):
    Accept raw 64-hex, note1..., nevent1..., or nostr: URIs when supported by SDK.
    """
    tok = _find_candidate_token(_strip_wrappers(input_str))
    try:
        # rust-nostr python: EventId.parse accepts hex/bech32/nostr: URIs
        return EventId.parse(tok).to_hex()
    except Exception:
        raise ValueError("Unsupported event id format (need hex/note/nevent/URI)")


async def resolve_naddr_to_event_id(naddr: str, relay_urls: List[str]) -> str:
    """
    Resolve an naddr (parameterized replaceable) to a concrete event id via relays.
    Attempts a '#d' tag lookup with provided or embedded relays.
    """
    kind, pk_hex, ident, embedded_relays = decode_naddr(naddr)
    relays = embedded_relays or relay_urls
    client = Client()
    try:
        for r in relays:
            try:
                await client.add_relay(r)
            except Exception:
                pass
        await client.connect()
        # Build filter: kinds + authors + identifier (#d)
        f = Filter().author(PublicKey.parse(pk_hex)).kind(Kind(kind)).identifier(ident).limit(1)
        events = await client.fetch_events(f, timedelta(seconds=8))
        # Normalize 'Events' to a python list regardless of SDK version
        events_list: List[Any] = []
        if hasattr(events, "as_vec"):
            try:
                events_list = list(events.as_vec())  # type: ignore
            except Exception:
                events_list = []
        else:
            try:
                events_list = list(events)  # type: ignore
            except Exception:
                events_list = []
        if not events_list:
            raise RuntimeError("No event found for naddr on provided relays")
        return events_list[0].id().to_hex()
    finally:
        try:
            if hasattr(client, "disconnect"):
                await client.disconnect()
        except Exception:
            pass


# --------------------------
# Publish + links
# --------------------------

def to_note_str_from_hex(eid_hex: str) -> Optional[str]:
    try:
        return EventId.parse(eid_hex).to_bech32()
    except Exception:
        return None


def npub_from_keys(keys: Keys) -> Optional[str]:
    try:
        return keys.public_key().to_bech32()
    except Exception:
        return None


def display_event_links_after_publish(keys: Keys, main_event_id: str) -> None:
    try:
        note_b32 = to_note_str_from_hex(main_event_id)
        npub = npub_from_keys(keys)
        echo("\n📋 Links")
        if note_b32:
            echo(f"Event (note):   https://njump.me/{note_b32}")
        if npub:
            echo(f"Author:         https://njump.me/{npub}")
    except Exception:
        pass


async def publish_event_with_client(
    keys: Keys,
    relay_urls: List[str],
    builder: EventBuilder,
) -> str:
    """
    Prefer send_event_builder per rust-nostr Python examples.
    """
    if DRY_RUN:
        # Build once just to show the deterministic id we'd produce
        signer = NostrSigner.keys(keys)
        evt = await builder.sign(signer)
        main_event_id = evt.id().to_hex()
        echo(f"[dry-run] Skipping publish. Event ID would be: {main_event_id}")
        return main_event_id

    async def _send_with(cli: Client) -> str:
        out = await cli.send_event_builder(builder)
        try:
            # Out may be a struct with .id or directly an EventId
            eid = getattr(out, "id", None)
            if eid is None:
                signer = NostrSigner.keys(keys)
                evt = await builder.sign(signer)
                return evt.id().to_hex()
            if hasattr(eid, "to_hex"):
                return eid.to_hex()
            if hasattr(eid, "to_bech32"):
                return EventId.parse(eid.to_bech32()).to_hex()
            return str(eid)
        except Exception:
            signer = NostrSigner.keys(keys)
            evt = await builder.sign(signer)
            return evt.id().to_hex()

    if PUBLISH_MODE == "first_success":
        last_err: Optional[Exception] = None
        for r in relay_urls:
            client = Client(NostrSigner.keys(keys))
            try:
                await client.add_relay(r)
                await client.connect()
                eid_hex = await _send_with(client)
                echo(f"✓ Published to {r}. Event ID: {eid_hex}")
                return eid_hex
            except Exception as e:
                last_err = e
                echo(f"Relay failed: {r} ({e})")
            finally:
                try:
                    if hasattr(client, "disconnect"):
                        await client.disconnect()
                except Exception:
                    pass
        raise last_err if last_err else RuntimeError("Publishing failed on all relays")
    else:
        client = Client(NostrSigner.keys(keys))
        try:
            for r in relay_urls:
                try:
                    await client.add_relay(r)
                except Exception:
                    pass
            await client.connect()
            eid_hex = await _send_with(client)
            echo(f"✓ Published (broadcast). Event ID: {eid_hex}")
            return eid_hex
        finally:
            try:
                if hasattr(client, "disconnect"):
                    await client.disconnect()
            except Exception:
                pass


# --------------------------
# Common inputs and UI
# --------------------------

def parse_relays_input(inp: str) -> List[str]:
    urls = [u.strip() for u in inp.split(",") if u.strip()]
    return urls or ["wss://relay.damus.io"]


async def resolve_pow(relay_urls: List[str]) -> int:
    max_pow, diag = await fetch_relay_min_pow(relay_urls)
    for e in diag:
        if e["reachable"]:
            echo(
                f"• {e['url']}: NIP-11 OK, min_pow_difficulty = "
                f"{e['min_pow'] if e['min_pow'] is not None else 'n/a'}"
            )
        else:
            echo(f"• {e['url']}: NIP-11 unreachable (using defaults)")
    chosen = max(DEFAULT_POW, max_pow or 0)
    forced_by = [e["url"] for e in diag if e.get("forced")]
    if forced_by and max_pow:
        echo(f"ℹ Using PoW difficulty: {chosen} (forced by: {', '.join(forced_by)})")
    else:
        echo(f"ℹ Using PoW difficulty: {chosen}")
    return chosen


async def parse_or_resolve_event_id(input_str: str, relay_urls: List[str]) -> str:
    tok = _strip_wrappers(input_str)
    tok = _find_candidate_token(tok)
    if tok.lower().startswith("naddr1"):
        return await resolve_naddr_to_event_id(tok, relay_urls)
    return parse_nostr_id_local_only(tok)


async def prompt_single_event_id(label: str, relay_urls: List[str]) -> str:
    while True:
        s = prompt(label)
        try:
            return await parse_or_resolve_event_id(s, relay_urls)
        except Exception as e:
            echo(f"Invalid or unresolved ID: {e}")
            if not confirm("Try again?", default=True):
                raise Abort()


async def prompt_event_ids_list(label: str, relay_urls: List[str]) -> List[str]:
    while True:
        raw = prompt(label)
        tokens = [t.strip() for t in raw.split(",") if t.strip()]
        if not tokens:
            echo("Please enter at least one ID.")
            continue

        parsed: List[Optional[str]] = [None] * len(tokens)
        invalid_indices: List[int] = []

        for i, tok in enumerate(tokens):
            try:
                parsed[i] = await parse_or_resolve_event_id(tok, relay_urls)
            except Exception as e:
                invalid_indices.append(i)
                echo(f"- ID #{i+1} invalid/unresolved ('{tok}'): {e}")

        for idx in invalid_indices:
            while True:
                new_tok = prompt(f"Re-enter ID #{idx+1} (leave empty to remove)", default="", show_default=False)
                if not new_tok.strip():
                    parsed[idx] = None
                    break
                try:
                    parsed[idx] = await parse_or_resolve_event_id(new_tok.strip(), relay_urls)
                    break
                except Exception as e2:
                    echo(f"Still invalid/unresolved: {e2}")

        final_hexes = [h for h in parsed if h]
        if not final_hexes:
            echo("No valid IDs remain; please enter again.")
            continue

        seen = set()
        unique_hexes: List[str] = []
        for h in final_hexes:
            if h not in seen:
                seen.add(h)
                unique_hexes.append(h)

        return unique_hexes


# --------------------------
# Event build/sign/publish helper
# --------------------------

async def build_sign_preview_publish(
    keys: Keys,
    relay_urls: List[str],
    builder: EventBuilder,
    pow_diff: int,
    preview_title: str = "Event preview:",
) -> Tuple[str, bool]:
    signer = NostrSigner.keys(keys)
    if not DRY_RUN:
        builder = builder.pow(pow_diff)
    event = await builder.sign(signer)

    echo(f"\n{preview_title}")
    print(json.dumps(json.loads(event.as_json()), indent=2))

    if not confirm("Publish?", default=not DRY_RUN):
        echo("Aborted.")
        return event.id().to_hex(), False

    eid = await publish_event_with_client(keys, relay_urls, builder)
    display_event_links_after_publish(keys, eid)
    return eid, True

def collect_custom_l_tags() -> List[List[str]]:
    """
    Interactive loop to collect custom 'l' tags.

    Returns a list of rows like:
      ["l", <name>, <value>, <type>]

    - name: free-form (e.g., vendor_url, category_code)
    - value: free-form; if type=url we validate https://
    - type: text/id/url/date/hash/mimetype/bytes/other (free-form, defaults to 'text')
    """
    echo("\nCustom label tags (l)")
    rows: List[List[str]] = []
    while confirm("Add a custom l tag?", default=False):
        name = prompt("l.name (e.g., vendor_url, category_code)", default="", show_default=False).strip()
        if not name:
            echo("Name cannot be empty.", err=True)
            continue

        value = prompt("l.value", default="", show_default=False).strip()
        if not value:
            echo("Value cannot be empty.", err=True)
            continue

        ltype = prompt(
            "l.type (text/id/url/date/hash/mimetype/bytes/other)",
            default="text",
        ).strip().lower() or "text"

        # Minimal guardrails
        if ltype == "url":
            try:
                validate_https_url(value)
            except Exception as e:
                echo(f"Invalid url: {e}", err=True)
                continue
        elif ltype == "hash":
            # Not all hashes are sha256; warn if it isn't 64-hex
            try:
                validate_sha256_hex(value)
            except Exception:
                echo("Note: 'hash' type is generic; value is not a 64-hex sha256.", err=False)

        rows.append(["l", name, value, ltype])
        echo(f"Added: ['l', '{name}', '{value}', '{ltype}']")
    return rows


# --------------------------
# Event builders
# --------------------------

async def create_product_event() -> None:
    echo("\n=== Product Event ===")
    private_key, relay_urls = await get_user_inputs_async()

    title = prompt("Product name/title")

    canonical_url = prompt_https_optional("Canonical URL (optional, https://, Enter to skip)")
    d_tag = prompt_d_tag_optional()

    echo("\nOptional labels (press Enter to skip any):")
    vendor = prompt("vendor (text)", default="", show_default=False)
    product_name = prompt("product_name (text)", default="", show_default=False)
    product_version, pv_type = prompt_semver_or_text("product_version (semver)")
    cpe23 = prompt_cpe23_optional()
    purl = prompt_purl_optional()
    sbom_url = prompt_https_optional("sbom_url (https URL)")
    sbom_sha256 = prompt_sha256_optional(
        "sbom_sha256 (64-hex, leave blank to auto compute if sbom_url given)"
    )
    release_date = prompt_date_optional()

    pic_url: Optional[str] = None
    if confirm("Add picture/thumbnail URL for product?", default=False):
        tmp = prompt_https_optional("Picture URL (https required)")
        pic_url = tmp or None

    try:
        keys = Keys.parse(private_key)
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        sbom_mime: Optional[str] = None
        sbom_size: Optional[str] = None
        if sbom_url.strip() and not sbom_sha256.strip():
            try:
                b, hdrs = await fetch_bytes_and_headers(sbom_url.strip())
                sbom_sha256 = sha256_hex(b)
                sbom_mime = guess_mime(hdrs, sbom_url.strip()) or "application/octet-stream"
                sbom_size = str(len(b))
                echo(f"Auto-computed sbom_sha256: {sbom_sha256}")
            except Exception as e:
                echo(f"Could not fetch/hash sbom_url: {e}")
        elif sbom_url.strip():
            sbom_mime = guess_mime({}, sbom_url.strip())

        header = f"📦 SCRUTINY Product – {title}"
        details: List[str] = []
        if canonical_url.strip():
            details.append(f"URL: {canonical_url.strip()}")
        if pic_url:
            details.append(pic_url)
        body = "\n".join(details)
        hashtags = content_hashtags(TAG_PRODUCT_BASE)
        content = f"{header}"
        if body:
            content += f"\n\n{body}"
        content += f"\n\n{hashtags}"

        tags: List[Any] = []
        tags = add_scrutiny_t_tags(tags, TAG_PRODUCT_BASE)
        if d_tag.strip():
            tags.append(Tag.identifier(d_tag.strip()))
        if canonical_url.strip():
            tags.append(Tag.parse(["url", canonical_url.strip()]))

        def add_label(name: str, value: str, ltype: str) -> None:
            if value.strip():
                tags.append(Tag.parse(["l", name, value.strip(), ltype]))

        add_label("vendor", vendor, "text")
        add_label("product_name", product_name, "text")
        if product_version.strip():
            add_label("product_version", product_version.strip(), pv_type or "text")
        add_label("cpe23", cpe23, "id")
        add_label("purl", purl, "id")
        add_label("sbom_url", sbom_url, "url")
        add_label("sbom_sha256", sbom_sha256, "hash")
        add_label("sbom_m", sbom_mime or "", "mimetype")
        add_label("sbom_size", sbom_size or "", "bytes")
        add_label("release_date", release_date, "date")
        # add user-defined custom l tags
        if confirm("Add custom label tags (l)?", default=False):
            for row in collect_custom_l_tags():
                tags.append(Tag.parse(row))

        builder = EventBuilder.text_note(content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys, relay_urls, builder, pow_diff, preview_title="Event preview:"
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


async def build_and_publish_metadata_event(
    keys: Keys,
    relay_urls: List[str],
    source_url: str,
    title: Optional[str] = None,
    offer_blossom: bool = True,
    picture_url: Optional[str] = None,
    extra_labels: Optional[List[List[str]]] = None,
) -> Tuple[str, bool]:
    signer = NostrSigner.keys(keys)
    pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

    data, headers = await fetch_bytes_and_headers(source_url)
    xhash = sha256_hex(data)
    echo(f"Content SHA256 (x): {xhash}")

    mime = guess_mime(headers, source_url) or "application/octet-stream"
    fsize = str(len(data))
    dim = guess_image_dim(data, mime)

    final_url = source_url
    orig_url = source_url
    orig_x = xhash

    if offer_blossom and confirm("Upload dataset to Blossom and use its URL?", default=False):
        blossom_base = prompt_https_optional("Blossom base (https://host[:port])")
        if blossom_base.strip():
            # NIP-98 prompt disabled:
            # use_nip98 = confirm("Use NIP-98 HTTP Auth for Blossom upload?", default=False)
            up_url = await blossom_upload(
                blossom_base.strip(),
                data,
                filename=url_basename(source_url),
                use_nip98=False,
                keys=None,
            )
            if up_url:
                final_url = up_url

    ttl = title or url_basename(final_url)
    header = f"🧾 SCRUTINY Metadata – {ttl}"
    details_lines: List[str] = [f"URL: {final_url}", f"SHA256: {xhash}"]
    if picture_url:
        details_lines.append(picture_url)
    body = "\n".join(details_lines)
    hashtags = content_hashtags(TAG_METADATA_BASE)
    content = f"{header}\n\n{body}\n\n{hashtags}"

    tags: List[Any] = []
    tags = add_scrutiny_t_tags(tags, TAG_METADATA_BASE)
    # Put NIP-94-like metadata into kind:1 MetadataEvent (no kind:1063)
    tags.append(Tag.parse(["url", final_url]))
    tags.append(Tag.parse(["x", xhash]))
    tags.append(Tag.parse(["m", mime]))
    tags.append(Tag.parse(["size", fsize]))
    if dim:
        tags.append(Tag.parse(["dim", dim]))
    if ttl:
        tags.append(Tag.parse(["alt", ttl]))

    # Source host label
    try:
        host = urlparse(orig_url).netloc
        if host:
            tags.append(Tag.parse(["l", "source", host, "host"]))
    except Exception:
        pass

    if extra_labels:
        fixed_labels: List[List[str]] = []
        for l in extra_labels:
            try:
                if len(l) >= 4 and l[0] == "l" and l[1] == "cpe23" and l[2].strip():
                    try:
                        validate_cpe23(l[2].strip())
                        fixed_labels.append(l)
                    except Exception as e:
                        echo(f"Invalid cpe23 label skipped: {e}")
                else:
                    fixed_labels.append(l)
            except Exception:
                continue
        for l in fixed_labels:
            tags.append(Tag.parse(l))

    if final_url != orig_url:
        tags.append(Tag.parse(["l", "original_url", orig_url, "url"]))
    tags.append(Tag.parse(["l", "original_x", orig_x, "hash"]))

    builder = EventBuilder.text_note(content).tags(tags)
    eid, published = await build_sign_preview_publish(
        keys, relay_urls, builder, pow_diff, preview_title="MetadataEvent preview:"
    )
    return eid, published


async def create_metadata_event() -> None:
    echo("\n=== Metadata Event ===")
    private_key, relay_urls = await get_user_inputs_async()

    # Ask for the source URL until a non-empty https URL is provided
    src_url = ""
    while not src_url:
        src_url = prompt_https_optional("URL to data file (https required)")
        if not src_url:
            echo("A https URL is required.", err=True)

    ttl_default = url_basename(src_url)
    ttl = prompt(
        f"Short title (optional, default: {ttl_default})",
        default=ttl_default,
        show_default=True,
    )

    pic_url: Optional[str] = None
    if confirm("Add picture/thumbnail URL for metadata?", default=False):
        tmp = prompt_https_optional("Picture URL (https required)")
        pic_url = tmp or None

    extra_labels: List[List[str]] = []
    if confirm(
        "Add product-related labels (vendor, product_version, cpe23, purl, type, tool)?",
        default=False,
    ):
        vendor = prompt("vendor (text)", default="", show_default=False)
        product_name = prompt(
            "product_name (text)", default="", show_default=False
        )
        product_version, pv_type = prompt_semver_or_text(
            "product_version (semver)"
        )
        cpe = prompt_cpe23_optional()
        purl = prompt_purl_optional()
        metadata_type = prompt("metadata_type (text)", default="", show_default=False)
        measurement_tool = prompt("tool (text)", default="", show_default=False)

        def add_l(name: str, value: str, ltype: str):
            if value.strip():
                extra_labels.append(["l", name, value.strip(), ltype])

        add_l("vendor", vendor, "text")
        add_l("product_name", product_name, "text")
        if product_version.strip():
            add_l(
                "product_version",
                product_version.strip(),
                pv_type or "text",
            )
        if cpe.strip():
            add_l("cpe23", cpe.strip(), "id")
        if purl.strip():
            add_l("purl", purl.strip(), "id")
        add_l("type", metadata_type, "text")
        add_l("tool", measurement_tool, "text")
        # add user-defined custom l tags for metadata
        if confirm("Add custom label tags (l)?", default=False):
            extra_labels.extend(collect_custom_l_tags())

    try:
        keys = Keys.parse(private_key)
    except Exception as e:
        echo(f"Invalid private key: {e}", err=True)
        return

    # Try to build/publish; on fetch errors (e.g., 403), let the user
    # re-enter just the URL and try again. Keep all other inputs intact.
    while True:
        try:
            main_id, _pub = await build_and_publish_metadata_event(
                keys,
                relay_urls,
                src_url,
                title=ttl,
                offer_blossom=True,
                picture_url=pic_url,
                extra_labels=extra_labels or None,
            )
            _ = main_id
            break
        except Exception as e:
            echo(f"Error while fetching or building metadata: {e}", err=True)
            if not confirm("Re-enter the data file URL and try again?", default=True):
                return
            # Re-prompt just the URL and retry
            new_url = prompt_https_optional("URL to data file (https required)")
            if not new_url:
                echo("A https URL is required.", err=True)
                continue
            src_url = new_url
            # Optionally refresh the default title if the user left it as
            # default the first time
            if ttl == ttl_default:
                ttl_default = url_basename(src_url)
                ttl = prompt(
                    f"Short title (optional, default: {ttl_default})",
                    default=ttl_default,
                    show_default=True,
                )


async def create_binding_event() -> None:
    echo("\n=== Binding Event ===")
    private_key, relay_urls = await get_user_inputs_async()

    echo(
        "Enter Product Event IDs (any of hex/note/nevent/naddr/NIP-19 URI/URL), "
        "comma-separated (at least one)"
    )
    prod_hexes = await prompt_event_ids_list("Product Event IDs", relay_urls)
    echo(
        "Enter Metadata Event IDs (any of hex/note/nevent/naddr/NIP-19 URI/URL), "
        "comma-separated (at least one)"
    )
    meta_hexes = await prompt_event_ids_list("Metadata Event IDs", relay_urls)
    note = prompt("Optional note (Enter to skip)", default="", show_default=False)

    try:
        keys = Keys.parse(private_key)
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        header = "🔗 SCRUTINY Binding"
        if note.strip():
            header += f" – {note.strip()}"

        details_lines: List[str] = []
        for p_hex in prod_hexes:
            p_obj = EventId.parse(p_hex)
            details_lines.append(f"Product: {p_obj.to_nostr_uri()}")
        for m_hex in meta_hexes:
            m_obj = EventId.parse(m_hex)
            details_lines.append(f"Metadata: {m_obj.to_nostr_uri()}")
        details = "\n".join(details_lines)

        hashtags = content_hashtags(TAG_BINDING_BASE)
        content = f"{header}\n\n{details}\n\n{hashtags}"

        tags: List[Any] = []
        tags = add_scrutiny_t_tags(tags, TAG_BINDING_BASE)
        for m_hex in meta_hexes:
            tags.append(Tag.parse(["e", m_hex, "", "mention"]))
        for p_hex in prod_hexes:
            tags.append(Tag.parse(["e", p_hex, "", "mention"]))

        builder = EventBuilder.text_note(content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys, relay_urls, builder, pow_diff, preview_title="Event preview:"
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


async def create_update_event() -> None:
    echo("\n=== Reply-as-Update Event ===")
    private_key, relay_urls = await get_user_inputs_async()

    original_hex = await prompt_single_event_id(
        "Original event ID (hex/note/nevent/naddr/NIP-19 URI/URL)",
        relay_urls,
    )

    echo("Original type:")
    echo("1. Product")
    echo("2. Metadata")
    echo("3. Binding")
    event_type_choice = prompt("Select (1-3)", type=int)

    type_mapping = {1: TAG_PRODUCT_BASE, 2: TAG_METADATA_BASE, 3: TAG_BINDING_BASE}
    if event_type_choice not in type_mapping:
        echo("Invalid choice.")
        return
    original_type_tag = type_mapping[event_type_choice]

    update_note = prompt("Update note (free text)", default="", show_default=False)

    add_p = confirm(
        "Add p tag referencing original author's pubkey?", default=False
    )
    original_pubkey_hex: Optional[str] = None
    if add_p:
        while True:
            try:
                pub = prompt(
                    "Enter original author's pubkey (npub/nprofile/hex)"
                )
                original_pubkey_hex = parse_pubkey_to_hex(pub)
                break
            except Exception as e:
                echo(f"Invalid pubkey: {e}")
                if not confirm("Try again?", default=True):
                    original_pubkey_hex = None
                    break

    new_url: Optional[str] = None
    new_x: Optional[str] = None

    if original_type_tag == TAG_METADATA_BASE:
        if confirm("Provide a new URL to update url/x?", default=False):
            while True:
                try:
                    new_url_try = prompt_https_optional(
                        "New URL (https required)"
                    )
                    if not new_url_try:
                        echo("URL cannot be empty here.", err=True)
                        continue
                    data, _ = await fetch_bytes_and_headers(new_url_try)
                    new_x_try = sha256_hex(data)
                    new_url = new_url_try
                    new_x = new_x_try
                    echo(f"New x: {new_x}")
                    break
                except Exception as e:
                    echo(f"Could not fetch/hash URL: {e}")
                    if not confirm("Try a different URL?", default=True):
                        new_url = None
                        new_x = None
                        break

    try:
        original_obj = EventId.parse(original_hex)
        original_uri = original_obj.to_nostr_uri()

        keys = Keys.parse(private_key)
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        header = "✏️ SCRUTINY Update"
        if update_note.strip():
            header += f" – {update_note.strip()}"
        details_lines = [f"Root: {original_uri}"]
        if new_url and new_x:
            details_lines.append(f"URL: {new_url}")
            details_lines.append(f"SHA256: {new_x}")
        details = "\n".join(details_lines)
        hashtags = content_hashtags(TAG_UPDATE_BASE, original_type_tag)
        content = f"{header}\n\n{details}\n\n{hashtags}"

        tags: List[Any] = []
        tags = add_scrutiny_t_tags(tags, TAG_UPDATE_BASE, original_type_tag)
        tags.append(Tag.parse(["e", original_hex, "", "root"]))
        tags.append(Tag.parse(["e", original_hex, "", "reply"]))
        if original_pubkey_hex:
            tags.append(Tag.parse(["p", original_pubkey_hex]))
        if new_url and new_x:
            tags.append(Tag.parse(["url", new_url]))
            tags.append(Tag.parse(["x", new_x]))

        builder = EventBuilder.text_note(content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys,
            relay_urls,
            builder,
            pow_diff,
            preview_title="Event preview:",
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


async def create_contestation_event() -> None:
    echo("\n=== Contestation (Metadata) ===")
    private_key, relay_urls = await get_user_inputs_async()

    contested_hex = await prompt_single_event_id(
        "Contested MetadataEvent ID (hex/note/nevent/naddr/NIP-19 URI/URL)",
        relay_urls,
    )

    echo("Evidence:")
    echo("1. Reference existing alternative MetadataEvent")
    echo("2. Provide URL (will publish new MetadataEvent as evidence)")
    ev_choice = prompt("Select (1-2)", type=int)

    reason = prompt("Short reason (optional)", default="", show_default=False)

    try:
        keys = Keys.parse(private_key)
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        contested_obj = EventId.parse(contested_hex)
        contested_uri = contested_obj.to_nostr_uri()

        if ev_choice == 1:
            alt_hex = await prompt_single_event_id(
                "Alternative MetadataEvent ID (hex/note/nevent/naddr/NIP-19 URI/URL)",
                relay_urls,
            )
            alt_obj = EventId.parse(alt_hex)
            alt_uri = alt_obj.to_nostr_uri()
        elif ev_choice == 2:
            url = prompt_https_optional("Evidence URL (https required)")
            if not url:
                echo("Evidence URL cannot be empty.", err=True)
                return
            alt_hex, published = await build_and_publish_metadata_event(
                keys,
                relay_urls,
                url,
                title="Evidence metadata for contestation",
                offer_blossom=True,
                picture_url=None,
            )
            if not published:
                echo("Evidence was not published. Aborting contestation.")
                return
            alt_obj = EventId.parse(alt_hex)
            alt_uri = alt_obj.to_nostr_uri()
        else:
            echo("Invalid choice.")
            return

        header = "⚖️ SCRUTINY Contestation"
        if reason.strip():
            header += f" – {reason.strip()}"
        details = f"Contested: {contested_uri}\nAlternative: {alt_uri}"
        hashtags = content_hashtags(TAG_CONTEST_BASE, TAG_METADATA_BASE)
        content = f"{header}\n\n{details}\n\n{hashtags}"

        tags: List[Any] = []
        tags = add_scrutiny_t_tags(tags, TAG_CONTEST_BASE, TAG_METADATA_BASE)
        tags.append(Tag.parse(["e", contested_hex, "", "root"]))
        tags.append(Tag.parse(["e", contested_hex, "", "reply"]))
        tags.append(Tag.parse(["e", alt_obj.to_hex(), "", "mention"]))

        builder = EventBuilder.text_note(content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys,
            relay_urls,
            builder,
            pow_diff,
            preview_title="Event preview:",
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


async def create_confirmation_event() -> None:
    echo("\n=== Confirmation ===")
    private_key, relay_urls = await get_user_inputs_async()

    original_hex = await prompt_single_event_id(
        "Original event ID to confirm (hex/note/nevent/naddr/NIP-19 URI/URL)",
        relay_urls,
    )

    echo("Original type:")
    echo("1. Product")
    echo("2. Metadata")
    echo("3. Binding")
    event_type_choice = prompt("Select (1-3)", type=int)

    type_mapping = {1: TAG_PRODUCT_BASE, 2: TAG_METADATA_BASE, 3: TAG_BINDING_BASE}
    if event_type_choice not in type_mapping:
        echo("Invalid choice.")
        return
    original_type_tag = type_mapping[event_type_choice]

    note = prompt("Confirmation note (optional)", default="", show_default=False)

    echo("Evidence:")
    echo("1. Reference existing MetadataEvent")
    echo("2. Provide URL (will publish new MetadataEvent and attach)")
    add_evidence_choice = prompt(
        "Select (1-2, Enter to skip)", default="", show_default=False
    )

    evidence_e_id_hex: Optional[str] = None
    try:
        if add_evidence_choice.strip() == "1":
            e_id = await prompt_single_event_id(
                "Evidence MetadataEvent ID (hex/note/nevent/naddr/URI/URL)",
                relay_urls,
            )
            evidence_e_id_hex = e_id
        elif add_evidence_choice.strip() == "2":
            e_url = prompt_https_optional("Evidence URL (https required)")
            if not e_url:
                echo("Evidence URL cannot be empty.", err=True)
                return
            keys_tmp = Keys.parse(private_key)
            e_hex, published = await build_and_publish_metadata_event(
                keys_tmp,
                relay_urls,
                e_url,
                title="Evidence for confirmation",
                offer_blossom=True,
                picture_url=None,
            )
            if not published:
                echo("Evidence was not published. Aborting confirmation.")
                return
            evidence_e_id_hex = e_hex
    except Exception as e:
        echo(f"Skipping evidence: {e}")

    try:
        keys = Keys.parse(private_key)
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        original_obj = EventId.parse(original_hex)
        original_uri = original_obj.to_nostr_uri()

        header = "✅ SCRUTINY Confirmation"
        if note.strip():
            header += f" – {note.strip()}"
        details = f"Root: {original_uri}"
        hashtags = content_hashtags(TAG_CONFIRM_BASE, original_type_tag)
        content = f"{header}\n\n{details}\n\n{hashtags}"

        tags: List[Any] = []
        tags = add_scrutiny_t_tags(tags, TAG_CONFIRM_BASE, original_type_tag)
        # Add both root and reply markers for compatibility
        tags.append(Tag.parse(["e", original_hex, "", "root"]))
        tags.append(Tag.parse(["e", original_hex, "", "reply"]))
        if evidence_e_id_hex:
            tags.append(Tag.parse(["e", evidence_e_id_hex, "", "mention"]))

        builder = EventBuilder.text_note(content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys,
            relay_urls,
            builder,
            pow_diff,
            preview_title="Event preview:",
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


async def create_delete_event() -> None:
    echo("\n=== Delete Event (NIP-09) ===")
    private_key, relay_urls = await get_user_inputs_async()

    echo("IMPORTANT:")
    echo("- Only for events you authored")
    echo("- Relays may ignore deletion")
    echo("- Action cannot be undone if relays comply")

    if not confirm("Continue?"):
        echo("Aborted.")
        return

    try:
        _ = Keys.parse(private_key)
    except Exception as e:
        echo(f"Invalid private key: {e}")
        return

    events_to_delete: List[Dict[str, Any]] = []
    echo("Enter event IDs to delete (one by one). Empty to finish.")
    while True:
        event_id = prompt("Event ID (hex/note/nevent/naddr/NIP-19 URI/URL)", default="", show_default=False)
        if not event_id.strip():
            break
        try:
            event_id_hex = await parse_or_resolve_event_id(event_id, relay_urls)
            event_id_obj = EventId.parse(event_id_hex)
            events_to_delete.append({"id": event_id_hex, "obj": event_id_obj, "original": event_id.strip()})
            echo(f"Added: {event_id}")
        except Exception as e:
            echo(f"Invalid/unresolved ID '{event_id}': {e}")
            if not confirm("Continue adding?", default=True):
                break

    if not events_to_delete:
        echo("No events. Aborted.")
        return

    reason = prompt("Reason (optional)", default="", show_default=False)

    try:
        pow_diff = 0 if DRY_RUN else await resolve_pow(relay_urls)

        header = "🗑️ SCRUTINY Delete"
        if reason.strip():
            header += f" – {reason.strip()}"
        content = header

        tags: List[Any] = []
        for info in events_to_delete:
            tags.append(Tag.event(info["obj"]))

        keys = Keys.parse(private_key)
        builder = EventBuilder(Kind(5), content).tags(tags)
        eid, published = await build_sign_preview_publish(
            keys, relay_urls, builder, pow_diff, preview_title="Event preview:"
        )
        _ = (eid, published)
    except Exception as e:
        echo(f"Error: {e}", err=True)


# --------------------------
# Async UI helpers
# --------------------------

async def get_user_inputs_async() -> Tuple[str, List[str]]:
    global PUBLISH_MODE

    echo("\n--- Settings ---")
    private_key = prompt_private_key()
    relay_urls = prompt_relays()

    mode_raw = prompt("Publish mode: 1) broadcast to all relays  2) first relay that succeeds", default="1")
    PUBLISH_MODE = "first_success" if str(mode_raw).strip() == "2" else "broadcast"
    return private_key, relay_urls


# --------------------------
# CLI
# --------------------------

def main():
    try:
        asyncio.run(app_loop())
    except (Abort, KeyboardInterrupt):
        echo("\nExit.")


async def app_loop():
    global TAG_PROFILE_TEST, DRY_RUN

    echo(
        """
    ╔═══════════════════════════════════════════════════════════╗
    ║                    SCRUTINY PUBLISHER                     ║
    ║              Security Metadata Overlay CLI                ║
    ╚═══════════════════════════════════════════════════════════╝
    """
    )

    mode_choice = prompt("Tag profile: 1) Production tags  2) Test tags (append _v01 to all types)", default="1", type=str)
    TAG_PROFILE_TEST = str(mode_choice).strip() == "2"
    echo(f"Tag profile: {'TEST' if TAG_PROFILE_TEST else 'PRODUCTION'}")

    DRY_RUN = confirm("Enable dry-run (no publish, minimal PoW/signing)?", default=False)
    if DRY_RUN:
        echo("Dry-run enabled: events will not be published")

    while True:
        echo("\nSelect an action:")
        echo("1. ProductEvent")
        echo("2. MetadataEvent")
        echo("3. BindingEvent")
        echo("4. Reply-as-Update")
        echo("5. Contestation")
        echo("6. Confirmation")
        echo("7. Delete")
        echo("8. Exit")

        try:
            choice = prompt("Choice (1-8)", type=int)
            if choice == 1:
                await create_product_event()
            elif choice == 2:
                await create_metadata_event()
            elif choice == 3:
                await create_binding_event()
            elif choice == 4:
                await create_update_event()
            elif choice == 5:
                await create_contestation_event()
            elif choice == 6:
                await create_confirmation_event()
            elif choice == 7:
                await create_delete_event()
            elif choice == 8:
                echo("Exit.")
                break
            else:
                echo("Invalid choice.")
        except (Abort, KeyboardInterrupt):
            echo("\nExit.")
            break
        except Exception as e:
            echo(f"Unexpected error: {e}", err=True)


if __name__ == "__main__":
    main()
