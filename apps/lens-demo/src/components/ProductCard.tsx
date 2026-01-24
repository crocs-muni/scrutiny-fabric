import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronRight, AlertCircle, ExternalLink, Box, Package } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToShortNpub, pubkeyToNpub, eventIdToNote } from '@/lib/nip19';
import {
  extractLabels,
  extractMultiLabels,
  extractDTag,
  getDisplayEvent,
  getLegacyScrutinyReason,
  isDemoScrutinyEvent,
  validatePURL,
  extractProductRelationships,
  type ScrutinyEvent,
} from '@/lib/scrutiny';
import {
  getLabelDisplayName,
  getSeverityStyle,
  PRODUCT_RELATIONSHIP_COLORS,
  normalizeLabel,
} from '@/lib/labelRegistry';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { RawEventDialog } from '@/components/RawEventDialog';
import { EventId } from '@/components/EventId';
import { ActivityEvent } from '@/components/ActivityEvent';
import { RelationshipActivity } from '@/components/RelationshipActivity';
import { ContentWithImages } from '@/components/ContentWithImages';
import { getCountryFlag, validateCPE23 } from '@/lib/productUtils';
import { Link } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProductCardProps {
  product: ScrutinyEvent;
  update?: ScrutinyEvent;
  updates?: ScrutinyEvent[]; // All updates for activity display
  confirmations: ScrutinyEvent[];
  contestations: ScrutinyEvent[];
  /** Map of all products for resolving relationship links */
  allProducts?: Map<string, ScrutinyEvent>;
}

export function ProductCard({
  product,
  update,
  updates = [],
  confirmations,
  contestations,
  allProducts,
}: ProductCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [showAllSecurityLevels, setShowAllSecurityLevels] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [relationshipsOpen, setRelationshipsOpen] = useState(true);

  const legacyReason = getLegacyScrutinyReason(product.tags);
  const isDemo = isDemoScrutinyEvent(product.tags);

  const { display } = getDisplayEvent(product, update, showOriginal);

  const author = useAuthor(display.pubkey);
  const { toast } = useToast();
  const shortNpub = pubkeyToShortNpub(display.pubkey);
  const fullNpub = pubkeyToNpub(display.pubkey);
  const displayName = author.data?.metadata?.name ?? shortNpub;

  const labels = extractLabels(display);
  const dTag = extractDTag(display);

  // Check if an update exists (regardless of which is being displayed)
  const hasUpdate = !!update;

  // Extract all URLs (url tag and l tags with URL namespaces)
  const primaryUrl = display.tags.find(t => t[0] === 'url')?.[1];
  // Legacy: l tags with type="url" in position 3
  // v0.2: l tags with URL namespaces (canonical_url, datasheet_url, etc.)
  const urlLabels = [
    'canonical_url', 'datasheet_url', 'manual_url', 'sdk_url', 'sbom_url',
    'test_protocol_url', 'reproduction_steps_url', 'patch_url',
  ];
  const labelUrls: Array<{ name: string; url: string }> = [];
  for (const tag of display.tags) {
    if (tag[0] !== 'l') continue;
    const [, value, namespace, type] = tag;
    // Legacy format: type === 'url'
    if (type === 'url' && value !== 'atr_parser_url') {
      labelUrls.push({ name: value, url: namespace });
    }
    // v0.2 format: namespace ends with _url
    const normalizedNs = namespace ? normalizeLabel(namespace) : '';
    if (urlLabels.includes(normalizedNs) && value) {
      labelUrls.push({ name: normalizedNs.replace(/_url$/, '').replace(/_/g, ' '), url: value });
    }
  }

  // Get hash for URL verification
  const urlHash = display.tags.find(t => t[0] === 'x')?.[1];

  const timeAgo = formatDistanceToNow(new Date(display.created_at * 1000), {
    addSuffix: true,
  });

  // PoW badge
  const nonceTag = display.tags.find(t => t[0] === 'nonce');
  const powDifficulty = nonceTag?.[2];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      duration: 2000,
    });
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getUrlDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  // Get product details
  const vendor = labels['vendor']?.value;
  const productName = labels['product_name']?.value;
  const version = labels['product_version']?.value;
  const category = labels['category']?.value;
  const status = labels['status']?.value;
  const cardName = labels['card_name']?.value;

  // Identifiers
  const cpe23 = labels['cpe23']?.value;
  const purl = labels['purl']?.value;
  const atr = labels['atr']?.value;
  // Generate ATR parser URL from ATR value
  const atrParserUrl = atr ? `https://smartcard-atr.apdu.fr/parse?ATR=${atr.replace(/\s/g, '')}` : undefined;

  const cpe23Valid = cpe23 ? validateCPE23(cpe23) : true;
  const purlValid = purl ? validatePURL(purl) : true;

  // Certification
  const certType = labels['cert_type']?.value;
  const certId = labels['cert_id']?.value;
  const certLab = labels['cert_lab']?.value;
  const scheme = labels['scheme']?.value;
  const eal = labels['eal']?.value;
  const evalFacility = labels['eval_facility']?.value;

  // Get all security_level entries (there can be multiple)
  const securityLevels = extractMultiLabels(display, 'security_level');

  // Remove duplicate if eal is already shown separately
  const filteredSecurityLevels = eal
    ? securityLevels.filter(level => level !== eal)
    : securityLevels;

  const notValidBefore = labels['not_valid_before']?.value;
  const notValidAfter = labels['not_valid_after']?.value;

  // Technical - Get all entries for fields that can have multiple values
  const symmetricCryptoList = extractMultiLabels(display, 'symmetric_crypto');
  const asymmetricCryptoList = extractMultiLabels(display, 'asymmetric_crypto');
  const hashFunctions = extractMultiLabels(display, 'hash_function');
  const cipherModes = extractMultiLabels(display, 'cipher_mode');

  const javaCardVersion = labels['javacard_version']?.value;
  const globalPlatformVersion = labels['globalplatform_version']?.value;
  const cryptoEngine = labels['crypto_engine']?.value;
  const maxJCVersion = labels['max_javacard_version']?.value;
  const maxUploadJCVersion = labels['max_upload_jc_version']?.value;

  // Security Analysis
  const sideChannelAnalysis = extractMultiLabels(display, 'side_channel_analysis');

  // Lifecycle labels (new in v0.2)
  const releaseDate = labels['release_date']?.value;
  const eolDate = labels['eol_date']?.value;
  const supportUntil = labels['support_until']?.value;

  // Technical - new in v0.2
  const formFactor = labels['form_factor']?.value;
  const chip = labels['chip']?.value;
  const memoryRam = labels['memory_ram']?.value;
  const memoryEeprom = labels['memory_eeprom']?.value;

  // Crypto - new in v0.2 (using extractMultiLabels for proper multi-value support)
  const cryptoSuites = extractMultiLabels(display, 'crypto_suite');
  const eccCurves = extractMultiLabels(display, 'ecc_curves');
  const keyLengthMax = labels['key_length_max']?.value;

  // Product relationships (new in v0.2)
  const productRelationships = extractProductRelationships(display);
  const hasRelationships = productRelationships.contains.length > 0 ||
    productRelationships.dependsOn.length > 0 ||
    productRelationships.supersedes ||
    productRelationships.successor;

  // Helper to get product display name from event ID
  const getRelatedProductName = (eventId: string): string => {
    if (!allProducts) return eventId.substring(0, 8) + '...';
    const relatedProduct = allProducts.get(eventId);
    if (!relatedProduct) return eventId.substring(0, 8) + '...';
    const relLabels = extractLabels(relatedProduct);
    const relVendor = relLabels['vendor']?.value;
    const relName = relLabels['product_name']?.value;
    const relVersion = relLabels['product_version']?.value;
    if (relVendor && relName) {
      return relVersion ? `${relVendor} ${relName} ${relVersion}` : `${relVendor} ${relName}`;
    }
    return relName || relVendor || eventId.substring(0, 8) + '...';
  };

  const hasCert = !!(certType || certId || certLab || scheme || eal || securityLevels.length > 0 || notValidBefore || notValidAfter || evalFacility);
  const hasLifecycle = !!(releaseDate || eolDate || supportUntil);
  const hasTech = !!(
    symmetricCryptoList.length > 0 ||
    asymmetricCryptoList.length > 0 ||
    hashFunctions.length > 0 ||
    cipherModes.length > 0 ||
    cryptoSuites.length > 0 ||
    eccCurves.length > 0 ||
    keyLengthMax ||
    javaCardVersion ||
    globalPlatformVersion ||
    cryptoEngine ||
    maxJCVersion ||
    maxUploadJCVersion ||
    formFactor ||
    chip ||
    memoryRam ||
    memoryEeprom
  );
  const hasSecurity = sideChannelAnalysis.length > 0;

  // Format memory size in human-readable format
  const formatMemory = (bytes: string | undefined): string | undefined => {
    if (!bytes) return undefined;
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return bytes;
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusClasses = (() => {
    const s = (status || '').toLowerCase();
    if (s.includes('active')) return 'bg-green-100 text-green-800 border-green-300';
    if (s.includes('archiv') || s.includes('historic')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (s.includes('revoked')) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-muted text-foreground border-muted';
  })();

  return (
    <Card className="border-2 border-product h-full flex flex-col" data-event-id={product.id}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <span className="text-base">📦</span>
            <span>Product</span>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge
                variant="outline"
                className="text-xs border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:bg-purple-950/30"
                title="Demo event with _demo suffix tags"
              >
                Demo
              </Badge>
            )}
            {legacyReason && (
              <Badge
                variant="outline"
                className="text-xs border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30"
                title={
                  legacyReason === 'hyphenated-tags'
                    ? 'Legacy SCRUTINY event (hyphenated/v0 tags)'
                    : `Legacy SCRUTINY event (${legacyReason})`
                }
              >
                Legacy
                {legacyReason !== 'hyphenated-tags' ? ` (${legacyReason})` : ''}
              </Badge>
            )}
            {powDifficulty && (
              <Badge
                variant="outline"
                className="text-xs border-green-400 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/30"
                title="Proof of Work"
              >
                PoW {powDifficulty}
              </Badge>
            )}
            <RawEventDialog event={product} eventType="Product" />
            {hasUpdate && (
              <Badge
                variant="outline"
                className="bg-update/10 text-update border-update cursor-pointer text-xs"
                onClick={() => setShowOriginal(!showOriginal)}
                title="Click to toggle between original and updated"
              >
                {showOriginal ? '← Updated' : 'Original →'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Hero Section */}
        <div className="pb-4 border-b">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-xl font-bold text-foreground leading-tight">
              {productName || 'Unknown Product'}
            </h3>
          </div>
          {vendor && (
            <p className="text-sm font-medium text-muted-foreground">{vendor}</p>
          )}
          {version && (
            <p className="text-sm text-muted-foreground mt-1">
              Version: <code className="font-mono text-xs">{version}</code>
            </p>
          )}

          {/* Certification Banner */}
          {hasCert && (certType || eal || filteredSecurityLevels.length > 0) && (
            <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-2.5 flex items-center gap-2 text-xs">
              <span className="text-base">🏆</span>
              <div className="flex items-center gap-2 flex-wrap">
                {certType && <span className="font-semibold">{certType}</span>}
                {eal && (
                  <>
                    {certType && <span>•</span>}
                    <span>{eal}</span>
                  </>
                )}
                {filteredSecurityLevels.length > 0 && (
                  <>
                    {(certType || eal) && <span>•</span>}
                    {showAllSecurityLevels ? (
                      // Show all unique security levels
                      <div className="flex flex-wrap items-center gap-1">
                        {[...new Set(filteredSecurityLevels)].map((level, idx) => (
                          <span key={idx}>{level}</span>
                        ))}
                        {filteredSecurityLevels.length > 1 && (
                          <button
                            onClick={() => setShowAllSecurityLevels(false)}
                            className="text-muted-foreground hover:text-foreground underline ml-1"
                          >
                            show less
                          </button>
                        )}
                      </div>
                    ) : (
                      // Show first level with "+more" if there are duplicates
                      <>
                        <span>{filteredSecurityLevels[0]}</span>
                        {filteredSecurityLevels.length > 1 && (
                          <button
                            onClick={() => setShowAllSecurityLevels(true)}
                            className="text-muted-foreground hover:text-foreground underline"
                          >
                            +{[...new Set(filteredSecurityLevels)].length - 1} more
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Core Information */}
        <div>
          <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
            Core Information
          </h4>
          <div className="space-y-1.5 text-sm">
            {vendor && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Vendor</span>
                <span className="text-foreground">{vendor}</span>
              </div>
            )}
            {productName && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Product Name</span>
                <span className="text-foreground">{productName}</span>
              </div>
            )}
            {version && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Version</span>
                <code className="text-foreground font-mono text-xs">{version}</code>
              </div>
            )}
            {category && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Category</span>
                <span className="text-foreground">{category}</span>
              </div>
            )}
            {status && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Status</span>
                <Badge variant="outline" className={`w-fit text-xs ${statusClasses}`}>{status}</Badge>
              </div>
            )}
            {cardName && (
              <div className="grid grid-cols-[120px,1fr] gap-2">
                <span className="text-muted-foreground font-medium">Card Name</span>
                <span className="text-foreground">{cardName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Identifiers */}
        {(dTag || cpe23 || purl || atr || atrParserUrl) && (
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
              Identifiers
            </h4>
            <div className="space-y-2">
              {dTag && (
                <div className="bg-muted rounded-md p-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-0.5">Stable ID</div>
                    <code className="text-xs font-mono break-all">{dTag}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => copyToClipboard(dTag)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {cpe23 && (
                <div className="bg-muted rounded-md p-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      CPE 2.3
                      {!cpe23Valid && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-sm">
                                <AlertCircle className="h-3 w-3 text-white" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Incorrect CPE 2.3 format</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <code className="text-xs font-mono break-all">{cpe23}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => copyToClipboard(cpe23)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {purl && (
                <div className="bg-muted rounded-md p-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      Package URL
                      {!purlValid && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-sm">
                                <AlertCircle className="h-3 w-3 text-white" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Incorrect PURL format</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <code className="text-xs font-mono break-all">{purl}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => copyToClipboard(purl)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {atr && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        ATR{' '}
                        {atrParserUrl && (
                          <a
                            href={atrParserUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            (parsed)
                          </a>
                        )}
                      </div>
                      <code className="text-xs font-mono break-all">{atr.match(/.{1,2}/g)?.join(' ') || atr}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyToClipboard(atr)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Links */}
        {(primaryUrl || labelUrls.length > 0) && (
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
              Links
            </h4>
            <div className="space-y-2">
              {primaryUrl && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Canonical URL
                    {urlHash && <span className="text-confirmation">✓ Verified</span>}
                  </div>
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {getUrlDomain(primaryUrl)}
                  </a>
                </div>
              )}
              {labelUrls.map((urlData, idx) => {
                // Map label names to display names
                const displayName = urlData.name === 'seccerts_url'
                  ? 'Reference from sec-certs'
                  : urlData.name === 'vendor_url'
                  ? 'Vendor URL'
                  : urlData.name;

                // Get domain for link text
                const linkText = urlData.name === 'seccerts_url'
                  ? 'sec-certs.org'
                  : getUrlDomain(urlData.url);

                return (
                  <div key={idx} className="bg-muted rounded-md p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">{displayName}</div>
                    <a
                      href={urlData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline break-all flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {linkText}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certification Details (Collapsible) */}
        {hasCert && (
          <Collapsible open={certOpen} onOpenChange={setCertOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Certification Details
              </h4>
              {certOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5 text-sm">
              {certType && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Type</span>
                  <span className="text-foreground">{certType}</span>
                </div>
              )}
              {certId && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Certificate ID</span>
                  <code className="text-xs">{certId}</code>
                </div>
              )}
              {certLab && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Certification Lab</span>
                  <span className="text-foreground">{certLab}</span>
                </div>
              )}
              {scheme && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Scheme</span>
                  <span className="text-foreground">
                    {getCountryFlag(scheme) && `${getCountryFlag(scheme)} `}
                    {scheme}
                  </span>
                </div>
              )}
              {evalFacility && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Eval. Facility</span>
                  <span className="text-foreground">{evalFacility}</span>
                </div>
              )}
              {eal && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">EAL</span>
                  <Badge variant="outline" className="w-fit">{eal}</Badge>
                </div>
              )}
              {securityLevels.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Security Level</span>
                  <div className="flex flex-wrap gap-1">
                    {securityLevels.map((level, idx) => (
                      <Badge key={idx} variant="outline" className="w-fit text-xs">
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {notValidBefore && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Valid From</span>
                  <span className="text-foreground">{formatDate(notValidBefore)}</span>
                </div>
              )}
              {notValidAfter && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Valid Until</span>
                  <span className="text-foreground">{formatDate(notValidAfter)}</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Technical Specifications (Collapsible) */}
        {hasTech && (
          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Technical Specifications
              </h4>
              {techOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5 text-sm">
              {/* Hardware */}
              {formFactor && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Form Factor</span>
                  <span className="text-foreground capitalize">{formFactor}</span>
                </div>
              )}
              {chip && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Chip</span>
                  <span className="text-foreground">{chip}</span>
                </div>
              )}
              {memoryRam && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">RAM</span>
                  <span className="text-foreground">{formatMemory(memoryRam)}</span>
                </div>
              )}
              {memoryEeprom && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">EEPROM</span>
                  <span className="text-foreground">{formatMemory(memoryEeprom)}</span>
                </div>
              )}
              {/* Cryptography */}
              {cryptoSuites.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Crypto Suite</span>
                  <div className="flex flex-wrap gap-1">
                    {cryptoSuites.map((suite, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {suite}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {symmetricCryptoList.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Symmetric</span>
                  <div className="flex flex-wrap gap-1">
                    {symmetricCryptoList.map((algo, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {algo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {asymmetricCryptoList.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Asymmetric</span>
                  <div className="flex flex-wrap gap-1">
                    {asymmetricCryptoList.map((algo, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {algo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {hashFunctions.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Hash Functions</span>
                  <div className="flex flex-wrap gap-1">
                    {hashFunctions.map((hash, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {hash}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {cipherModes.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Cipher Modes</span>
                  <div className="flex flex-wrap gap-1">
                    {cipherModes.map((mode, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {mode}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {eccCurves.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">ECC Curves</span>
                  <div className="flex flex-wrap gap-1">
                    {eccCurves.map((curve, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {curve}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {keyLengthMax && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Max Key Length</span>
                  <span className="text-foreground">{keyLengthMax} bits</span>
                </div>
              )}
              {/* Platform */}
              {javaCardVersion && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">JavaCard</span>
                  <code className="text-xs font-mono">{javaCardVersion}</code>
                </div>
              )}
              {globalPlatformVersion && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">GlobalPlatform</span>
                  <code className="text-xs font-mono">{globalPlatformVersion}</code>
                </div>
              )}
              {cryptoEngine && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Crypto Engine</span>
                  <span className="text-foreground">{cryptoEngine}</span>
                </div>
              )}
              {maxJCVersion && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Max JavaCard</span>
                  <code className="text-xs font-mono">{maxJCVersion}</code>
                </div>
              )}
              {maxUploadJCVersion && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Max Upload JC</span>
                  <code className="text-xs font-mono">{maxUploadJCVersion}</code>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Lifecycle (Collapsible) - new in v0.2 */}
        {hasLifecycle && (
          <Collapsible open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Lifecycle
              </h4>
              {lifecycleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5 text-sm">
              {releaseDate && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Release Date</span>
                  <span className="text-foreground">{formatDate(releaseDate)}</span>
                </div>
              )}
              {eolDate && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">End of Life</span>
                  <span className="text-foreground">{formatDate(eolDate)}</span>
                </div>
              )}
              {supportUntil && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Support Until</span>
                  <span className="text-foreground">{formatDate(supportUntil)}</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Product Relationships (Collapsible) - new in v0.2 */}
        {hasRelationships && (
          <Collapsible open={relationshipsOpen} onOpenChange={setRelationshipsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Product Relationships
              </h4>
              {relationshipsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2 text-sm">
              {productRelationships.contains.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground font-medium text-xs">
                    <Package className="h-3 w-3" style={{ color: PRODUCT_RELATIONSHIP_COLORS.contains }} />
                    <span>Contains</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-4">
                    {productRelationships.contains.map((containedId) => (
                      <Link
                        key={containedId}
                        to={`/${eventIdToNote(containedId)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <Box className="h-3 w-3" />
                        {getRelatedProductName(containedId)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {productRelationships.dependsOn.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground font-medium text-xs">
                    <Package className="h-3 w-3" style={{ color: PRODUCT_RELATIONSHIP_COLORS.depends_on }} />
                    <span>Depends On</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-4">
                    {productRelationships.dependsOn.map((depId) => (
                      <Link
                        key={depId}
                        to={`/${eventIdToNote(depId)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                      >
                        <Box className="h-3 w-3" />
                        {getRelatedProductName(depId)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {productRelationships.supersedes && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground font-medium text-xs">
                    <Package className="h-3 w-3" style={{ color: PRODUCT_RELATIONSHIP_COLORS.supersedes }} />
                    <span>Supersedes</span>
                  </div>
                  <div className="pl-4">
                    <Link
                      to={`/${eventIdToNote(productRelationships.supersedes)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      <Box className="h-3 w-3" />
                      {getRelatedProductName(productRelationships.supersedes)}
                    </Link>
                  </div>
                </div>
              )}
              {productRelationships.successor && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground font-medium text-xs">
                    <Package className="h-3 w-3" style={{ color: PRODUCT_RELATIONSHIP_COLORS.successor }} />
                    <span>Successor</span>
                  </div>
                  <div className="pl-4">
                    <Link
                      to={`/${eventIdToNote(productRelationships.successor)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      <Box className="h-3 w-3" />
                      {getRelatedProductName(productRelationships.successor)}
                    </Link>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Security Analysis (Collapsible) */}
        {hasSecurity && (
          <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Security Analysis
              </h4>
              {securityOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5 text-sm">
              {sideChannelAnalysis.length > 0 && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Side-Channel Tests</span>
                  <div className="flex flex-wrap gap-1">
                    {sideChannelAnalysis.map((vuln, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs"
                      >
                        {vuln}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Content */}
        {display.content && (
          <div className="border-t pt-3">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
              Description
            </h4>
            <ContentWithImages content={display.content} maxLength={300} />
          </div>
        )}

        {/* Event ID (clickable) */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
          <span>Event ID</span>
          <EventId id={display.id} />
        </div>

        {/* Activity Footer */}
        {(updates.length > 0 || confirmations.length > 0 || contestations.length > 0 || hasRelationships) && (
          <div className="mt-auto pt-3">
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="bg-muted rounded-md p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      Activity ({updates.length + confirmations.length + contestations.length +
                        productRelationships.contains.length + productRelationships.dependsOn.length +
                        (productRelationships.supersedes ? 1 : 0) + (productRelationships.successor ? 1 : 0)} items)
                    </span>
                  </div>
                  {activityOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {/* Show relationships first */}
                {productRelationships.contains.map(containedId => (
                  <RelationshipActivity
                    key={`contains-${containedId}`}
                    relationshipType="contains"
                    relatedEventId={containedId}
                    relatedProduct={allProducts?.get(containedId)}
                  />
                ))}
                {productRelationships.dependsOn.map(depId => (
                  <RelationshipActivity
                    key={`depends-${depId}`}
                    relationshipType="depends_on"
                    relatedEventId={depId}
                    relatedProduct={allProducts?.get(depId)}
                  />
                ))}
                {productRelationships.supersedes && (
                  <RelationshipActivity
                    relationshipType="supersedes"
                    relatedEventId={productRelationships.supersedes}
                    relatedProduct={allProducts?.get(productRelationships.supersedes)}
                  />
                )}
                {productRelationships.successor && (
                  <RelationshipActivity
                    relationshipType="successor"
                    relatedEventId={productRelationships.successor}
                    relatedProduct={allProducts?.get(productRelationships.successor)}
                  />
                )}
                {/* Show updates */}
                {showOriginal ? (
                  // When viewing original, show all updates
                  updates.map(updateEvent => (
                    <ActivityEvent
                      key={updateEvent.id}
                      event={updateEvent}
                      type="update"
                    />
                  ))
                ) : (
                  // When viewing latest update, show other updates and original
                  <>
                    {updates.filter(u => u.id !== display.id).map(updateEvent => (
                      <ActivityEvent
                        key={updateEvent.id}
                        event={updateEvent}
                        type="update"
                      />
                    ))}
                    {update && (
                      <ActivityEvent
                        key={product.id}
                        event={product}
                        type="original"
                      />
                    )}
                  </>
                )}
                {confirmations.map(confirmation => (
                  <ActivityEvent
                    key={confirmation.id}
                    event={confirmation}
                    type="confirmation"
                  />
                ))}
                {contestations.map(contestation => (
                  <ActivityEvent
                    key={contestation.id}
                    event={contestation}
                    type="contestation"
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t text-xs text-muted-foreground mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span>By </span>
              <Link
                to={`/${fullNpub}`}
                className="hover:underline text-primary"
              >
                {displayName}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                asChild
              >
                <a
                  href={`https://njump.me/${fullNpub}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open profile on njump.me"
                  title="Open profile on njump.me"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <span>{timeAgo}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
