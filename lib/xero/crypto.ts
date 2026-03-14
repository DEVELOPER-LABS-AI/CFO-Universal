/**
 * Token Encryption/Decryption Utilities
 *
 * Uses Web Crypto API (AES-256-GCM) for encrypting OAuth tokens before database storage.
 * Encryption key is stored in XERO_TOKEN_ENCRYPTION_KEY environment variable.
 */

/**
 * Get the encryption key from environment variable
 * Format: base64:KEY_IN_BASE64
 */
function getEncryptionKey(): Buffer {
  const key = process.env.XERO_TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('XERO_TOKEN_ENCRYPTION_KEY environment variable is not set');
  }

  // Remove 'base64:' prefix if present
  const base64Key = key.startsWith('base64:') ? key.substring(7) : key;

  return Buffer.from(base64Key, 'base64');
}

/**
 * Encrypt a token using AES-256-GCM
 *
 * @param plainToken - The plain text token to encrypt
 * @returns Encrypted token in format: iv:encryptedData:authTag (hex encoded)
 */
export async function encryptToken(plainToken: string): Promise<string> {
  try {
    const crypto = await import('crypto');

    // Get encryption key
    const key = getEncryptionKey();

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the token
    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return format: iv:encryptedData:authTag (all hex encoded)
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token using AES-256-GCM
 *
 * @param encryptedToken - The encrypted token in format: iv:encryptedData:authTag
 * @returns Decrypted plain text token
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    const crypto = await import('crypto');

    // Get encryption key
    const key = getEncryptionKey();

    // Parse encrypted token format: iv:encryptedData:authTag
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the token
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Verify encryption/decryption roundtrip
 * Used for testing purposes
 */
export async function testEncryption(): Promise<boolean> {
  const testToken = 'test-token-' + Date.now();

  try {
    const encrypted = await encryptToken(testToken);
    const decrypted = await decryptToken(encrypted);

    return testToken === decrypted;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
