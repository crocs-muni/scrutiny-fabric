import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

interface ContentWithImagesProps {
  content: string;
  className?: string;
  maxLength?: number;
}

export function ContentWithImages({ content, className = '', maxLength }: ContentWithImagesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Extract image URLs from content - improved regex to handle more formats
  const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|heic|avif)(?:\?[^\s]*)?)/gi;
  const imageUrls = content.match(imageUrlRegex) || [];

  const shouldTruncate = maxLength && content.length > maxLength;
  const displayContent = shouldTruncate && !isExpanded 
    ? content.substring(0, maxLength) + '...'
    : content;

  // Parse content to linkify URLs and Nostr references
  const parsedContent = useMemo(() => {
    const text = displayContent;
    
    // Regex to find URLs and Nostr references
    const regex = /(https?:\/\/[^\s]+)|nostr:(npub1|note1|nevent1|nprofile1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)/g;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;
    
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, url, nostrPrefix, nostrData] = match;
      const index = match.index;
      
      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      
      if (url) {
        // Handle regular URLs (excluding image URLs)
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|heic|avif)(\?[^\s]*)?$/i.test(url);
        if (!isImage) {
          parts.push(
            <a 
              key={`url-${keyCounter++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {url}
            </a>
          );
        } else {
          parts.push(url);
        }
      } else if (nostrPrefix && nostrData) {
        // Handle Nostr references
        try {
          const nostrId = `${nostrPrefix}${nostrData}`;
          // Validate by attempting to decode
          nip19.decode(nostrId);
          
          parts.push(
            <Link 
              key={`nostr-${keyCounter++}`}
              to={`/${nostrId}`}
              className="text-primary hover:underline break-all"
            >
              {fullMatch}
            </Link>
          );
        } catch {
          // If decoding fails, just render as text
          parts.push(fullMatch);
        }
      }
      
      lastIndex = index + fullMatch.length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      return text;
    }
    
    return parts;
  }, [displayContent]);

  return (
    <div className={className}>
      <div className="whitespace-pre-wrap break-words">{parsedContent}</div>
      {shouldTruncate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 h-7 text-xs"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </Button>
      )}
      {imageUrls.length > 0 && (
        <div className="mt-3 space-y-2">
          {imageUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={url}
                alt={`Content image ${idx + 1}`}
                className="max-w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
