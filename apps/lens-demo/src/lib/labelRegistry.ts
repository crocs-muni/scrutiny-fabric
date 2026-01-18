/**
 * SCRUTINY Fabric Label Registry
 *
 * Centralized mapping for label namespaces to display names and categories.
 * Supports both legacy flat labels (e.g., "vendor") and new colon-namespaced
 * labels (e.g., "scrutiny:product:vendor") from SCRUTINY Fabric v0.2.
 */

export interface LabelDefinition {
  /** Human-readable display name */
  displayName: string;
  /** Category for grouping in UI */
  category: LabelCategory;
  /** Whether multiple values are allowed */
  multiple?: boolean;
  /** Short description for tooltips */
  description?: string;
}

export type LabelCategory =
  | 'core'
  | 'identifier'
  | 'lifecycle'
  | 'technical'
  | 'crypto'
  | 'certification'
  | 'documentation'
  | 'relationship'
  | 'vulnerability'
  | 'metadata'
  | 'test'
  | 'binding'
  | 'update'
  | 'contestation'
  | 'confirmation';

/**
 * Maps namespaced labels to their legacy flat equivalents.
 * Used for backward compatibility with older events.
 */
export const LEGACY_LABEL_ALIASES: Record<string, string> = {
  // Product labels
  'scrutiny:product:vendor': 'vendor',
  'scrutiny:product:name': 'product_name',
  'scrutiny:product:version': 'product_version',
  'scrutiny:product:category': 'category',
  'scrutiny:product:status': 'status',
  'scrutiny:product:cpe23': 'cpe23',
  'scrutiny:product:purl': 'purl',
  'scrutiny:product:release_date': 'release_date',
  'scrutiny:product:eol_date': 'eol_date',
  'scrutiny:product:support_until': 'support_until',
  'scrutiny:product:form_factor': 'form_factor',
  'scrutiny:product:chip': 'chip',
  'scrutiny:product:memory_ram': 'memory_ram',
  'scrutiny:product:memory_eeprom': 'memory_eeprom',
  'scrutiny:product:javacard_version': 'javacard_version',
  'scrutiny:product:globalplatform': 'globalplatform_version',
  'scrutiny:product:crypto_suite': 'crypto_suite',
  'scrutiny:product:key_length_max': 'key_length_max',
  'scrutiny:product:ecc_curves': 'ecc_curves',
  'scrutiny:product:hash_function': 'hash_function',
  'scrutiny:product:canonical_url': 'canonical_url',
  'scrutiny:product:datasheet_url': 'datasheet_url',
  'scrutiny:product:manual_url': 'manual_url',
  'scrutiny:product:sdk_url': 'sdk_url',
  'scrutiny:product:sbom_url': 'sbom_url',
  'scrutiny:product:supersedes': 'supersedes',
  'scrutiny:product:successor': 'successor',
  'scrutiny:product:contains': 'contains',
  'scrutiny:product:depends_on': 'depends_on',

  // Metadata labels
  'scrutiny:metadata:tool': 'tool',
  'scrutiny:metadata:tool_version': 'tool_version',
  'scrutiny:metadata:tool_vendor': 'tool_vendor',
  'scrutiny:metadata:tool_config': 'tool_config',
  'scrutiny:metadata:measurement_category': 'measurement_category',
  'scrutiny:metadata:measurement_type': 'measurement_type',
  'scrutiny:metadata:source': 'source',
  'scrutiny:metadata:methodology': 'methodology',
  'scrutiny:metadata:standard': 'standard',
  'scrutiny:metadata:test_protocol_url': 'test_protocol_url',
  'scrutiny:metadata:lab': 'lab',
  'scrutiny:metadata:lab_accreditation': 'lab_accreditation',
  'scrutiny:metadata:operator': 'operator',
  'scrutiny:metadata:sample_size': 'sample_size',
  'scrutiny:metadata:statistical_confidence': 'statistical_confidence',
  'scrutiny:metadata:p_value': 'p_value',
  'scrutiny:metadata:iterations': 'iterations',
  'scrutiny:metadata:data_type': 'data_type',
  'scrutiny:metadata:reproducible': 'reproducible',
  'scrutiny:metadata:reproduction_steps_url': 'reproduction_steps_url',
  'scrutiny:metadata:measurement_date': 'measurement_date',
  'scrutiny:metadata:analysis_date': 'analysis_date',
  'scrutiny:metadata:visualization_type': 'visualization_type',
  'scrutiny:metadata:axis_x': 'axis_x',
  'scrutiny:metadata:axis_y': 'axis_y',

  // Test labels
  'scrutiny:test:reader': 'reader',
  'scrutiny:test:atr': 'card_atr',
  'scrutiny:test:date': 'test_date',

  // Certification labels
  'scrutiny:cert:scheme': 'scheme',
  'scrutiny:cert:level': 'security_level',
  'scrutiny:cert:id': 'cert_id',
  'scrutiny:cert:status': 'cert_status',
  'scrutiny:cert:not_valid_before': 'not_valid_before',
  'scrutiny:cert:not_valid_after': 'not_valid_after',

  // Binding labels
  'scrutiny:binding:relationship': 'relationship',
  'scrutiny:binding:not_valid_before': 'binding_valid_from',
  'scrutiny:binding:not_valid_after': 'binding_valid_until',
  'scrutiny:binding:supersedes': 'binding_supersedes',
  'scrutiny:binding:limitations': 'limitations',
  'scrutiny:binding:scope': 'scope',

  // Update labels
  'scrutiny:update:change_type': 'change_type',
  'scrutiny:update:severity': 'update_severity',
  'scrutiny:update:reason': 'update_reason',
  'scrutiny:update:field_changed': 'field_changed',

  // Contestation labels
  'scrutiny:contest:dispute_type': 'dispute_type',
  'scrutiny:contest:severity': 'dispute_severity',
  'scrutiny:contest:reference': 'dispute_reference',

  // Confirmation labels
  'scrutiny:confirm:method': 'confirm_method',
  'scrutiny:confirm:replicated': 'replicated',
  'scrutiny:confirm:replication_conditions': 'replication_conditions',
  'scrutiny:confirm:deviation_percent': 'deviation_percent',
  'scrutiny:confirm:endorser_role': 'endorser_role',
  'scrutiny:confirm:endorser_credential': 'endorser_credential',

  // Vulnerability labels
  'scrutiny:vuln:cve': 'cve',
  'scrutiny:vuln:cwe': 'cwe',
  'scrutiny:vuln:cvss_score': 'cvss_score',
  'scrutiny:vuln:cvss_vector': 'cvss_vector',
  'scrutiny:vuln:severity': 'vuln_severity',
  'scrutiny:vuln:exploitability': 'exploitability',
  'scrutiny:vuln:kev': 'kev',
  'scrutiny:vuln:epss': 'epss',
  'scrutiny:vuln:status': 'vuln_status',
  'scrutiny:vuln:disclosure_date': 'disclosure_date',
  'scrutiny:vuln:patch_available': 'patch_available',
  'scrutiny:vuln:patch_url': 'patch_url',
};

/**
 * Reverse mapping from legacy names to namespaced names.
 */
export const NAMESPACED_LABEL_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_LABEL_ALIASES).map(([k, v]) => [v, k])
);

/**
 * Label definitions with display names and categories.
 * Keys are normalized (legacy flat names).
 */
export const LABEL_DEFINITIONS: Record<string, LabelDefinition> = {
  // Product - Core
  vendor: { displayName: 'Vendor', category: 'core' },
  product_name: { displayName: 'Product Name', category: 'core' },
  product_version: { displayName: 'Version', category: 'core' },
  category: { displayName: 'Category', category: 'core' },
  status: { displayName: 'Status', category: 'lifecycle' },
  card_name: { displayName: 'Card Name', category: 'core' },

  // Product - Identifiers
  cpe23: { displayName: 'CPE 2.3', category: 'identifier' },
  purl: { displayName: 'Package URL', category: 'identifier' },
  atr: { displayName: 'ATR', category: 'identifier' },

  // Product - Lifecycle
  release_date: { displayName: 'Release Date', category: 'lifecycle' },
  eol_date: { displayName: 'End of Life', category: 'lifecycle' },
  support_until: { displayName: 'Support Until', category: 'lifecycle' },

  // Product - Technical
  form_factor: { displayName: 'Form Factor', category: 'technical' },
  chip: { displayName: 'Chip', category: 'technical' },
  memory_ram: { displayName: 'RAM', category: 'technical' },
  memory_eeprom: { displayName: 'EEPROM', category: 'technical' },
  javacard_version: { displayName: 'JavaCard Version', category: 'technical' },
  globalplatform_version: { displayName: 'GlobalPlatform', category: 'technical' },

  // Product - Crypto
  crypto_suite: { displayName: 'Crypto Suite', category: 'crypto', multiple: true },
  key_length_max: { displayName: 'Max Key Length', category: 'crypto' },
  ecc_curves: { displayName: 'ECC Curves', category: 'crypto', multiple: true },
  hash_function: { displayName: 'Hash Functions', category: 'crypto', multiple: true },
  symmetric_crypto: { displayName: 'Symmetric Crypto', category: 'crypto', multiple: true },
  asymmetric_crypto: { displayName: 'Asymmetric Crypto', category: 'crypto', multiple: true },
  cipher_mode: { displayName: 'Cipher Modes', category: 'crypto', multiple: true },

  // Product - Certification
  cert_type: { displayName: 'Certification Type', category: 'certification' },
  cert_id: { displayName: 'Certificate ID', category: 'certification' },
  cert_lab: { displayName: 'Certification Lab', category: 'certification' },
  cert_status: { displayName: 'Certificate Status', category: 'certification' },
  scheme: { displayName: 'Scheme', category: 'certification' },
  eal: { displayName: 'EAL', category: 'certification' },
  security_level: { displayName: 'Security Level', category: 'certification', multiple: true },
  eval_facility: { displayName: 'Evaluation Facility', category: 'certification' },
  not_valid_before: { displayName: 'Valid From', category: 'certification' },
  not_valid_after: { displayName: 'Valid Until', category: 'certification' },

  // Product - Documentation URLs
  canonical_url: { displayName: 'Canonical URL', category: 'documentation' },
  datasheet_url: { displayName: 'Datasheet', category: 'documentation' },
  manual_url: { displayName: 'Manual', category: 'documentation' },
  sdk_url: { displayName: 'SDK', category: 'documentation' },
  sbom_url: { displayName: 'SBOM', category: 'documentation' },
  seccerts_url: { displayName: 'sec-certs Reference', category: 'documentation' },
  vendor_url: { displayName: 'Vendor URL', category: 'documentation' },

  // Product - Relationships
  supersedes: { displayName: 'Supersedes', category: 'relationship' },
  successor: { displayName: 'Successor', category: 'relationship' },
  contains: { displayName: 'Contains', category: 'relationship', multiple: true },
  depends_on: { displayName: 'Depends On', category: 'relationship', multiple: true },

  // Metadata - Classification
  tool: { displayName: 'Tool', category: 'metadata' },
  tool_version: { displayName: 'Tool Version', category: 'metadata' },
  tool_vendor: { displayName: 'Tool Vendor', category: 'metadata' },
  tool_config: { displayName: 'Configuration', category: 'metadata' },
  measurement_category: { displayName: 'Measurement Category', category: 'metadata' },
  measurement_type: { displayName: 'Measurement Type', category: 'metadata' },
  source: { displayName: 'Source', category: 'metadata' },
  data_type: { displayName: 'Data Type', category: 'metadata' },

  // Metadata - Methodology
  methodology: { displayName: 'Methodology', category: 'metadata' },
  standard: { displayName: 'Standard', category: 'metadata' },
  test_protocol_url: { displayName: 'Test Protocol', category: 'metadata' },

  // Metadata - Lab/Environment
  lab: { displayName: 'Lab', category: 'metadata' },
  lab_accreditation: { displayName: 'Lab Accreditation', category: 'metadata' },
  operator: { displayName: 'Operator', category: 'metadata' },

  // Metadata - Statistical
  sample_size: { displayName: 'Sample Size', category: 'metadata' },
  statistical_confidence: { displayName: 'Confidence', category: 'metadata' },
  p_value: { displayName: 'P-Value', category: 'metadata' },
  iterations: { displayName: 'Iterations', category: 'metadata' },

  // Metadata - Temporal
  measurement_date: { displayName: 'Measurement Date', category: 'metadata' },
  analysis_date: { displayName: 'Analysis Date', category: 'metadata' },

  // Test
  reader: { displayName: 'Card Reader', category: 'test' },
  card_atr: { displayName: 'Card ATR', category: 'test' },
  test_date: { displayName: 'Test Date', category: 'test' },

  // Vulnerability
  cve: { displayName: 'CVE', category: 'vulnerability' },
  cwe: { displayName: 'CWE', category: 'vulnerability' },
  cvss_score: { displayName: 'CVSS Score', category: 'vulnerability' },
  cvss_vector: { displayName: 'CVSS Vector', category: 'vulnerability' },
  vuln_severity: { displayName: 'Severity', category: 'vulnerability' },
  exploitability: { displayName: 'Exploitability', category: 'vulnerability' },
  kev: { displayName: 'CISA KEV', category: 'vulnerability' },
  epss: { displayName: 'EPSS Score', category: 'vulnerability' },
  vuln_status: { displayName: 'Status', category: 'vulnerability' },
  disclosure_date: { displayName: 'Disclosure Date', category: 'vulnerability' },
  patch_available: { displayName: 'Patch Available', category: 'vulnerability' },
  patch_url: { displayName: 'Patch URL', category: 'vulnerability' },

  // Binding
  relationship: { displayName: 'Relationship', category: 'binding' },
  binding_valid_from: { displayName: 'Valid From', category: 'binding' },
  binding_valid_until: { displayName: 'Valid Until', category: 'binding' },
  binding_supersedes: { displayName: 'Supersedes', category: 'binding' },
  limitations: { displayName: 'Limitations', category: 'binding' },
  scope: { displayName: 'Scope', category: 'binding' },

  // Update
  change_type: { displayName: 'Change Type', category: 'update' },
  update_severity: { displayName: 'Severity', category: 'update' },
  update_reason: { displayName: 'Reason', category: 'update' },
  field_changed: { displayName: 'Field Changed', category: 'update' },

  // Contestation
  dispute_type: { displayName: 'Dispute Type', category: 'contestation' },
  dispute_severity: { displayName: 'Severity', category: 'contestation' },
  dispute_reference: { displayName: 'Reference', category: 'contestation' },

  // Confirmation
  confirm_method: { displayName: 'Method', category: 'confirmation' },
  replicated: { displayName: 'Replicated', category: 'confirmation' },
  replication_conditions: { displayName: 'Replication Conditions', category: 'confirmation' },
  deviation_percent: { displayName: 'Deviation', category: 'confirmation' },
  endorser_role: { displayName: 'Endorser Role', category: 'confirmation' },
  endorser_credential: { displayName: 'Endorser Credential', category: 'confirmation' },
};

/**
 * Normalize a label name to its canonical (legacy) form.
 * Handles both namespaced (scrutiny:product:vendor) and legacy (vendor) formats.
 */
export function normalizeLabel(label: string): string {
  // If it's a namespaced label, convert to legacy
  if (label.startsWith('scrutiny:')) {
    return LEGACY_LABEL_ALIASES[label] || label;
  }
  return label;
}

/**
 * Get the display name for a label.
 */
export function getLabelDisplayName(label: string): string {
  const normalized = normalizeLabel(label);
  return LABEL_DEFINITIONS[normalized]?.displayName || formatLabelName(label);
}

/**
 * Get the category for a label.
 */
export function getLabelCategory(label: string): LabelCategory | undefined {
  const normalized = normalizeLabel(label);
  return LABEL_DEFINITIONS[normalized]?.category;
}

/**
 * Check if a label supports multiple values.
 */
export function isMultiValueLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return LABEL_DEFINITIONS[normalized]?.multiple ?? false;
}

/**
 * Format a raw label name for display (fallback when not in registry).
 * Converts underscores/colons to spaces and title-cases.
 */
export function formatLabelName(label: string): string {
  // Extract the last part if namespaced
  const parts = label.split(':');
  const name = parts[parts.length - 1];

  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Severity color mapping for vulnerabilities and updates.
 */
export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-950/50',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-800',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-950/50',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-800',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-950/50',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-300 dark:border-yellow-800',
  },
  low: {
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-800',
  },
  minor: {
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-700',
  },
  major: {
    bg: 'bg-orange-100 dark:bg-orange-950/50',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-800',
  },
};

/**
 * Get severity styling for a given severity level.
 */
export function getSeverityStyle(severity: string): { bg: string; text: string; border: string } {
  const normalized = severity.toLowerCase().replace(/[_-]/g, '');
  return SEVERITY_COLORS[normalized] || SEVERITY_COLORS['minor'];
}

/**
 * Binding relationship display configuration.
 */
export const BINDING_RELATIONSHIPS: Record<string, { displayName: string; icon: string; color: string }> = {
  test_of: { displayName: 'Test Result', icon: '🧪', color: 'blue' },
  vulnerability_in: { displayName: 'Vulnerability', icon: '⚠️', color: 'red' },
  patch_for: { displayName: 'Patch', icon: '🔧', color: 'orange' },
  certification_of: { displayName: 'Certification', icon: '🏆', color: 'green' },
  benchmark_of: { displayName: 'Benchmark', icon: '📊', color: 'purple' },
  audit_of: { displayName: 'Audit', icon: '🔍', color: 'indigo' },
  analysis_of: { displayName: 'Analysis', icon: '📈', color: 'cyan' },
  documentation_of: { displayName: 'Documentation', icon: '📚', color: 'gray' },
};

/**
 * Product relationship edge colors for graph visualization.
 */
export const PRODUCT_RELATIONSHIP_COLORS: Record<string, string> = {
  contains: '#9333EA',      // Purple - composition/BOM
  depends_on: '#F59E0B',    // Amber - dependency
  supersedes: '#10B981',    // Emerald - version upgrade
  successor: '#10B981',     // Emerald - version upgrade
};

/**
 * Certificate status display configuration.
 */
export const CERT_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  revoked: { bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-800 dark:text-red-300', label: 'Revoked' },
  withdrawn: { bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-800 dark:text-red-300', label: 'Withdrawn' },
  suspended: { bg: 'bg-yellow-100 dark:bg-yellow-950/50', text: 'text-yellow-800 dark:text-yellow-300', label: 'Suspended' },
  superseded: { bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-800 dark:text-blue-300', label: 'Superseded' },
  archived: { bg: 'bg-gray-100 dark:bg-gray-800/50', text: 'text-gray-700 dark:text-gray-300', label: 'Archived' },
  unknown: { bg: 'bg-gray-100 dark:bg-gray-800/50', text: 'text-gray-700 dark:text-gray-300', label: 'Unknown' },
  scope_changed: { bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-800 dark:text-blue-300', label: 'Scope Changed' },
  scope_reduced: { bg: 'bg-yellow-100 dark:bg-yellow-950/50', text: 'text-yellow-800 dark:text-yellow-300', label: 'Scope Reduced' },
  scope_extended: { bg: 'bg-green-100 dark:bg-green-950/50', text: 'text-green-800 dark:text-green-300', label: 'Scope Extended' },
};

/**
 * Get certificate status styling.
 */
export function getCertStatusStyle(status: string): { bg: string; text: string; label: string } {
  const normalized = status.toLowerCase().replace(/[_-]/g, '_');
  return CERT_STATUS_STYLES[normalized] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
}
