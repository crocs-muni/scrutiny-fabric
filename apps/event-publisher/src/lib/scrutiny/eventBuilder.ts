// src/lib/scrutiny/eventBuilder.ts
// Pure functions that turn validated form data into Nostr event objects

import type { EventTemplate } from 'nostr-tools';
import type { ProductEventFormValues } from './types';
import { SCRUTINY_HASHTAGS, LABEL_NAMESPACES } from './constants';

/**
 * Helper to add a NIP-32 label pair (L + l tags)
 * Only adds if value is non-empty
 */
function addLabel(tags: string[][], namespace: string, value?: string): void {
  if (!value || value.trim() === '') return;
  tags.push(['L', namespace]);
  tags.push(['l', value, namespace]);
}

/**
 * Helper to add multiple NIP-32 labels for the same namespace
 * Only adds L tag if there are non-empty values
 */
function addLabels(tags: string[][], namespace: string, values: string[]): void {
  const nonEmptyValues = values.filter((v) => v && v.trim() !== '');
  if (nonEmptyValues.length === 0) return;
  tags.push(['L', namespace]);
  for (const value of nonEmptyValues) {
    tags.push(['l', value, namespace]);
  }
}

/**
 * Generate auto-content for ProductEvent based on form fields
 * Exported so UI can show preview
 */
export function generateProductContent(form: ProductEventFormValues, opts?: { isTest?: boolean }): string {
  const isTest = opts?.isTest ?? form.isTestMode ?? false;
  const lines: (string | undefined)[] = [
    `${isTest ? '🔧 TEST – ' : ''}[Product] SCRUTINY Product – ${form.name}`,
    '',
    `Manufacturer: ${form.vendor}`,
  ];

  if (form.version) {
    lines.push(`Version: ${form.version}`);
  }
  if (form.category) {
    lines.push(`Category: ${form.category}`);
  }
  if (form.status) {
    const statusLabels: Record<string, string> = {
      active: 'Active',
      archived: 'Archived',
      eol: 'End of Life',
      deprecated: 'Deprecated',
    };
    lines.push(`Status: ${statusLabels[form.status] || form.status}`);
  }
  if (form.formFactor) {
    lines.push(`Form Factor: ${form.formFactor}`);
  }
  if (form.cryptoSuites.length > 0) {
    lines.push(`Crypto: ${form.cryptoSuites.join(', ')}`);
  }
  if (form.certScheme && form.certLevels.length > 0) {
    lines.push(`Certification: ${form.certScheme} ${form.certLevels.join(', ')}`);
  }

  lines.push('');
  lines.push(
    isTest
      ? '#scrutiny_fabric_test #scrutiny_product_test #scrutiny_v02_test'
      : '#scrutiny_fabric #scrutiny_product #scrutiny_v02'
  );

  return lines.filter((line) => line !== undefined).join('\n');
}

/**
 * Build an unsigned ProductEvent template from validated form values
 *
 * @param form - Validated ProductEventFormValues
 * @param createdAt - Unix timestamp in seconds
 * @returns EventTemplate ready for signing (pubkey will be added during signing)
 */
export function buildProductEvent(
  form: ProductEventFormValues,
  createdAt: number,
  opts?: { isTest?: boolean }
): EventTemplate {
  const isTest = opts?.isTest ?? form.isTestMode ?? false;
  const content = form.contentOverride?.trim() || generateProductContent(form, { isTest });

  const tags: string[][] = [];

  // Required t-tags (hashtags)
  const ns = isTest ? `${SCRUTINY_HASHTAGS.NAMESPACE}_test` : SCRUTINY_HASHTAGS.NAMESPACE;
  const product = isTest ? `${SCRUTINY_HASHTAGS.PRODUCT}_test` : SCRUTINY_HASHTAGS.PRODUCT;
  const version = isTest ? `${SCRUTINY_HASHTAGS.VERSION}_test` : SCRUTINY_HASHTAGS.VERSION;
  tags.push(['t', ns]);
  tags.push(['t', product]);
  tags.push(['t', version]);

  // Core Identity labels (Required)
  addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:vendor`, form.vendor);
  addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:name`, form.name);

  // Optional Core Identity labels
  if (form.version) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:version`, form.version);
  }
  if (form.category) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:category`, form.category.toLowerCase());
  }
  if (form.status) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:status`, form.status);
  }

  // Lifecycle labels
  if (form.releaseDate) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:release_date`, form.releaseDate);
  }
  if (form.eolDate) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:eol_date`, form.eolDate);
  }
  if (form.supportUntil) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:support_until`, form.supportUntil);
  }

  // Identifiers
  if (form.cpe23) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:cpe23`, form.cpe23);
  }
  if (form.purl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:purl`, form.purl);
  }

  // Platform & Specs
  if (form.formFactor) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:form_factor`, form.formFactor.toLowerCase());
  }
  if (form.chip) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:chip`, form.chip);
  }
  if (form.memoryRam) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:memory_ram`, form.memoryRam);
  }
  if (form.memoryEeprom) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:memory_eeprom`, form.memoryEeprom);
  }
  if (form.javacardVersion) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:javacard_version`, form.javacardVersion);
  }
  if (form.globalplatform) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:globalplatform`, form.globalplatform);
  }

  // Crypto Capabilities (multiple values)
  if (form.cryptoSuites.length > 0) {
    addLabels(tags, `${LABEL_NAMESPACES.PRODUCT}:crypto_suite`, form.cryptoSuites);
  }
  if (form.keyLengthMax) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:key_length_max`, form.keyLengthMax);
  }
  if (form.eccCurves.length > 0) {
    addLabels(tags, `${LABEL_NAMESPACES.PRODUCT}:ecc_curve`, form.eccCurves);
  }
  if (form.hashFunctions.length > 0) {
    addLabels(tags, `${LABEL_NAMESPACES.PRODUCT}:hash_function`, form.hashFunctions);
  }

  // Documentation & URLs
  if (form.canonicalUrl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:canonical_url`, form.canonicalUrl);
  }
  if (form.datasheetUrl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:datasheet_url`, form.datasheetUrl);
  }
  if (form.manualUrl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:manual_url`, form.manualUrl);
  }
  if (form.sdkUrl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:sdk_url`, form.sdkUrl);
  }
  if (form.sbomUrl) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:sbom_url`, form.sbomUrl);
  }

  // Certification
  if (form.certScheme) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:cert_scheme`, form.certScheme);
  }
  if (form.certLevels.length > 0) {
    addLabels(tags, `${LABEL_NAMESPACES.PRODUCT}:cert_level`, form.certLevels);
  }
  if (form.certId) {
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:cert_id`, form.certId);
  }

  // Relationships (event IDs)
  if (form.supersedes) {
    tags.push(['e', form.supersedes, '', 'mention']);
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:supersedes`, form.supersedes);
  }
  if (form.successor) {
    tags.push(['e', form.successor, '', 'mention']);
    addLabel(tags, `${LABEL_NAMESPACES.PRODUCT}:successor`, form.successor);
  }
  if (form.compatibleWith.length > 0) {
    addLabels(tags, `${LABEL_NAMESPACES.PRODUCT}:compatible_with`, form.compatibleWith);
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: createdAt,
    content,
    tags,
  };

  return template;
}
