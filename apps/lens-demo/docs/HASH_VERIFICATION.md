# Hash Verification Feature

## Overview

The Scrutiny Lens Demo now includes **client-side hash verification** for metadata files. This feature allows users to verify that external files referenced in metadata events match their claimed SHA-256 hashes.

## How It Works

### 1. Hash Display States

When a metadata event includes a hash (`x` tag), the card displays one of several verification states:

- **🛡️ Hash Provided** (Default) - A hash is present but not yet verified
- **⏳ Verifying... X%** - Verification in progress with progress indicator
- **✅ Verified** - Hash matches the file content
- **⚠️ Hash Mismatch** - Computed hash differs from provided hash
- **❌ Verification Failed** - Could not fetch or verify the file
- **⚠️ Invalid Hash Format** - The hash format is invalid

### 2. User Flow

1. User views a metadata card with a URL and hash
2. User clicks the "Verify Hash" button
3. The app fetches the file from the URL
4. The app computes the SHA-256 hash of the file content
5. The app compares the computed hash with the provided hash
6. The result is displayed with appropriate styling and alerts

### 3. Implementation Details

#### Hash Computation

```typescript
import { verifyFileHash } from '@/lib/hashVerification';

const result = await verifyFileHash(
  url,
  expectedHash,
  (progress) => console.log(`Progress: ${progress}%`)
);

if (result.status === 'verified') {
  // Hash matches!
} else if (result.status === 'mismatch') {
  // Hash doesn't match
  console.log('Expected:', expectedHash);
  console.log('Computed:', result.computedHash);
}
```

#### CORS Handling

The verification process requires fetching files from external URLs, which can be blocked by CORS policies. The implementation includes:

1. **Automatic URL Conversion**: GitHub blob URLs are automatically converted to raw URLs for better CORS support
   ```
   https://github.com/owner/repo/blob/main/file.csv
   → https://raw.githubusercontent.com/owner/repo/main/file.csv
   ```

2. **CORS Detection**: The app checks if a URL is likely to support CORS before verification

3. **Error Handling**: Clear error messages are shown when CORS blocks the request

#### Progress Tracking

For large files, the verification shows real-time progress:
- Downloads file in chunks using streaming
- Reports progress as percentage (0-100%)
- Uses Web Crypto API for efficient hashing

### 4. Security Considerations

#### What This Feature Provides

✅ **Client-side verification**: Users can verify file integrity without trusting the Nostr event author
✅ **Tamper detection**: Detects if a file has been modified since the hash was created
✅ **Transparency**: Shows both expected and computed hashes when there's a mismatch

#### What This Feature Does NOT Provide

❌ **Authenticity guarantee**: Hash verification only proves the file hasn't changed, not that it's the correct/safe file
❌ **Malware protection**: A matching hash doesn't mean the file is safe
❌ **CORS bypass**: Cannot verify files from servers that don't allow cross-origin requests

### 5. Example Event with Hash

```json
{
  "kind": 1,
  "tags": [
    ["t", "#scrutiny_metadata_v01"],
    ["url", "https://raw.githubusercontent.com/owner/repo/main/test-results.csv"],
    ["x", "0855f3246fe76e797e23c303fd315fee0075fbcdf7afbd31289466908ec9f88c"],
    ["m", "text/csv"],
    ["size", "1024000"]
  ],
  "content": "Test results for OpenSSL 3.0.0"
}
```

### 6. Testing Hash Verification

#### To Test with a Valid Hash

1. Find a publicly accessible file on GitHub or a CDN
2. Compute its SHA-256 hash locally:
   ```bash
   # Linux/Mac
   sha256sum file.csv
   
   # Windows PowerShell
   Get-FileHash file.csv -Algorithm SHA256
   ```
3. Create a metadata event with the correct hash
4. Click "Verify Hash" - should show "✅ Verified"

#### To Test with an Invalid Hash

1. Use the same file but provide an incorrect hash (change one character)
2. Click "Verify Hash" - should show "⚠️ Hash Mismatch"
3. The alert will display both the expected and computed hashes

#### To Test CORS Errors

1. Use a URL from a server that doesn't allow CORS (e.g., many corporate websites)
2. Click "Verify Hash" - should show "❌ Verification Failed" with CORS error message

### 7. Technical Stack

- **Fetch API**: Streaming file download
- **Web Crypto API**: SHA-256 computation (`crypto.subtle.digest`)
- **React State**: Managing verification status and progress
- **shadcn/ui**: Alert components for displaying results
- **Lucide Icons**: Shield icons for verification states

### 8. Performance Considerations

- **Streaming**: Files are processed in chunks to handle large files efficiently
- **Progress Updates**: UI updates every chunk to show progress
- **Memory Usage**: Files are not loaded entirely into memory at once
- **Cancellation**: Future improvement could add abort functionality for long downloads

### 9. Future Enhancements

Potential improvements for the hash verification feature:

1. **Abort Controller**: Allow users to cancel long-running verifications
2. **Multiple Hash Algorithms**: Support SHA-512, BLAKE3, etc.
3. **Batch Verification**: Verify multiple metadata files at once
4. **Caching**: Remember verification results to avoid re-downloading
5. **Background Verification**: Automatically verify hashes on page load
6. **IPFS Support**: Special handling for IPFS URLs
7. **Proxy Support**: Allow verification through a CORS proxy service

## API Reference

### `verifyFileHash(url, expectedHash, onProgress?)`

Verifies that a file's hash matches the expected hash.

**Parameters:**
- `url: string` - URL of the file to verify
- `expectedHash: string` - Expected SHA-256 hash (64 hex characters)
- `onProgress?: (progress: number) => void` - Optional progress callback (0-100)

**Returns:** `Promise<VerificationResult>`
```typescript
interface VerificationResult {
  status: 'pending' | 'verifying' | 'verified' | 'failed' | 'mismatch' | 'unsupported';
  computedHash?: string;
  error?: string;
}
```

### `convertToRawURL(url)`

Converts GitHub blob URLs to raw URLs for better CORS support.

**Parameters:**
- `url: string` - Original URL

**Returns:** `string` - Converted URL (or original if not a GitHub blob URL)

### `isLikelyCORSSupported(url)`

Heuristic check for whether a URL is likely to support CORS.

**Parameters:**
- `url: string` - URL to check

**Returns:** `boolean` - True if CORS is likely supported

## User Guide

### How to Verify a File Hash

1. **Find a Metadata Card** with a URL and hash icon
2. **Click "Verify Hash"** button in the hash section
3. **Wait for verification** - Progress will be shown
4. **Review the result**:
   - ✅ **Green "Verified"** - File is authentic and unchanged
   - ⚠️ **Red "Hash Mismatch"** - File has been modified or hash is incorrect
   - ❌ **Red "Verification Failed"** - Could not access the file (CORS, network error, etc.)

### Understanding Verification Results

#### ✅ Verified
The file at the URL matches the provided hash. This means:
- The file content is exactly as claimed
- The file has not been tampered with since the hash was created
- You can trust the file's integrity

#### ⚠️ Hash Mismatch
The computed hash does not match the provided hash. This could mean:
- The file has been modified since the event was created
- The author provided an incorrect hash (intentionally or by mistake)
- There was a corruption during download

**What to do:** Compare the expected and computed hashes shown in the alert. If they differ, do not trust the file.

#### ❌ Verification Failed
Could not verify the hash. Common reasons:
- **CORS Error**: The server doesn't allow cross-origin requests
- **Network Error**: File could not be downloaded
- **Invalid URL**: The URL is malformed or inaccessible

**What to do:** Try downloading the file manually and computing its hash locally.

### Computing Hash Locally

If verification fails due to CORS or you want to verify independently:

**Windows (PowerShell):**
```powershell
Get-FileHash -Path "C:\path\to\file.csv" -Algorithm SHA256
```

**Linux/Mac:**
```bash
sha256sum /path/to/file.csv
```

**Online Tools:**
- Be cautious with sensitive files
- Use reputable hash calculators
- Never upload confidential data

Compare the locally computed hash with the hash shown in the metadata event.

---

**Last Updated:** October 25, 2025
