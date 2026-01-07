#!/usr/bin/env python3
"""
Extract ProductEvents from jcalgtest_results
"""

import os
import json
import hashlib
from typing import Dict

def compute_file_hash(filepath: str) -> str:
    """Compute SHA-256 hash of file"""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def parse_csv_data(filepath: str) -> Dict:
    """Parse the jcalgtest CSV file"""
    data = {
        'card_atr': None,
        'card_name': None,
        'cplc': {},
        'max_jc_version': None,
        'max_upload_version': None
    }

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.strip().split('\n')

        # Parse header section
        for line in lines:
            if line.startswith('Card ATR;'):
                data['card_atr'] = line.split(';')[1].strip()
            elif line.startswith('Card name;'):
                data['card_name'] = line.split(';')[1].strip()
            elif line.startswith('ICFabricator;'):
                data['cplc']['ICFabricator'] = line.split(';')[1].strip()
            elif line.startswith('ICType;'):
                data['cplc']['ICType'] = line.split(';')[1].strip()
            elif line.startswith('OperatingSystemID;'):
                data['cplc']['OperatingSystemID'] = line.split(';')[1].strip()

        # Find max JavaCard version from package support
        # Look for lines like "a0000000620101; 1; 5; javacard.framework; 3.0.4"
        jc_versions = []
        for line in lines:
            if 'javacard.framework' in line and not line.startswith('PACKAGE AID'):
                parts = line.split(';')
                if len(parts) >= 5:
                    version_part = parts[4].strip()
                    # Remove any prefix like "JC " if present
                    if version_part.startswith('JC '):
                        version_part = version_part.replace('JC ', '')
                    if version_part:
                        jc_versions.append(version_part)

        if jc_versions:
            # Sort versions and get the highest
            jc_versions.sort(key=lambda v: [int(x) for x in v.split('.')])
            data['max_jc_version'] = jc_versions[-1]

        # Find max upload capability from "JC CONVERTOR VERSION; CAP SUCCESSFULLY UPLOADED?;;"
        upload_versions = []
        in_upload_section = False
        for line in lines:
            if line.startswith('JC CONVERTOR VERSION;'):
                in_upload_section = True
                continue
            if in_upload_section:
                parts = line.split(';')
                if len(parts) >= 2:
                    version = parts[0].strip()
                    uploaded = parts[1].strip().lower()
                    if uploaded == 'yes' and version:
                        upload_versions.append(version)

        if upload_versions:
            # Sort and get highest
            upload_versions.sort(key=lambda v: [int(x) for x in v.split('.')])
            data['max_upload_version'] = upload_versions[-1]

    return data


def extract_vendor_product(card_name: str) -> tuple:
    """Extract vendor and product from card name (split on first space)"""
    parts = card_name.split(' ', 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return card_name, card_name


def create_github_url(relative_path: str) -> str:
    """Create GitHub blob URL"""
    base = "https://github.com/crocs-muni/jcalgtest_results/blob/main/"
    return base + relative_path


def create_d_tag(vendor: str, product: str, atr: str) -> str:
    """Create d tag: vendor:product-atr_short"""
    vendor_norm = vendor.lower().replace(' ', '')
    product_norm = product.lower().replace(' ', '-')
    atr_short = atr[:8].lower()

    return f"{vendor_norm}:{product_norm}-{atr_short}"


def create_product_event(filepath: str, relative_path: str, test_mode: bool = False) -> Dict:
    """Create ProductEvent from CSV file"""

    # Parse CSV data
    data = parse_csv_data(filepath)

    # Extract vendor and product
    vendor, product = extract_vendor_product(data['card_name'])

    # Create d tag
    atr = data['card_atr']
    d_tag = create_d_tag(vendor, product, atr)

    # Compute file hash
    file_hash = compute_file_hash(filepath)

    # Create GitHub URL
    github_url = create_github_url(relative_path)

    # Create ATR parser URL
    atr_parser_url = f"https://smartcard-atr.apdu.fr/parse?ATR={atr}"

    # Helper to add _v01 suffix in test mode (except for scrutiny_v01)
    def make_tag(tag_name: str) -> str:
        if test_mode and tag_name != "scrutiny_v01":
            return f"{tag_name}_v01"
        return tag_name

    # Build tags
    tags = [
        ["t", make_tag("scrutiny_fabric")],
        ["t", make_tag("scrutiny_product")],
        ["t", "scrutiny_v01"],  # Never gets suffix
        ["d", d_tag],
        ["url", github_url],
        ["x", file_hash],
        ["l", "vendor", vendor, "text"],
        ["l", "product_name", product, "text"],
        ["l", "card_name", data['card_name'], "text"],
        ["l", "atr", atr, "id"],
        ["l", "atr_parser_url", atr_parser_url, "url"]
    ]

    # Add CPLC labels if available
    if data['cplc'].get('ICFabricator'):
        tags.append(["l", "ic_fabricator", data['cplc']['ICFabricator'], "id"])
    if data['cplc'].get('ICType'):
        tags.append(["l", "ic_type", data['cplc']['ICType'], "id"])
    if data['cplc'].get('OperatingSystemID'):
        tags.append(["l", "os_id", data['cplc']['OperatingSystemID'], "id"])

    # Add version labels
    if data['max_jc_version']:
        tags.append(["l", "max_javacard_version", data['max_jc_version'], "semver"])
    if data['max_upload_version']:
        tags.append(["l", "max_upload_jc_version", data['max_upload_version'], "semver"])

    # Build content (hashtags at the end)
    content_lines = [
        f"Product: {data['card_name']}",
        f"Vendor: {vendor}",
        f"ATR: {atr}",
        "",
        f"JavaCard Support: Up to {data['max_jc_version'] or 'N/A'}",
        f"Upload Capability: Up to {data['max_upload_version'] or 'N/A'}",
        "",
        f"Source: {github_url}",
        f"ATR Parser: {atr_parser_url}",
        "",
        f"#{make_tag('scrutiny_fabric')} #{make_tag('scrutiny_product')} #scrutiny_v01"
    ]

    content = "\n".join(content_lines)

    # Return unsigned event
    return {
        "kind": 1,
        "tags": tags,
        "content": content
    }


def main():
    """Extract all ProductEvents from jcalgtest_results"""

    print("=" * 60)
    print("SCRUTINY ProductEvent Extraction Tool")
    print("=" * 60)

    base_dir = input("\nPath to jcalgtest_results/javacard/Profiles/aid/: ").strip()
    output_file = input("Output JSONL file: ").strip()

    # Ask for tag profile
    tag_profile = input("Tag profile: 1) Production tags  2) Test tags (append _v01 to all types) [1]: ").strip()
    test_mode = (tag_profile == "2")

    if test_mode:
        print("\n⚠️  Test mode enabled - all type tags (except scrutiny_v01) will have _v01 suffix")

    events = []
    processed = 0
    failed = 0

    print(f"\n{'=' * 60}")
    print("Processing files...")
    print(f"{'=' * 60}\n")

    # Get all CSV files with AIDSUPPORT pattern
    csv_files = [f for f in os.listdir(base_dir) if f.endswith('.csv') and '_AIDSUPPORT_' in f]

    for filename in sorted(csv_files):
        filepath = os.path.join(base_dir, filename)
        relative_path = f"javacard/Profiles/aid/{filename}"

        try:
            event = create_product_event(filepath, relative_path, test_mode)
            events.append(event)
            processed += 1

            # Show shortened filename for display
            display_name = filename if len(filename) <= 60 else filename[:57] + "..."
            print(f"✓ [{processed:3d}] {display_name}")

        except Exception as e:
            failed += 1
            print(f"✗ Failed {filename}: {e}")

    # Write to JSONL
    with open(output_file, 'w', encoding='utf-8') as f:
        for event in events:
            f.write(json.dumps(event, ensure_ascii=False) + '\n')

    print(f"\n{'=' * 60}")
    print(f"✓ Successfully extracted {processed} events to {output_file}")
    if failed > 0:
        print(f"✗ Failed to process {failed} files")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
