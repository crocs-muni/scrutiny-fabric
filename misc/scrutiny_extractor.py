"""
SCRUTINY Product Event Extractor for sec-certs Common Criteria Certificates
Extracts and creates Nostr ProductEvents following SCRUTINY metadata overlay specification
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Any
from urllib.parse import urlparse
from dataclasses import dataclass
import time

from sec_certs.dataset import CCDataset

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrutiny_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# TAG PROFILE CONFIGURATION
# ============================================================================

class TagProfile:
    """Tag naming profiles for different environments"""

    PRODUCTION = "production"
    TEST = "test"

    @staticmethod
    def get_tags(profile: str = PRODUCTION) -> Dict[str, str]:
        """Get tag names for the specified profile"""
        if profile == TagProfile.TEST:
            return {
                "namespace": "scrutiny_mo_v01",
                "type_product": "scrutiny_product_v01",
                "type_metadata": "scrutiny_metadata_v01",
                "type_binding": "scrutiny_binding_v01",
                "version": "scrutiny_v01",  # Don't append _v01 to this
            }
        else:  # PRODUCTION
            return {
                "namespace": "scrutiny_mo",
                "type_product": "scrutiny_product",
                "type_metadata": "scrutiny_metadata",
                "type_binding": "scrutiny_binding",
                "version": "scrutiny_v01",
            }

    @staticmethod
    def get_hashtags(profile: str = PRODUCTION) -> List[str]:
        """Get hashtags for the specified profile"""
        tags = TagProfile.get_tags(profile)
        return [
            f"#{tags['namespace']}",
            f"#{tags['type_product']}",
            f"#{tags['version']}"
        ]

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def extract_vendor_domain(vendor: str, vendor_url: Optional[str]) -> str:
    """
    Extract vendor domain in reverse DNS format (com.vendor)

    Strategy:
    1. Try to extract from vendor_url
    2. Fallback to first word of vendor name + ".com"

    Args:
        vendor: Vendor name (e.g., "NXP Semiconductors Netherlands N.V.")
        vendor_url: Vendor website URL (e.g., "https://www.nxp.com")

    Returns:
        Reverse DNS domain (e.g., "com.nxp")
    """

    # Strategy 1: Extract from vendor_url
    if vendor_url:
        try:
            parsed = urlparse(vendor_url)
            domain = parsed.netloc or parsed.path

            # Remove www. prefix
            domain = re.sub(r'^www\.', '', domain)

            # Extract domain parts
            parts = domain.split('.')
            if len(parts) >= 2:
                # Reverse DNS format: com.vendor or org.vendor
                tld = parts[-1]  # com, org, net, etc.
                vendor_name = parts[-2]
                return f"{tld}.{vendor_name}"

        except Exception as e:
            logger.debug(f"Failed to extract domain from URL '{vendor_url}': {e}")

    # Strategy 2: Fallback to first word
    if vendor:
        try:
            first_word = vendor.split()[0].lower()
            # Remove common suffixes
            first_word = re.sub(r'(,|\.|\s)+$', '', first_word)
            return f"com.{first_word}"

        except Exception as e:
            logger.debug(f"Failed to extract vendor domain from '{vendor}': {e}")

    return "com.unknown"


def parse_versions_from_name(product_name: str, extracted_versions: List[str]) -> List[str]:
    """
    Use extracted versions from sec-certs

    Strategy:
    - If extracted_versions has elements, use ONLY those
    - If extracted_versions is empty, return empty list (will create one event without version)
    - Don't try to parse name ourselves - sec-certs already did that

    Args:
        product_name: Full product name (not used)
        extracted_versions: List of extracted version strings from sec-certs

    Returns:
        List of product versions to create events for

    Example:
        Input: extracted_versions = ["4.5.0.0"]
        Output: ["4.5.0.0"]
        Result: ONE event created

        Input: extracted_versions = []
        Output: []
        Result: ONE event created without version
    """

    if not extracted_versions:
        return []

    try:
        # If sec-certs extracted versions, use ONLY those
        # Don't try to parse name ourselves
        return extracted_versions

    except Exception as e:
        logger.debug(f"Error processing extracted versions: {e}")
        return []


def generate_product_identifier(vendor_domain: str, product_name: str, version: Optional[str] = None) -> str:
    """
    Generate product identifier for d tag

    Format: {vendor_domain}:{product_base}-{version}
    Example: com.nxp:jcop-8.0-R1.39.0.2

    Args:
        vendor_domain: Reverse DNS vendor domain (e.g., "com.nxp")
        product_name: Full product name
        version: Optional version string

    Returns:
        Product identifier string
    """

    try:
        # Extract base product name (first few significant words)
        # Remove common noise words
        noise_words = {'with', 'on', 'for', 'the', 'and', 'or', 'version', 'versions'}

        words = product_name.split() if product_name else ['unknown']
        product_words = []

        for word in words[:5]:  # Take first 5 words max
            # Stop at version numbers or release info
            if re.match(r'^\d+\.\d+', word) or re.match(r'^[Rr]\d+', word):
                break
            # Skip noise words
            if word.lower() in noise_words:
                continue
            product_words.append(word)
            # Stop after getting 2-3 meaningful words
            if len(product_words) >= 2:
                break

        if not product_words:
            product_words = ['unknown']

        product_base = '-'.join(product_words).lower()

        # Construct identifier
        if version:
            return f"{vendor_domain}:{product_base}-{version}"
        else:
            return f"{vendor_domain}:{product_base}"

    except Exception as e:
        logger.debug(f"Error generating product identifier: {e}")
        return f"{vendor_domain}:unknown"


def flatten_crypto_keywords(crypto_dict: Any) -> List[str]:
    """
    Flatten nested crypto keyword structure to simple list of algorithm names

    Input example:
    {
      "AES_competition": {"AES": {"AES": 19}},
      "DES": {"3DES": {"Triple-DES": 4, "3DES": 1}}
    }

    Output: ["AES", "Triple-DES", "3DES"]

    Args:
        crypto_dict: Nested dictionary of crypto keywords

    Returns:
        Sorted list of unique algorithm names
    """

    if not crypto_dict:
        return []

    try:
        algorithms = set()

        def recurse(obj, depth=0):
            """Recursively extract algorithm names"""
            if depth > 5:  # Prevent infinite recursion
                return

            if isinstance(obj, dict):
                for key, value in obj.items():
                    if isinstance(value, dict):
                        # Check if this is a leaf node (value contains counts)
                        if any(isinstance(v, int) for v in value.values()):
                            # Leaf node - key is algorithm name
                            algorithms.add(key)
                        else:
                            # Intermediate node - recurse
                            recurse(value, depth + 1)
                    elif isinstance(value, (int, str)):
                        # Direct value - key is algorithm name
                        algorithms.add(key)
            elif isinstance(obj, (list, set)):
                for item in obj:
                    recurse(item, depth + 1)

        recurse(crypto_dict)
        return sorted(algorithms)

    except Exception as e:
        logger.debug(f"Error flattening crypto keywords: {e}")
        return []


def safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """
    Safely get value from dict or object attribute

    Args:
        obj: Dictionary or object
        key: Key or attribute name
        default: Default value if not found

    Returns:
        Value or default
    """
    try:
        if isinstance(obj, dict):
            return obj.get(key, default)
        else:
            return getattr(obj, key, default)
    except Exception:
        return default


def safe_extract(obj: Any, attr: str, default: Any = None) -> Any:
    """
    Safely extract attribute from object with error handling

    Args:
        obj: Object to extract from
        attr: Attribute name
        default: Default value if extraction fails

    Returns:
        Extracted value or default
    """
    try:
        if obj is None:
            return default
        value = getattr(obj, attr, default)
        return value if value is not None else default
    except Exception as e:
        logger.debug(f"Error extracting '{attr}': {e}")
        return default


def validate_url(url: Optional[str]) -> Optional[str]:
    """
    Validate and return URL if valid, None otherwise

    Args:
        url: URL string to validate

    Returns:
        Valid URL or None
    """
    if not url or not isinstance(url, str):
        return None

    try:
        result = urlparse(url)
        # Must have scheme and netloc
        if result.scheme and result.netloc:
            return url
    except Exception:
        pass

    return None


def truncate_field(value: str, max_length: int = 500) -> str:
    """
    Truncate long field values to prevent oversized events

    Args:
        value: String to truncate
        max_length: Maximum allowed length

    Returns:
        Truncated string with ellipsis if needed
    """
    if not value:
        return ""

    if len(value) <= max_length:
        return value

    return value[:max_length - 3] + "..."


# ============================================================================
# DATA EXTRACTION
# ============================================================================

@dataclass
class ProductData:
    """Structured product data extracted from certificate"""
    dgst: str  # Only required field
    cert_type: str
    vendor: Optional[str] = None
    vendor_domain: Optional[str] = None
    product_name: Optional[str] = None
    product_identifier: Optional[str] = None
    version: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    cert_link: Optional[str] = None
    report_link: Optional[str] = None
    security_target_link: Optional[str] = None
    vendor_url: Optional[str] = None
    security_level: Optional[List[str]] = None
    scheme: Optional[str] = None
    not_valid_before: Optional[str] = None
    not_valid_after: Optional[str] = None
    cert_id: Optional[str] = None
    eal: Optional[str] = None
    cpe_matches: Optional[List[str]] = None
    symmetric_crypto: Optional[List[str]] = None
    asymmetric_crypto: Optional[List[str]] = None
    hash_function: Optional[List[str]] = None
    cipher_mode: Optional[List[str]] = None
    javacard_version: Optional[List[str]] = None


def extract_product_data(cert) -> List[ProductData]:
    """
    Extract product data from certificate and split into multiple products if needed

    Args:
        cert: CCCertificate object

    Returns:
        List of ProductData objects (one per product version)
    """

    # Only dgst is required
    dgst = safe_extract(cert, 'dgst')
    if not dgst:
        logger.error("Certificate missing dgst, cannot process")
        return []

    cert_type = "cc"  # For CCCertificate

    # Extract basic info (all optional)
    vendor = safe_extract(cert, 'manufacturer')
    vendor_url = validate_url(safe_extract(cert, 'manufacturer_web'))
    product_name = safe_extract(cert, 'name')
    category = safe_extract(cert, 'category')
    status = safe_extract(cert, 'status')

    # Extract URLs
    cert_link = validate_url(safe_extract(cert, 'cert_link'))
    report_link = validate_url(safe_extract(cert, 'report_link'))
    security_target_link = validate_url(safe_extract(cert, 'st_link'))

    # Get vendor domain
    vendor_domain = extract_vendor_domain(vendor or "", vendor_url)

    # Security evaluation
    security_level = []
    try:
        if cert.security_level:
            if hasattr(cert.security_level, 'elements'):
                security_level = list(cert.security_level.elements)
            else:
                security_level = list(cert.security_level)
    except Exception as e:
        logger.debug(f"Error extracting security_level: {e}")

    scheme = safe_extract(cert, 'scheme')

    not_valid_before = None
    not_valid_after = None
    try:
        if cert.not_valid_before:
            not_valid_before = str(cert.not_valid_before)
        if cert.not_valid_after:
            not_valid_after = str(cert.not_valid_after)
    except Exception as e:
        logger.debug(f"Error extracting dates: {e}")

    # Heuristics
    cert_id = None
    eal = None
    extracted_versions = []
    cpe_matches = []

    try:
        if cert.heuristics:
            cert_id = safe_extract(cert.heuristics, 'cert_id')
            eal = safe_extract(cert.heuristics, 'eal')

            # Extract versions
            if cert.heuristics.extracted_versions:
                if hasattr(cert.heuristics.extracted_versions, 'elements'):
                    extracted_versions = list(cert.heuristics.extracted_versions.elements)
                else:
                    extracted_versions = list(cert.heuristics.extracted_versions)

            # Extract CPE matches (only if not null and has elements)
            if cert.heuristics.cpe_matches:
                if hasattr(cert.heuristics.cpe_matches, 'elements'):
                    cpe_list = list(cert.heuristics.cpe_matches.elements)
                else:
                    cpe_list = list(cert.heuristics.cpe_matches)

                if cpe_list:
                    cpe_matches = cpe_list
    except Exception as e:
        logger.debug(f"Error extracting heuristics: {e}")

    # Parse versions from product name
    product_versions = parse_versions_from_name(product_name or "", extracted_versions)

    # Extract crypto keywords (flattened)
    symmetric_crypto = []
    asymmetric_crypto = []
    hash_function = []
    cipher_mode = []
    javacard_version = []

    try:
        if cert.pdf_data:
            # pdf_data might be dict or object
            pdf_data = cert.pdf_data

            # Get report_keywords - it's likely a dict
            report_keywords = safe_get(pdf_data, 'report_keywords')

            if report_keywords:
                # Access as dict
                sym_crypto = safe_get(report_keywords, 'symmetric_crypto')
                if sym_crypto:
                    symmetric_crypto = flatten_crypto_keywords(sym_crypto)

                asym_crypto = safe_get(report_keywords, 'asymmetric_crypto')
                if asym_crypto:
                    asymmetric_crypto = flatten_crypto_keywords(asym_crypto)

                hash_func = safe_get(report_keywords, 'hash_function')
                if hash_func:
                    hash_function = flatten_crypto_keywords(hash_func)

                cipher = safe_get(report_keywords, 'cipher_mode')
                if cipher:
                    cipher_mode = flatten_crypto_keywords(cipher)

                jc_ver = safe_get(report_keywords, 'javacard_version')
                if jc_ver:
                    javacard_version = flatten_crypto_keywords(jc_ver)

    except Exception as e:
        logger.debug(f"Error extracting crypto keywords: {e}")

    # Create ProductData objects
    products = []

    try:
        if product_versions:
            # Multiple versions - create separate ProductData for each
            for version in product_versions:
                product_id = generate_product_identifier(vendor_domain, product_name or "unknown", version)

                products.append(ProductData(
                    dgst=dgst,
                    cert_type=cert_type,
                    vendor=vendor,
                    vendor_domain=vendor_domain,
                    product_name=product_name,
                    product_identifier=product_id,
                    version=version,
                    category=category,
                    status=status,
                    cert_link=cert_link,
                    report_link=report_link,
                    security_target_link=security_target_link,
                    vendor_url=vendor_url,
                    security_level=security_level if security_level else None,
                    scheme=scheme,
                    not_valid_before=not_valid_before,
                    not_valid_after=not_valid_after,
                    cert_id=cert_id,
                    eal=eal,
                    cpe_matches=cpe_matches if cpe_matches else None,
                    symmetric_crypto=symmetric_crypto if symmetric_crypto else None,
                    asymmetric_crypto=asymmetric_crypto if asymmetric_crypto else None,
                    hash_function=hash_function if hash_function else None,
                    cipher_mode=cipher_mode if cipher_mode else None,
                    javacard_version=javacard_version if javacard_version else None
                ))
        else:
            # No versions found - create single ProductData without version
            product_id = generate_product_identifier(vendor_domain, product_name or "unknown", None)

            products.append(ProductData(
                dgst=dgst,
                cert_type=cert_type,
                vendor=vendor,
                vendor_domain=vendor_domain,
                product_name=product_name,
                product_identifier=product_id,
                version=None,
                category=category,
                status=status,
                cert_link=cert_link,
                report_link=report_link,
                security_target_link=security_target_link,
                vendor_url=vendor_url,
                security_level=security_level if security_level else None,
                scheme=scheme,
                not_valid_before=not_valid_before,
                not_valid_after=not_valid_after,
                cert_id=cert_id,
                eal=eal,
                cpe_matches=cpe_matches if cpe_matches else None,
                symmetric_crypto=symmetric_crypto if symmetric_crypto else None,
                asymmetric_crypto=asymmetric_crypto if asymmetric_crypto else None,
                hash_function=hash_function if hash_function else None,
                cipher_mode=cipher_mode if cipher_mode else None,
                javacard_version=javacard_version if javacard_version else None
            ))

    except Exception as e:
        logger.error(f"Error creating ProductData for {dgst}: {e}")
        # Return minimal product with just dgst
        products.append(ProductData(
            dgst=dgst,
            cert_type=cert_type,
            vendor_domain=vendor_domain,
            product_identifier=generate_product_identifier(vendor_domain, "unknown", None)
        ))

    return products


def validate_product_data(product: ProductData) -> List[str]:
    """
    Validate extracted product data
    Only dgst is required - everything else is optional

    Args:
        product: ProductData object

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []

    # Only dgst is required
    if not product.dgst:
        errors.append("Missing dgst")

    # Everything else is just warnings, not errors
    if not product.product_name:
        logger.debug(f"Product {product.dgst} has no product_name")

    if not product.vendor:
        logger.debug(f"Product {product.dgst} has no vendor")

    return errors


# ============================================================================
# EVENT CREATION
# ============================================================================

def create_product_event(product: ProductData, tag_profile: str = TagProfile.PRODUCTION) -> Dict:
    """
    Create Nostr ProductEvent from ProductData

    Args:
        product: ProductData object
        tag_profile: Tag profile to use ("production" or "test")

    Returns:
        Event dictionary (not yet signed)
    """

    # Get tag names for the selected profile
    tag_names = TagProfile.get_tags(tag_profile)
    hashtags = TagProfile.get_hashtags(tag_profile)

    # Construct sec-certs URL
    seccerts_url = f"https://sec-certs.org/{product.cert_type}/{product.dgst}/"

    # Build human-readable content
    content_parts = [
        f"Common Criteria Certified Product: {truncate_field(product.product_name or 'Unknown Product', 200)}",
        ""
    ]

    if product.vendor:
        content_parts.append(f"Manufacturer: {product.vendor}")

    if product.version:
        content_parts.append(f"Version: {product.version}")

    if product.category:
        content_parts.append(f"Category: {truncate_field(product.category, 100)}")

    if product.eal:
        content_parts.append(f"Security Level: {product.eal}")
    elif product.security_level:
        levels = ', '.join(product.security_level[:3])
        content_parts.append(f"Security Level: {levels}")

    if product.status:
        content_parts.append(f"Status: {product.status}")

    content_parts.extend([
        "",
        f"Certification: {seccerts_url}",
        "",
        " ".join(hashtags)
    ])

    content = "\n".join(content_parts)

    # Build tags
    tags = [
        ["t", tag_names["namespace"]],
        ["t", tag_names["type_product"]],
        ["t", tag_names["version"]],
        ["d", product.product_identifier or f"{product.vendor_domain}:unknown"],

        # Sec-certs URL
        ["l", "seccerts_url", seccerts_url, "url"],
    ]

    # Add optional fields only if present
    if product.vendor:
        tags.append(["l", "vendor", truncate_field(product.vendor, 200), "text"])

    if product.product_name:
        tags.append(["l", "product_name", truncate_field(product.product_name, 300), "text"])

    if product.version:
        tags.append(["l", "product_version", product.version, "semver"])

    if product.category:
        tags.append(["l", "category", truncate_field(product.category, 200), "text"])

    if product.status:
        tags.append(["l", "status", product.status, "text"])

    if product.cert_link:
        tags.append(["url", product.cert_link])

    if product.report_link:
        tags.append(["url", product.report_link])

    if product.security_target_link:
        tags.append(["url", product.security_target_link])

    if product.vendor_url:
        tags.append(["url", product.vendor_url])

    if product.security_level:
        for level in product.security_level:
            tags.append(["l", "security_level", level, "text"])

    if product.scheme:
        tags.append(["l", "scheme", product.scheme, "text"])

    if product.not_valid_before:
        tags.append(["l", "not_valid_before", product.not_valid_before[:10], "date"])

    if product.not_valid_after:
        tags.append(["l", "not_valid_after", product.not_valid_after[:10], "date"])

    if product.cert_id:
        tags.append(["l", "cert_id", product.cert_id, "id"])

    if product.eal:
        tags.append(["l", "eal", product.eal, "text"])

    if product.cpe_matches:
        for cpe in product.cpe_matches:
            tags.append(["l", "cpe23", cpe, "id"])

    # Add crypto algorithms (limit to prevent oversized events)
    if product.symmetric_crypto:
        for algo in product.symmetric_crypto[:20]:
            tags.append(["l", "symmetric_crypto", algo, "algorithm"])

    if product.asymmetric_crypto:
        for algo in product.asymmetric_crypto[:20]:
            tags.append(["l", "asymmetric_crypto", algo, "algorithm"])

    if product.hash_function:
        for hash_func in product.hash_function[:10]:
            tags.append(["l", "hash_function", hash_func, "algorithm"])

    if product.cipher_mode:
        for mode in product.cipher_mode[:10]:
            tags.append(["l", "cipher_mode", mode, "mode"])

    if product.javacard_version:
        for jc_ver in product.javacard_version[:5]:
            tags.append(["l", "javacard_version", jc_ver, "version"])

    # Build event structure (unsigned)
    event = {
        "kind": 1,
        "content": content,
        "tags": tags,
        "created_at": int(time.time())
    }

    # Check event size
    event_size = len(json.dumps(event))
    if event_size > 100000:  # 100KB limit
        logger.warning(f"Event for {product.product_identifier} is large: {event_size} bytes")

    return event


# ============================================================================
# PROCESSING PIPELINE
# ============================================================================

class EventPublisher:
    """Manages event extraction and saving with resume capability"""

    def __init__(self, output_dir: str = "./scrutiny_events"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Track processing state
        self.processed_file = self.output_dir / "processed_dgsts.txt"
        self.failed_file = self.output_dir / "failed_dgsts.txt"
        self.events_file = self.output_dir / "product_events.jsonl"

        self.processed_dgsts = self._load_processed()
        self.failed_dgsts = self._load_failed()

    def _load_processed(self) -> Set[str]:
        """Load set of already processed certificate dgsts"""
        if self.processed_file.exists():
            return set(self.processed_file.read_text().splitlines())
        return set()

    def _load_failed(self) -> Set[str]:
        """Load set of failed certificate dgsts"""
        if self.failed_file.exists():
            return set(self.failed_file.read_text().splitlines())
        return set()

    def save_event(self, event: Dict, dgst: str):
        """Save event to JSONL file"""
        # Append to JSONL (one JSON per line)
        with open(self.events_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event) + '\n')

        # Mark as processed
        with open(self.processed_file, 'a', encoding='utf-8') as f:
            f.write(dgst + '\n')
        self.processed_dgsts.add(dgst)

    def mark_failed(self, dgst: str, error: str):
        """Mark certificate as failed"""
        with open(self.failed_file, 'a', encoding='utf-8') as f:
            f.write(f"{dgst}\t{error}\n")
        self.failed_dgsts.add(dgst)

    def should_process(self, dgst: str) -> bool:
        """Check if certificate should be processed"""
        return dgst not in self.processed_dgsts and dgst not in self.failed_dgsts


def process_test_set(num_certs: int = 10, output_dir: str = "./scrutiny_test", tag_profile: str = TagProfile.PRODUCTION):
    """
    Process a small test set of certificates

    Args:
        num_certs: Number of certificates to process
        output_dir: Output directory for results
        tag_profile: Tag profile to use ("production" or "test")

    Returns:
        Dictionary with processing statistics
    """

    publisher = EventPublisher(output_dir)

    stats = {
        'total': num_certs,
        'processed': 0,
        'products_created': 0,
        'skipped': 0,
        'failed': 0,
        'tag_profile': tag_profile,
        'errors': []
    }

    try:
        # Log profile being used
        logger.info(f"Using tag profile: {tag_profile.upper()}")
        tag_names = TagProfile.get_tags(tag_profile)
        logger.info(f"Tags: {tag_names}")

        # Load dataset
        logger.info("Loading CC dataset from web...")
        dset = CCDataset.from_web()
        logger.info(f"Loaded {len(dset)} total certificates")

        # Take first N certificates for testing
        test_certs = list(dset)[:num_certs]
        logger.info(f"Processing {len(test_certs)} certificates for testing")

        # Process each certificate
        for i, cert in enumerate(test_certs, 1):
            dgst = safe_extract(cert, 'dgst', 'unknown')

            logger.info(f"\n{'='*60}")
            logger.info(f"Certificate {i}/{num_certs}: {dgst}")
            logger.info(f"Name: {safe_extract(cert, 'name', 'Unknown')}")
            logger.info(f"{'='*60}")

            # Skip if already processed
            if not publisher.should_process(dgst):
                logger.info(f"Skipping {dgst} (already processed)")
                stats['skipped'] += 1
                continue

            try:
                # Extract product data (may produce multiple products)
                products = extract_product_data(cert)

                if not products:
                    logger.warning(f"No products extracted from {dgst}")
                    publisher.mark_failed(dgst, "No products extracted")
                    stats['failed'] += 1
                    continue

                logger.info(f"Extracted {len(products)} product(s) from certificate")

                # Process each product
                for j, product in enumerate(products, 1):
                    logger.info(f"  Product {j}/{len(products)}: {product.product_identifier}")
                    logger.info(f"    Version: {product.version or 'N/A'}")
                    logger.info(f"    Vendor: {product.vendor or 'N/A'}")

                    # Validate (only checks dgst)
                    errors = validate_product_data(product)
                    if errors:
                        error_msg = '; '.join(errors)
                        logger.warning(f"    ❌ Validation failed: {error_msg}")
                        publisher.mark_failed(dgst, error_msg)
                        stats['failed'] += 1
                        stats['errors'].append({
                            'dgst': dgst,
                            'product_id': product.product_identifier,
                            'errors': errors
                        })
                        continue

                    # Create event with selected tag profile
                    event = create_product_event(product, tag_profile=tag_profile)

                    # Log event details
                    event_size = len(json.dumps(event))
                    logger.info(f"    ✅ Event created")
                    logger.info(f"       d tag: {product.product_identifier}")
                    logger.info(f"       Tags: {len(event['tags'])}")
                    logger.info(f"       Size: {event_size:,} bytes")

                    # Save event
                    publisher.save_event(event, dgst)
                    stats['products_created'] += 1

                stats['processed'] += 1

            except Exception as e:
                logger.error(f"❌ Error processing {dgst}: {e}", exc_info=True)
                publisher.mark_failed(dgst, str(e))
                stats['failed'] += 1
                stats['errors'].append({
                    'dgst': dgst,
                    'error': str(e)
                })

        # Final stats
        logger.info(f"\n{'='*60}")
        logger.info("PROCESSING COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Total certificates: {stats['total']}")
        logger.info(f"Processed: {stats['processed']}")
        logger.info(f"Product events created: {stats['products_created']}")
        logger.info(f"Skipped: {stats['skipped']}")
        logger.info(f"Failed: {stats['failed']}")
        logger.info(f"Tag profile: {stats['tag_profile'].upper()}")
        logger.info(f"{'='*60}")

        # Save error report
        if stats['errors']:
            error_report = publisher.output_dir / 'error_report.json'
            with open(error_report, 'w', encoding='utf-8') as f:
                json.dump(stats['errors'], f, indent=2)
            logger.info(f"Error report saved to {error_report}")

        # Save summary
        summary_file = publisher.output_dir / 'summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=2)
        logger.info(f"Summary saved to {summary_file}")

        return stats

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    import sys

    # Interactive profile selection
    print("Starting SCRUTINY Product Event Extraction")
    print("=" * 60)
    print("\nTag Profile Selection:")
    print("  1) Production tags (default)")
    print("  2) Test tags (append _v01 to scrutiny types)")

    profile_choice = input("\nSelect profile [1]: ").strip()

    if profile_choice == "2":
        tag_profile = TagProfile.TEST
        output_dir = "./scrutiny_test_profile_test"
    else:
        tag_profile = TagProfile.PRODUCTION
        output_dir = "./scrutiny_test"

    print(f"\nUsing: {tag_profile.upper()} profile")
    print("=" * 60 + "\n")

    stats = process_test_set(num_certs=100, output_dir=output_dir, tag_profile=tag_profile)

    print("\n" + "=" * 60)
    print("Processing complete!")
    print(f"Results saved to: {output_dir}/")
    print(f"Events file: {output_dir}/product_events.jsonl")
    print(f"Tag profile: {tag_profile.upper()}")
    print("=" * 60)
