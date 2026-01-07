// src/lib/scrutiny/constants.ts
// Constants and enums for SCRUTINY Fabric protocol

import { Package } from 'lucide-svelte';
import type { ComponentType } from 'svelte';

/**
 * Required hashtags for all SCRUTINY Fabric events
 */
export const SCRUTINY_HASHTAGS = {
  NAMESPACE: 'scrutiny_fabric',
  VERSION: 'scrutiny_v02',
  PRODUCT: 'scrutiny_product',
  METADATA: 'scrutiny_metadata',
  BINDING: 'scrutiny_binding',
  UPDATE: 'scrutiny_update',
  CONTESTATION: 'scrutiny_contestation',
  CONFIRMATION: 'scrutiny_confirmation',
} as const;

/**
 * NIP-32 label namespace prefixes
 */
export const LABEL_NAMESPACES = {
  PRODUCT: 'scrutiny:product',
  METADATA: 'scrutiny:metadata',
  BINDING: 'scrutiny:binding',
  UPDATE: 'scrutiny:update',
  VULN: 'scrutiny:vuln',
  TEST: 'scrutiny:test',
  CERT: 'scrutiny:cert',
} as const;

/**
 * Product status values
 */
export const PRODUCT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'eol', label: 'End of Life' },
  { value: 'deprecated', label: 'Deprecated' },
] as const;

/**
 * Common form factor values for products
 */
export const FORM_FACTOR_OPTIONS = [
  { value: 'smartcard', label: 'Smart Card' },
  { value: 'hsm', label: 'Hardware Security Module (HSM)' },
  { value: 'tpm', label: 'Trusted Platform Module (TPM)' },
  { value: 'usb_token', label: 'USB Token' },
  { value: 'software', label: 'Software' },
  { value: 'library', label: 'Library' },
  { value: 'firmware', label: 'Firmware' },
] as const;

/**
 * Common cryptographic algorithm suites
 */
export const CRYPTO_SUITE_OPTIONS = [
  'AES',
  'RSA',
  'ECC',
  'DES',
  '3DES',
  'ChaCha20',
  'Poly1305',
  'ECDSA',
  'EdDSA',
  'ECDH',
  'DH',
] as const;

/**
 * Common ECC curve options
 */
export const ECC_CURVE_OPTIONS = [
  'P-256',
  'P-384',
  'P-521',
  'secp256k1',
  'Curve25519',
  'Ed25519',
  'Ed448',
] as const;

/**
 * Common hash function options
 */
export const HASH_FUNCTION_OPTIONS = [
  'SHA-1',
  'SHA-256',
  'SHA-384',
  'SHA-512',
  'SHA-3',
  'SHA3-256',
  'SHA3-512',
  'BLAKE2b',
  'BLAKE3',
  'MD5',
] as const;

/**
 * Common certification schemes
 */
export const CERT_SCHEME_OPTIONS = [
  { value: 'common_criteria', label: 'Common Criteria' },
  { value: 'fips140', label: 'FIPS 140' },
  { value: 'pci_pts', label: 'PCI PTS' },
  { value: 'nist', label: 'NIST' },
  { value: 'bsi', label: 'BSI (German Federal Office for Information Security)' },
] as const;

/**
 * Common Criteria EAL levels
 */
export const COMMON_CRITERIA_LEVELS = [
  'EAL1',
  'EAL2',
  'EAL3',
  'EAL4',
  'EAL4+',
  'EAL5',
  'EAL5+',
  'EAL6',
  'EAL6+',
  'EAL7',
] as const;

/**
 * Default relay URLs
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
] as const;

/**
 * Event type display configuration
 */
export const EVENT_TYPE_CONFIG = {
  product: {
    label: 'Product',
    icon: Package as ComponentType,
    color: 'var(--product)',
    description: 'Immutable anchor representing a specific product release or version',
  },
  metadata: {
    label: 'Metadata',
    icon: '📄',
    color: 'var(--metadata)',
    description: 'Pointer to external security-relevant data with integrity verification',
  },
  binding: {
    label: 'Binding',
    icon: '🔗',
    color: 'var(--binding)',
    description: 'Links products to metadata events with semantic relationships',
  },
  update: {
    label: 'Update',
    icon: '✏️',
    color: 'var(--update)',
    description: 'Auditable updates to existing events via reply pattern',
  },
  contestation: {
    label: 'Contestation',
    icon: '⚠️',
    color: 'var(--contestation)',
    description: 'Formal dispute of metadata accuracy with evidence',
  },
  confirmation: {
    label: 'Confirmation',
    icon: '✅',
    color: 'var(--confirmation)',
    description: 'Endorsement or verification of existing events',
  },
} as const;
