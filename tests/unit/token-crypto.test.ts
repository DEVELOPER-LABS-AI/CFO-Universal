/**
 * Token Encryption/Decryption Tests
 */

import { encryptToken, decryptToken, testEncryption } from '../../lib/xero/crypto';

describe('Token Encryption', () => {
  const testToken = 'xoxb-test-access-token-123456789';

  beforeAll(() => {
    // Ensure environment variable is set for tests
    if (!process.env.XERO_TOKEN_ENCRYPTION_KEY) {
      process.env.XERO_TOKEN_ENCRYPTION_KEY = 'base64:' + Buffer.from('test-encryption-key-32-bytes!!').toString('base64');
    }
  });

  test('should encrypt a token', async () => {
    const encrypted = await encryptToken(testToken);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(testToken);
    expect(encrypted).toContain(':'); // Should contain IV:data:authTag format
    expect(encrypted.split(':').length).toBe(3);
  });

  test('should decrypt a token', async () => {
    const encrypted = await encryptToken(testToken);
    const decrypted = await decryptToken(encrypted);

    expect(decrypted).toBe(testToken);
  });

  test('should handle encryption/decryption roundtrip', async () => {
    const result = await testEncryption();

    expect(result).toBe(true);
  });

  test('should produce different encrypted values for same token (random IV)', async () => {
    const encrypted1 = await encryptToken(testToken);
    const encrypted2 = await encryptToken(testToken);

    expect(encrypted1).not.toBe(encrypted2); // Different IVs
    expect(await decryptToken(encrypted1)).toBe(testToken);
    expect(await decryptToken(encrypted2)).toBe(testToken);
  });

  test('should throw error when encryption key is missing', async () => {
    const originalKey = process.env.XERO_TOKEN_ENCRYPTION_KEY;
    delete process.env.XERO_TOKEN_ENCRYPTION_KEY;

    await expect(encryptToken('test')).rejects.toThrow('XERO_TOKEN_ENCRYPTION_KEY');

    process.env.XERO_TOKEN_ENCRYPTION_KEY = originalKey;
  });

  test('should throw error for invalid encrypted token format', async () => {
    await expect(decryptToken('invalid-format')).rejects.toThrow();
  });
});
