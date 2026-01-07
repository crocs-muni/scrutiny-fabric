const FLAG_MAP: Record<string, string> = {
  AE: '🇦🇪',
  AU: '🇦🇺',
  BE: '🇧🇪',
  CA: '🇨🇦',
  CN: '🇨🇳',
  DE: '🇩🇪',
  DK: '🇩🇰',
  ES: '🇪🇸',
  EU: '🇪🇺',
  FI: '🇫🇮',
  FR: '🇫🇷',
  GB: '🇬🇧',
  HK: '🇭🇰',
  IE: '🇮🇪',
  IN: '🇮🇳',
  IT: '🇮🇹',
  JP: '🇯🇵',
  KR: '🇰🇷',
  MY: '🇲🇾',
  NL: '🇳🇱',
  NO: '🇳🇴',
  PL: '🇵🇱',
  SE: '🇸🇪',
  SG: '🇸🇬',
  TR: '🇹🇷',
  US: '🇺🇸',
};

/**
 * Map a country/scheme code to an emoji flag. Falls back to a globe icon when unknown.
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode) {
    return '🌐';
  }
  const normalized = countryCode.trim().toUpperCase();
  return FLAG_MAP[normalized] ?? '🌐';
}

/**
 * Validates CPE 2.3 format.
 * Format: cpe:2.3:part:vendor:product:version:update:edition:lang:sw_ed:target_sw:target_hw:other
 */
export function validateCPE23(cpe: string): boolean {
  const pattern = /^cpe:2\.3:[aho*-](:([a-zA-Z0-9._~%-]*|\*)){10}$/;
  return pattern.test(cpe);
}
