import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

if (!ENCRYPTION_KEY) {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required. Generate with: openssl rand -hex 32'
  )
}

if (ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be a 32-byte hex string (64 characters). Generate with: openssl rand -hex 32'
  )
}

/**
 * Encrypts a plaintext token using AES-256-GCM
 *
 * @param token - The plaintext token to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted
 *
 * @example
 * const encrypted = encryptToken('xero-access-token-abc123')
 * // Returns: '1a2b3c...:4d5e6f...:7g8h9i...'
 */
export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Token cannot be empty')
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts an encrypted token
 *
 * @param encryptedToken - The encrypted token string (iv:authTag:encrypted format)
 * @returns Decrypted plaintext token
 *
 * @example
 * const decrypted = decryptToken('1a2b3c...:4d5e6f...:7g8h9i...')
 * // Returns: 'xero-access-token-abc123'
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Encrypted token cannot be empty')
  }

  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error(
      'Invalid encrypted token format. Expected format: iv:authTag:encrypted'
    )
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Tests the encryption/decryption round-trip
 * Useful for verifying ENCRYPTION_KEY is correctly configured
 *
 * @returns true if encryption/decryption works correctly
 * @throws Error if round-trip fails
 *
 * @example
 * testEncryption() // Returns true if working
 */
export function testEncryption(): boolean {
  const testToken = 'test-token-12345'
  const encrypted = encryptToken(testToken)
  const decrypted = decryptToken(encrypted)

  if (decrypted !== testToken) {
    throw new Error('Encryption test failed: decrypted value does not match original')
  }

  return true
}
