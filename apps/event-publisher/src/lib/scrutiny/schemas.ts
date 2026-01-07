// src/lib/scrutiny/schemas.ts
// Zod validation schemas for SCRUTINY event forms

import { z } from 'zod';

/**
 * ISO 8601 date format: YYYY-MM-DD
 * Optional field that allows empty string
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .optional()
  .or(z.literal(''));

/**
 * Optional URL field with validation
 * Allows empty string for optional fields
 */
const urlOptional = z
  .string()
  .url('Must be a valid URL')
  .optional()
  .or(z.literal(''));

/**
 * Positive integer as string (for form inputs like memory, key length)
 * Allows empty string for optional fields
 */
const positiveIntString = z
  .string()
  .regex(/^\d+$/, 'Must be a positive integer')
  .optional()
  .or(z.literal(''));

/**
 * 64-character hex string for Nostr event IDs
 * Allows empty string for optional fields
 */
const eventIdOptional = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'Must be a valid 64-character hex event ID')
  .optional()
  .or(z.literal(''));

/**
 * Zod schema for ProductEventFormValues
 * Validates all fields per SCRUTINY Protocol Event Specification v0.2
 */
export const productEventFormSchema = z
  .object({
    // Mode
    isTestMode: z.boolean().default(false),

    // Core Identity (Essential)
    vendor: z.string().min(1, 'Vendor is required'),
    name: z.string().min(1, 'Product name is required'),
    version: z.string().optional().or(z.literal('')),
    category: z.string().optional().or(z.literal('')),
    status: z
      .enum(['active', 'archived', 'eol', 'deprecated'])
      .optional(),

    // Lifecycle
    releaseDate: isoDate,
    eolDate: isoDate,
    supportUntil: isoDate,

    // Identifiers & Discovery
    cpe23: z
      .string()
      .regex(
        /^cpe:2\.3:[aho\*\-]:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*$/,
        'Must be a valid CPE 2.3 format'
      )
      .optional()
      .or(z.literal('')),
    purl: z
      .string()
      .regex(/^pkg:[a-z]+\//, 'Must be a valid Package URL (purl)')
      .optional()
      .or(z.literal('')),

    // Platform & Specs
    formFactor: z.string().optional().or(z.literal('')),
    chip: z.string().optional().or(z.literal('')),
    memoryRam: positiveIntString,
    memoryEeprom: positiveIntString,
    javacardVersion: z.string().optional().or(z.literal('')),
    globalplatform: z.string().optional().or(z.literal('')),

    // Crypto Capabilities
    cryptoSuites: z.array(z.string()),
    keyLengthMax: positiveIntString,
    eccCurves: z.array(z.string()),
    hashFunctions: z.array(z.string()),

    // Documentation & URLs
    canonicalUrl: urlOptional,
    datasheetUrl: urlOptional,
    manualUrl: urlOptional,
    sdkUrl: urlOptional,
    sbomUrl: urlOptional,

    // Certification
    certScheme: z.string().optional().or(z.literal('')),
    certLevels: z.array(z.string()),
    certId: z.string().optional().or(z.literal('')),

    // Relationships
    supersedes: eventIdOptional,
    successor: eventIdOptional,
    compatibleWith: z.array(z.string()),

    // Content override
    contentOverride: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // Cross-field validation: eolDate must be >= releaseDate
    if (data.releaseDate && data.eolDate) {
      if (data.eolDate < data.releaseDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['eolDate'],
          message: 'EOL date must be on or after release date',
        });
      }
    }

    // Cross-field validation: supportUntil must be >= releaseDate
    if (data.releaseDate && data.supportUntil) {
      if (data.supportUntil < data.releaseDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['supportUntil'],
          message: 'Support end date must be on or after release date',
        });
      }
    }

    // If certId is provided, certScheme should also be provided
    if (data.certId && !data.certScheme) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certScheme'],
        message: 'Certification scheme is required when certificate ID is provided',
      });
    }
  });

// Type inference from schema
export type ProductEventFormSchema = z.infer<typeof productEventFormSchema>;
