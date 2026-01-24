import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, ChevronDown, ChevronRight, Shield, ShieldAlert, ShieldCheck, Loader2, AlertTriangle, Award, FileText, Check } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToShortNpub, pubkeyToNpub } from '@/lib/nip19';
import {
  extractURLAndHash,
  extractLabels,
  extractMultiLabels,
  getLegacyScrutinyReason,
  isDemoScrutinyEvent,
  type ScrutinyEvent,
  getDisplayEvent,
} from '@/lib/scrutiny';
import {
  verifyFileHash,
  convertToRawURL,
  type VerificationStatus,
  type VerificationResult,
} from '@/lib/hashVerification';
import {
  getSeverityStyle,
  getCertStatusStyle,
} from '@/lib/labelRegistry';
import { getCountryFlag } from '@/lib/productUtils';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { ContentWithImages } from '@/components/ContentWithImages';
import { RawEventDialog } from '@/components/RawEventDialog';
import { EventId } from '@/components/EventId';
import { ActivityEvent } from '@/components/ActivityEvent';
import { Link } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

interface MetadataCardProps {
  metadata: ScrutinyEvent;
  update?: ScrutinyEvent;
  updates?: ScrutinyEvent[]; // All updates for activity display
  confirmations: ScrutinyEvent[];
  contestations: ScrutinyEvent[];
  categorized?: Map<string, ScrutinyEvent>; // All metadata events for resolving alternatives
}

export function MetadataCard({
  metadata,
  update,
  updates = [],
  confirmations,
  contestations,
  categorized,
}: MetadataCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [showFullName, setShowFullName] = useState(false);
  const [operationOpen, setOperationOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [vulnOpen, setVulnOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [computedHash, setComputedHash] = useState<string | undefined>();
  const [verificationError, setVerificationError] = useState<string | undefined>();

  const legacyReason = getLegacyScrutinyReason(metadata.tags);
  const isDemo = isDemoScrutinyEvent(metadata.tags);

  const { display } = getDisplayEvent(metadata, update, showOriginal);

  const author = useAuthor(display.pubkey);
  const { toast } = useToast();
  const shortNpub = pubkeyToShortNpub(display.pubkey);
  const fullNpub = pubkeyToNpub(display.pubkey);
  const displayName = author.data?.metadata?.name ?? shortNpub;

  // Check if an update exists (regardless of which is being displayed)
  const hasUpdate = !!update;

  const { url, hash } = extractURLAndHash(display);
  const labels = extractLabels(display);

  const timeAgo = formatDistanceToNow(new Date(display.created_at * 1000), {
    addSuffix: true,
  });

  // Extract alternative metadata IDs from contestations
  const getAlternativeMetadata = (contestation: ScrutinyEvent): ScrutinyEvent | undefined => {
    // Get the mention tag (alternative metadata reference)
    const mentionTags = contestation.tags.filter(t => t[0] === 'e' && t[3] === 'mention');
    const alternativeId = mentionTags[0]?.[1];

    if (alternativeId && categorized) {
      return categorized.get(alternativeId);
    }
    return undefined;
  };

  // Extract all metadata tags
  const nonceTag = display.tags.find((t) => t[0] === 'nonce');
  const powDifficulty = nonceTag?.[2];
  const mime = display.tags.find((t) => t[0] === 'm')?.[1];
  const sizeStr = display.tags.find((t) => t[0] === 'size')?.[1];
  const sizeNum = sizeStr ? Number(sizeStr) : undefined;
  const altName = display.tags.find((t) => t[0] === 'alt')?.[1];

  // Labels
  const source = labels['source']?.value;
  const typeLabel = labels['type']?.value;
  const tool = labels['tool']?.value;

  // Test Metadata (JCAlgTest specific)
  const toolClientVersion = labels['tool_client_version']?.value;
  const toolAppletVersion = labels['tool_applet_version']?.value;
  const executionDate = labels['execution_date']?.value;
  const reader = labels['reader']?.value;
  const cardAtr = labels['card_atr']?.value;
  // Generate ATR parser URL from ATR value
  const atrParserUrl = cardAtr ? `https://smartcard-atr.apdu.fr/parse?ATR=${cardAtr.replace(/\s/g, '')}` : undefined;
  const cardName = labels['card_name']?.value;

  // Operation Details
  const methodName = labels['method_name']?.value;
  const algorithm = labels['algorithm']?.value;
  const operation = labels['operation']?.value;
  const keyType = labels['key_type']?.value;
  const keyLength = labels['key_length']?.value;

  // Performance Results
  const operationAvg = labels['operation_avg_ms_per_op']?.value;
  const operationMin = labels['operation_min_ms_per_op']?.value;
  const operationMax = labels['operation_max_ms_per_op']?.value;
  const baselineAvg = labels['baseline_avg_ms']?.value;
  const baselineMin = labels['baseline_min_ms']?.value;
  const baselineMax = labels['baseline_max_ms']?.value;
  const dataLength = labels['data_length']?.value;
  const totalIterations = labels['total_iterations']?.value;
  const totalInvocations = labels['total_invocations']?.value;

  // Advanced Technical Data
  const baselineMeasurements = labels['baseline_measurements_ms']?.value;
  const operationMeasurements = labels['operation_measurements_ms']?.value;
  const appletPrepareIns = labels['applet_prepare_ins']?.value;
  const appletMeasureIns = labels['applet_measure_ins']?.value;
  const config = labels['config']?.value;

  // Check if we have test metadata
  const hasTestMetadata = !!(
    toolClientVersion ||
    toolAppletVersion ||
    executionDate ||
    reader ||
    cardAtr ||
    cardName
  );

  // Check if we have operation details
  const hasOperationDetails = !!(
    methodName ||
    algorithm ||
    operation ||
    keyType ||
    keyLength
  );

  // Check if we have performance results
  const hasPerformanceResults = !!(
    operationAvg ||
    operationMin ||
    operationMax ||
    baselineAvg
  );

  // Check if we have advanced data
  const hasAdvancedData = !!(
    baselineMeasurements ||
    operationMeasurements ||
    appletPrepareIns ||
    appletMeasureIns ||
    config
  );

  // Vulnerability labels (new in v0.2)
  const cve = labels['cve']?.value;
  const cwe = labels['cwe']?.value;
  const cvssScore = labels['cvss_score']?.value;
  const cvssVector = labels['cvss_vector']?.value;
  const vulnSeverity = labels['vuln_severity']?.value;
  const exploitability = labels['exploitability']?.value;
  const kev = labels['kev']?.value;
  const epss = labels['epss']?.value;
  const vulnStatus = labels['vuln_status']?.value;
  const disclosureDate = labels['disclosure_date']?.value;
  const patchAvailable = labels['patch_available']?.value;
  const patchUrl = labels['patch_url']?.value;

  // Certification labels (new in v0.2)
  const certScheme = labels['scheme']?.value;
  const certLevels = extractMultiLabels(display, 'security_level');
  const certId = labels['cert_id']?.value;
  const certStatus = labels['cert_status']?.value;
  const certNotValidBefore = labels['not_valid_before']?.value;
  const certNotValidAfter = labels['not_valid_after']?.value;

  // Metadata classification (new in v0.2)
  const measurementCategory = labels['measurement_category']?.value;
  const measurementType = labels['measurement_type']?.value;
  const dataType = labels['data_type']?.value;
  const toolVersion = labels['tool_version']?.value;
  const measurementDate = labels['measurement_date']?.value;
  const sampleSize = labels['sample_size']?.value;
  const lab = labels['lab']?.value;
  const labAccreditation = labels['lab_accreditation']?.value;

  // Check if we have vulnerability data
  const hasVulnerability = !!(
    cve ||
    cwe ||
    cvssScore ||
    cvssVector ||
    vulnSeverity ||
    exploitability ||
    kev ||
    epss ||
    vulnStatus ||
    disclosureDate ||
    patchAvailable ||
    patchUrl
  );

  // Check if we have certification data
  const hasCertification = !!(
    certScheme ||
    certLevels.length > 0 ||
    certId ||
    certStatus ||
    certNotValidBefore ||
    certNotValidAfter
  );

  // Check if this is a vulnerability metadata
  const isVulnerabilityMetadata = hasVulnerability || measurementCategory === 'vulnerability';

  // Format CVSS score with color
  const getCvssColor = (score: string | undefined): string => {
    if (!score) return '';
    const num = parseFloat(score);
    if (num >= 9.0) return 'text-red-600 dark:text-red-400';
    if (num >= 7.0) return 'text-orange-600 dark:text-orange-400';
    if (num >= 4.0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatBytes = (n?: number) => {
    if (!n || Number.isNaN(n)) return undefined;
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
    // GB unlikely here
  };

  // Derive file info: prefer 'alt' tag; else parse from URL path; else fallback
  const getFileInfo = () => {
    if (altName) {
      const ext = altName.includes('.') ? altName.split('.').pop()?.toUpperCase() : undefined;
      return { filename: altName, ext };
    }
    if (url) {
      try {
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop() || '';
        const ext = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : undefined;
        return { filename, ext };
      } catch {
        // ignore
      }
    }
    return { filename: 'Metadata Document', ext: undefined };
  };
  const fileInfo = getFileInfo();

  const mimeLabel = (() => {
    if (!mime) return fileInfo.ext || undefined;
    const upper = mime.toUpperCase();
    if (upper === 'TEXT/HTML') return 'HTML';
    if (upper === 'APPLICATION/PDF') return 'PDF';
    if (upper === 'TEXT/CSV') return 'CSV';
    if (upper.startsWith('TEXT/')) return upper.replace('TEXT/', '');
    if (upper.startsWith('APPLICATION/')) return upper.replace('APPLICATION/', '');
    return upper;
  })();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      duration: 2000,
    });
  };

  const truncateHash = (h: string) => {
    if (h.length <= 16) return h;
    return `${h.substring(0, 12)}...`;
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

  const handleVerifyHash = async () => {
    if (!url || !hash) return;

    setVerificationStatus('verifying');
    setVerificationProgress(0);
    setVerificationError(undefined);
    setComputedHash(undefined);

    try {
      // Convert GitHub blob URLs to raw URLs for better CORS support
      const verifyUrl = convertToRawURL(url);

      const result: VerificationResult = await verifyFileHash(
        verifyUrl,
        hash,
        (progress) => setVerificationProgress(progress)
      );

      setVerificationStatus(result.status);
      setComputedHash(result.computedHash);
      setVerificationError(result.error);

      if (result.status === 'verified') {
        toast({
          title: 'Hash Verified',
          icon: <Check className="h-4 w-4 text-green-500" />,
          description: 'The file hash matches the provided hash.',
          duration: 3000,
        });
      } else if (result.status === 'mismatch') {
        toast({
          title: 'Hash Mismatch',
          icon: <AlertTriangle className="h-4 w-4" />,
          description: 'The computed hash does not match the provided hash.',
          variant: 'destructive',
          duration: 5000,
        });
      } else if (result.status === 'failed') {
        toast({
          title: 'Verification Failed',
          description: result.error || 'Could not verify the hash.',
          variant: 'destructive',
          duration: 5000,
        });
      }
    } catch (error) {
      setVerificationStatus('failed');
      setVerificationError(error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Verification Error',
        description: 'An unexpected error occurred during verification.',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const getVerificationBadge = () => {
    if (!hash) return null;

    switch (verificationStatus) {
      case 'pending':
        return (
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span>Hash Provided</span>
          </span>
        );
      case 'verifying':
        return (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
            <span>Verifying... {verificationProgress}%</span>
          </span>
        );
      case 'verified':
        return (
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-confirmation" />
            <span className="text-confirmation font-semibold">Verified</span>
          </span>
        );
      case 'mismatch':
        return (
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-destructive" />
            <span className="text-destructive font-semibold">Hash Mismatch</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-destructive" />
            <span className="text-destructive">Verification Failed</span>
          </span>
        );
      case 'unsupported':
        return (
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-muted-foreground" />
            <span>Invalid Hash Format</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      className="border-2 border-metadata h-full flex flex-col"
      data-event-id={metadata.id}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Metadata</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Vulnerability Severity Badge (v0.2) */}
            {isVulnerabilityMetadata && vulnSeverity && (
              <Badge
                variant="outline"
                className={`text-xs ${getSeverityStyle(vulnSeverity).bg} ${getSeverityStyle(vulnSeverity).text} ${getSeverityStyle(vulnSeverity).border}`}
                title={`Vulnerability: ${vulnSeverity}`}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {vulnSeverity.toUpperCase()}
              </Badge>
            )}
            {/* Certification Badge (v0.2) */}
            {hasCertification && !isVulnerabilityMetadata && (
              <Badge
                variant="outline"
                className="text-xs border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/30"
                title="Certification Metadata"
              >
                <Award className="h-3 w-3 mr-1" />
                Certification
              </Badge>
            )}
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
            <RawEventDialog event={metadata} eventType="Metadata" />
            {hasUpdate && (
              <Badge
                variant="outline"
                className="bg-update/10 text-update border-update cursor-pointer text-xs"
                onClick={() => {
                  setShowOriginal(!showOriginal);
                  // Reset verification state when toggling
                  setVerificationStatus('pending');
                  setVerificationProgress(0);
                  setComputedHash(undefined);
                  setVerificationError(undefined);
                }}
                title="Click to toggle between original and updated"
              >
                {showOriginal ? '← Updated' : 'Original →'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Title (click to expand/wrap long names) */}
        <div className="pb-2 border-b">
          <h3
            className={`text-lg font-bold text-foreground leading-tight ${
              fileInfo.filename.length > 50 ? 'cursor-pointer' : ''
            } ${
              showFullName
                ? 'whitespace-normal break-words'
                : 'truncate max-w-full'
            }`}
            title={fileInfo.filename}
            onClick={() => fileInfo.filename.length > 50 && setShowFullName((v) => !v)}
            role={fileInfo.filename.length > 50 ? 'button' : undefined}
          >
            {fileInfo.filename}
          </h3>
          {!showFullName && fileInfo.filename.length > 50 && (
            <div className="text-[11px] text-muted-foreground mt-1">
              Click the title to expand
            </div>
          )}
        </div>

        {/* URL Panel */}
        {url && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-3">
            <div className="space-y-2.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-orange-900 dark:text-orange-200 break-all hover:underline flex items-start gap-2"
              >
                <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{url}</span>
              </a>

              <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
                {getVerificationBadge()}
                {mimeLabel && (
                  <>
                    <span>•</span>
                    <span>{mimeLabel}</span>
                  </>
                )}
                {sizeNum !== undefined && (
                  <>
                    <span>•</span>
                    <span>{formatBytes(sizeNum)}</span>
                  </>
                )}
              </div>

              {hash && (
                <div className="pt-2 border-t border-orange-200 dark:border-orange-800 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">SHA-256: </span>
                      <code className="font-mono">{truncateHash(hash)}</code>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={() => copyToClipboard(hash)}
                        aria-label="Copy SHA-256"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Verify Hash Button */}
                  {verificationStatus === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyHash}
                      className="w-full text-xs h-7 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/50"
                    >
                      <Shield className="h-3 w-3 mr-1.5" />
                      Verify Hash
                    </Button>
                  )}

                  {/* Verification Result Alert */}
                  {verificationStatus === 'mismatch' && computedHash && (
                    <Alert variant="destructive" className="py-3">
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                      <AlertDescription className="text-xs flex items-start">
                        <div>
                          <div className="font-semibold mb-1">Hash Mismatch Detected</div>
                          <div className="space-y-1">
                            <div>
                              <span className="font-medium">Expected:</span>
                              <code className="block font-mono text-[10px] mt-0.5 break-all">
                                {hash}
                              </code>
                            </div>
                            <div>
                              <span className="font-medium">Computed:</span>
                              <code className="block font-mono text-[10px] mt-0.5 break-all">
                                {computedHash}
                              </code>
                            </div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {verificationStatus === 'failed' && verificationError && (
                    <Alert variant="destructive" className="py-3">
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                      <AlertDescription className="text-xs flex items-start">
                        <div>
                          <div className="font-semibold mb-1">Verification Failed</div>
                          <div>{verificationError}</div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {verificationStatus === 'verified' && (
                    <Alert className="py-2.5 border-confirmation bg-confirmation/5 [&>svg]:top-2.5">
                      <ShieldCheck className="h-4 w-4 text-confirmation flex-shrink-0" />
                      <AlertDescription className="text-xs text-confirmation">
                        <span className="font-semibold">Hash verified successfully!</span> The file content matches the provided hash.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Re-verify button for completed verifications */}
                  {(verificationStatus === 'verified' || verificationStatus === 'mismatch' || verificationStatus === 'failed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleVerifyHash}
                      className="w-full text-xs h-6"
                    >
                      Verify Again
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Labels Section */}
        {(source || typeLabel || tool) && (
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
              Labels
            </h4>
            <div className="space-y-1.5 text-sm">
              {tool && (
                <div className="grid grid-cols-[100px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Tool</span>
                  <Badge variant="outline" className="w-fit text-xs">{tool}</Badge>
                </div>
              )}
              {typeLabel && (
                <div className="grid grid-cols-[100px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Type</span>
                  <code className="text-xs font-mono">{typeLabel}</code>
                </div>
              )}
              {source && (
                <div className="grid grid-cols-[100px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Source</span>
                  <span className="text-foreground">{source}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Information Section */}
        {hasTestMetadata && (
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
              Test Information
            </h4>
            <div className="space-y-1.5 text-sm">
              {executionDate && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Execution Date</span>
                  <span className="text-foreground">{formatDate(executionDate)}</span>
                </div>
              )}
              {(toolClientVersion || toolAppletVersion) && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Tool Version</span>
                  <span className="text-foreground">
                    {toolClientVersion && `Client ${toolClientVersion}`}
                    {toolClientVersion && toolAppletVersion && ' / '}
                    {toolAppletVersion && `Applet ${toolAppletVersion}`}
                  </span>
                </div>
              )}
              {reader && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Reader</span>
                  <span className="text-foreground">{reader}</span>
                </div>
              )}
              {cardName && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Card</span>
                  <span className="text-foreground">{cardName}</span>
                </div>
              )}
              {cardAtr && (
                <div className="bg-muted rounded-md p-2.5 mt-2">
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
                      <code className="text-xs font-mono break-all">{cardAtr.replace(/\s/g, '').match(/.{1,2}/g)?.join(' ') || cardAtr}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyToClipboard(cardAtr)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Operation Details Section */}
        {hasOperationDetails && (
          <Collapsible open={operationOpen} onOpenChange={setOperationOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Operation Details
              </h4>
              {operationOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5 text-sm">
              {methodName && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Method</span>
                  <code className="text-xs font-mono break-words">{methodName}</code>
                </div>
              )}
              {algorithm && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Algorithm</span>
                  <Badge variant="outline" className="w-fit text-xs">{algorithm}</Badge>
                </div>
              )}
              {operation && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Operation</span>
                  <code className="text-xs font-mono">{operation}</code>
                </div>
              )}
              {keyType && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Key Type</span>
                  <Badge variant="outline" className="w-fit text-xs">{keyType}</Badge>
                </div>
              )}
              {keyLength && (
                <div className="grid grid-cols-[120px,1fr] gap-2">
                  <span className="text-muted-foreground font-medium">Key Length</span>
                  <Badge variant="outline" className="w-fit text-xs">{keyLength}</Badge>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Performance Results Section */}
        {hasPerformanceResults && (
          <div className="bg-muted border rounded-md p-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-2">
              <span>⚡</span>
              <span>Performance Results</span>
            </h4>

            {/* Test Context */}
            {(methodName || algorithm) && (
              <div className="mb-3 text-xs text-muted-foreground">
                {methodName && <div className="font-mono">{methodName}</div>}
                {algorithm && <div className="mt-0.5">Algorithm: <span className="font-semibold">{algorithm}</span></div>}
              </div>
            )}

            {/* Hero Metric */}
            {operationAvg && (
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-foreground">
                  {operationAvg} ms
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Average per operation
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {operationMin && (
                <div>
                  <div className="text-xs text-muted-foreground">Min</div>
                  <div className="font-semibold">{operationMin} ms</div>
                </div>
              )}
              {operationMax && (
                <div>
                  <div className="text-xs text-muted-foreground">Max</div>
                  <div className="font-semibold">{operationMax} ms</div>
                </div>
              )}
              {baselineAvg && (
                <div>
                  <div className="text-xs text-muted-foreground">Baseline Avg</div>
                  <div className="font-semibold">{baselineAvg} ms</div>
                </div>
              )}
              {totalIterations && (
                <div>
                  <div className="text-xs text-muted-foreground">Iterations</div>
                  <div className="font-semibold">{totalIterations}</div>
                </div>
              )}
            </div>

            {dataLength && (
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Data Length: <span className="font-mono">{dataLength}</span> bytes
                {totalInvocations && totalInvocations !== totalIterations && (
                  <span className="ml-3">• Invocations: {totalInvocations}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced Technical Data Section */}
        {hasAdvancedData && (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                Advanced Technical Data
              </h4>
              {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {baselineMeasurements && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="text-xs text-muted-foreground mb-1">Baseline Measurements (ms)</div>
                  <code className="text-xs font-mono break-all">{baselineMeasurements}</code>
                </div>
              )}
              {baselineMin && baselineMax && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded-md p-2">
                    <span className="text-muted-foreground">Baseline Min:</span>
                    <code className="font-mono ml-1">{baselineMin} ms</code>
                  </div>
                  <div className="bg-muted rounded-md p-2">
                    <span className="text-muted-foreground">Baseline Max:</span>
                    <code className="font-mono ml-1">{baselineMax} ms</code>
                  </div>
                </div>
              )}
              {operationMeasurements && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="text-xs text-muted-foreground mb-1">Operation Measurements (ms)</div>
                  <code className="text-xs font-mono break-all">{operationMeasurements}</code>
                </div>
              )}
              {(appletPrepareIns || appletMeasureIns) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {appletPrepareIns && (
                    <div className="bg-muted rounded-md p-2">
                      <span className="text-muted-foreground">Prepare INS:</span>
                      <code className="font-mono ml-1">{appletPrepareIns}</code>
                    </div>
                  )}
                  {appletMeasureIns && (
                    <div className="bg-muted rounded-md p-2">
                      <span className="text-muted-foreground">Measure INS:</span>
                      <code className="font-mono ml-1">{appletMeasureIns}</code>
                    </div>
                  )}
                </div>
              )}
              {config && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="text-xs text-muted-foreground mb-1">Configuration</div>
                  <code className="text-xs font-mono break-all">{config}</code>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Vulnerability Information (Collapsible) - new in v0.2 */}
        {hasVulnerability && (
          <Collapsible open={vulnOpen} onOpenChange={setVulnOpen} defaultOpen={true}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Vulnerability Information
              </h4>
              {vulnOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {/* Severity Banner */}
              {(vulnSeverity || cvssScore) && (
                <div className={`rounded-md p-2.5 flex items-center justify-between ${getSeverityStyle(vulnSeverity || 'medium').bg} ${getSeverityStyle(vulnSeverity || 'medium').border} border`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${getSeverityStyle(vulnSeverity || 'medium').text}`} />
                    <span className={`font-semibold text-sm ${getSeverityStyle(vulnSeverity || 'medium').text}`}>
                      {vulnSeverity?.toUpperCase() || 'VULNERABILITY'}
                    </span>
                  </div>
                  {cvssScore && (
                    <Badge variant="outline" className={`${getCvssColor(cvssScore)} border-current`}>
                      CVSS {cvssScore}
                    </Badge>
                  )}
                </div>
              )}

              {/* CVE/CWE */}
              <div className="grid grid-cols-[100px,1fr] gap-2 text-sm">
                {cve && (
                  <>
                    <span className="text-muted-foreground font-medium">CVE</span>
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {cve}
                    </a>
                  </>
                )}
                {cwe && (
                  <>
                    <span className="text-muted-foreground font-medium">CWE</span>
                    <a
                      href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {cwe}
                    </a>
                  </>
                )}
              </div>

              {/* CVSS Vector */}
              {cvssVector && (
                <div className="bg-muted rounded-md p-2.5">
                  <div className="text-xs text-muted-foreground mb-1">CVSS Vector</div>
                  <code className="text-xs font-mono break-all">{cvssVector}</code>
                </div>
              )}

              {/* Status/Exploitability */}
              <div className="grid grid-cols-[100px,1fr] gap-2 text-sm">
                {exploitability && (
                  <>
                    <span className="text-muted-foreground font-medium">Exploitability</span>
                    <Badge variant="outline" className={`w-fit text-xs ${
                      exploitability === 'weaponized' || exploitability === 'poc'
                        ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/30'
                        : ''
                    }`}>
                      {exploitability}
                    </Badge>
                  </>
                )}
                {vulnStatus && (
                  <>
                    <span className="text-muted-foreground font-medium">Status</span>
                    <Badge variant="outline" className="w-fit text-xs">{vulnStatus}</Badge>
                  </>
                )}
                {kev === 'true' && (
                  <>
                    <span className="text-muted-foreground font-medium">CISA KEV</span>
                    <Badge variant="destructive" className="w-fit text-xs">In KEV Catalog</Badge>
                  </>
                )}
                {epss && (
                  <>
                    <span className="text-muted-foreground font-medium">EPSS</span>
                    <span className="text-foreground">{(parseFloat(epss) * 100).toFixed(1)}%</span>
                  </>
                )}
              </div>

              {/* Dates and Patch */}
              <div className="grid grid-cols-[100px,1fr] gap-2 text-sm">
                {disclosureDate && (
                  <>
                    <span className="text-muted-foreground font-medium">Disclosed</span>
                    <span className="text-foreground">{formatDate(disclosureDate)}</span>
                  </>
                )}
                {patchAvailable && (
                  <>
                    <span className="text-muted-foreground font-medium">Patch</span>
                    <Badge variant="outline" className={`w-fit text-xs ${
                      patchAvailable === 'yes'
                        ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-300 dark:bg-green-950/30'
                        : patchAvailable === 'no'
                        ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/30'
                        : ''
                    }`}>
                      {patchAvailable === 'yes' ? 'Available' : patchAvailable === 'no' ? 'Not Available' : patchAvailable}
                    </Badge>
                  </>
                )}
                {patchUrl && (
                  <>
                    <span className="text-muted-foreground font-medium">Patch URL</span>
                    <a
                      href={patchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate"
                    >
                      {patchUrl}
                    </a>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Certification Information (Collapsible) - new in v0.2 */}
        {hasCertification && (
          <Collapsible open={certOpen} onOpenChange={setCertOpen} defaultOpen={true}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-green-600" />
                Certification
              </h4>
              {certOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {/* Certification Banner */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-md p-2.5 flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-green-600" />
                <div className="flex items-center gap-2 flex-wrap">
                  {certScheme && (
                    <span className="font-semibold">
                      {getCountryFlag(certScheme)} {certScheme}
                    </span>
                  )}
                  {certLevels.length > 0 && (
                    <>
                      {certScheme && <span className="text-muted-foreground">•</span>}
                      <div className="flex flex-wrap gap-1">
                        {certLevels.map((level, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                            {level}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Certificate Details */}
              <div className="grid grid-cols-[100px,1fr] gap-2 text-sm">
                {certId && (
                  <>
                    <span className="text-muted-foreground font-medium">Certificate ID</span>
                    <code className="text-xs font-mono">{certId}</code>
                  </>
                )}
                {certStatus && (
                  <>
                    <span className="text-muted-foreground font-medium">Status</span>
                    <Badge
                      variant="outline"
                      className={`w-fit text-xs ${getCertStatusStyle(certStatus).bg} ${getCertStatusStyle(certStatus).text}`}
                    >
                      {getCertStatusStyle(certStatus).label}
                    </Badge>
                  </>
                )}
                {certNotValidBefore && (
                  <>
                    <span className="text-muted-foreground font-medium">Valid From</span>
                    <span className="text-foreground">{formatDate(certNotValidBefore)}</span>
                  </>
                )}
                {certNotValidAfter && (
                  <>
                    <span className="text-muted-foreground font-medium">Valid Until</span>
                    <span className="text-foreground">{formatDate(certNotValidAfter)}</span>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* View External Button */}
        {url && (
          <Button asChild className="w-full bg-metadata hover:bg-metadata/90">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View External File
            </a>
          </Button>
        )}

        {/* Content */}
        {display.content && (
          <div className="text-sm border-t pt-3">
            <ContentWithImages content={display.content} maxLength={300} />
          </div>
        )}

        {/* Event ID (clickable) */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
          <span>Event ID</span>
          <EventId id={display.id} />
        </div>

        {/* Activity Section */}
        {(updates.length > 0 || confirmations.length > 0 || contestations.length > 0) && (
          <div className="mt-auto pt-3">
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="bg-muted rounded-md p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      Activity ({updates.length + confirmations.length + contestations.length} events)
                    </span>
                  </div>
                  {activityOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
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
                        key={metadata.id}
                        event={metadata}
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
                    alternativeMetadata={getAlternativeMetadata(contestation)}
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
