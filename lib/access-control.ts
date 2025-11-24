import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Type guard to check if applications data contains NO_ACCESS marker
 * @param data - Applications data to check
 * @returns true if NO_ACCESS marker is present
 */
export function isNoAccess<T>(data: T[] | 'NO_ACCESS'): data is 'NO_ACCESS' {
  return data === 'NO_ACCESS';
}

/**
 * Get safe redirect URL from referer header or fallback to dashboard
 * @param referer - Referer header value
 * @returns Safe redirect URL
 */
export function getSafeRedirectUrl(referer: string | null): string {
  // Validate referer is internal URL
  const isValid = isValidInternalUrl(referer);
  return isValid ? referer! : '/dashboard';
}

/**
 * Validate if URL is a safe internal redirect
 * @param url - URL to validate
 * @returns true if URL is safe for internal redirect
 */
function isValidInternalUrl(url: string | null): boolean {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    
    // For development, allow localhost redirects
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = parsed.hostname === 'localhost';
    
    // For production, check against configured domain
    const currentDomain = process.env.NEXT_PUBLIC_SITE_URL?.replace('https://', '') || 'localhost:3000';
    const isCurrentDomain = parsed.hostname === currentDomain.split(':')[0];
    
    // Only allow same origin redirects
    return (isDevelopment && isLocalhost) || isCurrentDomain;
  } catch {
    return false;
  }
}

/**
 * Handle NO_ACCESS redirect in server components
 * @param data - Data from any scope-based function that can return 'NO_ACCESS'
 */
export async function handleNoAccess(data: any[] | 'NO_ACCESS'): Promise<void> {
  if (isNoAccess(data)) {
    const headersList = await headers();
    const referer = headersList.get('x-referer') || headersList.get('referer');
    const redirectUrl = getSafeRedirectUrl(referer);
    redirect(redirectUrl);
  }
}