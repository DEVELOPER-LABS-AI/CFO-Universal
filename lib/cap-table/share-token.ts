import crypto from 'crypto';

const SHARE_SECRET = process.env.CAP_TABLE_SHARE_SECRET;

/**
 * Base64url encoding (URL-safe base64 without padding).
 */
function base64urlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

/**
 * Base64url decoding.
 */
function base64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/**
 * Generate a signed share token for a cap table.
 *
 * Token format: base64url(payload).base64url(signature)
 * Payload format: {orgId}:{expiryTimestamp}
 *
 * @param orgId - Organization ID to encode in the token
 * @param expiresInDays - Number of days until the token expires (default: 30)
 * @returns The signed token string
 */
export function generateShareToken(orgId: string, expiresInDays: number = 30): string {
  if (!SHARE_SECRET) {
    throw new Error('Sharing is not configured. Set CAP_TABLE_SHARE_SECRET environment variable.');
  }

  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
  const payload = `${orgId}:${expiryTimestamp}`;
  const encodedPayload = base64urlEncode(payload);

  const hmac = crypto.createHmac('sha256', SHARE_SECRET);
  const signature = hmac.update(encodedPayload).digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Validate a signed share token and return the organization ID.
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param token - The token string to validate
 * @returns Object with orgId and expiresAt
 * @throws Error if token is invalid or expired
 */
export function validateShareToken(token: string): { orgId: string; expiresAt: Date } {
  if (!SHARE_SECRET) {
    throw new Error('Sharing is not configured. Set CAP_TABLE_SHARE_SECRET environment variable.');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [encodedPayload, providedSignature] = parts;

  // Recompute signature
  const hmac = crypto.createHmac('sha256', SHARE_SECRET);
  const expectedSignature = hmac.update(encodedPayload).digest('base64url');

  // Constant-time comparison
  const sigBuffer = Buffer.from(providedSignature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid token signature');
  }

  // Decode and parse payload
  const payload = base64urlDecode(encodedPayload);
  const colonIndex = payload.lastIndexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid token payload');
  }

  const orgId = payload.substring(0, colonIndex);
  const expiryTimestamp = parseInt(payload.substring(colonIndex + 1), 10);

  if (isNaN(expiryTimestamp)) {
    throw new Error('Invalid token expiry');
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (expiryTimestamp < now) {
    throw new Error('Token has expired');
  }

  return {
    orgId,
    expiresAt: new Date(expiryTimestamp * 1000),
  };
}

/**
 * Check if the share token feature is configured.
 */
export function isShareTokenConfigured(): boolean {
  return !!SHARE_SECRET;
}
