/**
 * API key encryption/decryption stub.
 *
 * In production, this would use Electron's safeStorage API for secure
 * at-rest encryption. Since safeStorage requires a running Electron
 * instance (not available in tests or during build), we use a simple
 * base64 encoding as a stub.
 *
 * TODO: Replace with safeStorage when running inside Electron:
 *   import { safeStorage } from 'electron';
 *   safeStorage.encryptString(key) / safeStorage.decryptString(buffer)
 */

const STUB_PREFIX = 'dax-enc-v1:';

/**
 * Encrypt an API key for storage.
 * Stub implementation: base64 encodes the key with a prefix.
 */
export function encryptApiKey(plainKey: string): string {
  const encoded = Buffer.from(plainKey, 'utf-8').toString('base64');
  return `${STUB_PREFIX}${encoded}`;
}

/**
 * Decrypt a stored API key.
 * Stub implementation: decodes from base64.
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey.startsWith(STUB_PREFIX)) {
    throw new Error('Invalid encrypted key format');
  }
  const encoded = encryptedKey.slice(STUB_PREFIX.length);
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Check whether safe storage is available.
 * Stub always returns false since we're not using real safeStorage.
 */
export function isSafeStorageAvailable(): boolean {
  return false;
}
