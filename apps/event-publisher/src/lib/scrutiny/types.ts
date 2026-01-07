// src/lib/scrutiny/types.ts
// Core types for SCRUTINY protocol events

export type EventType =
  | 'product'
  | 'metadata'
  | 'binding'
  | 'update'
  | 'contestation'
  | 'confirmation';

/**
 * Product lifecycle status values per SCRUTINY spec
 */
export type ProductStatus = 'active' | 'archived' | 'eol' | 'deprecated';

/**
 * Form values for creating a ProductEvent
 * Maps to SCRUTINY Protocol Event Specification v0.2 - Section 2
 */
export interface ProductEventFormValues {
  // Mode
  isTestMode: boolean;

  // Core Identity (Essential)
  vendor: string;
  name: string;
  version?: string;
  category?: string;
  status?: ProductStatus;

  // Lifecycle
  releaseDate?: string; // ISO 8601: YYYY-MM-DD
  eolDate?: string; // ISO 8601: YYYY-MM-DD
  supportUntil?: string; // ISO 8601: YYYY-MM-DD

  // Identifiers & Discovery
  cpe23?: string; // Common Platform Enumeration 2.3
  purl?: string; // Package URL

  // Platform & Specs
  formFactor?: string; // smartcard, hsm, tpm, usb_token, etc.
  chip?: string; // Processor/chip model
  memoryRam?: string; // RAM in bytes (string for form input)
  memoryEeprom?: string; // EEPROM in bytes
  javacardVersion?: string;
  globalplatform?: string;

  // Crypto Capabilities (multiple values allowed)
  cryptoSuites: string[]; // AES, RSA, ECC, etc.
  keyLengthMax?: string; // Maximum key size in bits
  eccCurves: string[]; // P-256, P-384, etc.
  hashFunctions: string[]; // SHA-256, SHA-3, etc.

  // Documentation & URLs
  canonicalUrl?: string; // Official product page
  datasheetUrl?: string;
  manualUrl?: string;
  sdkUrl?: string;
  sbomUrl?: string; // Software Bill of Materials

  // Certification
  certScheme?: string; // e.g., Common Criteria
  certLevels: string[]; // e.g., EAL4+
  certId?: string; // Certificate ID

  // Relationships (event IDs)
  supersedes?: string; // Event ID of older product
  successor?: string; // Event ID of newer product
  compatibleWith: string[]; // Compatible product event IDs

  // Content override (if empty, auto-generate from fields)
  contentOverride?: string;
}

/**
 * Default/initial values for ProductEventFormValues
 */
export function createEmptyProductFormValues(): ProductEventFormValues {
  return {
    isTestMode: false,
    vendor: '',
    name: '',
    version: '',
    category: '',
    status: undefined,
    releaseDate: '',
    eolDate: '',
    supportUntil: '',
    cpe23: '',
    purl: '',
    formFactor: '',
    chip: '',
    memoryRam: '',
    memoryEeprom: '',
    javacardVersion: '',
    globalplatform: '',
    cryptoSuites: [],
    keyLengthMax: '',
    eccCurves: [],
    hashFunctions: [],
    canonicalUrl: '',
    datasheetUrl: '',
    manualUrl: '',
    sdkUrl: '',
    sbomUrl: '',
    certScheme: '',
    certLevels: [],
    certId: '',
    supersedes: '',
    successor: '',
    compatibleWith: [],
    contentOverride: '',
  };
}
