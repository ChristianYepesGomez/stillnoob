import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required (64 hex chars = 32 bytes)');
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}

/**
 * Encrypt a plaintext string with AES-256-GCM
 * @param {string} plaintext
 * @returns {string} base64-encoded ciphertext (iv + tag + encrypted)
 */
export function encryptToken(plaintext) {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext
 * @param {string} ciphertext - base64-encoded string
 * @returns {string} decrypted plaintext
 */
export function decryptToken(ciphertext) {
  if (!ciphertext) return ciphertext;
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
