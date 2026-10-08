import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.js';

const ALGO = 'aes-256-gcm';

// Derive a 32-byte key from the configured key string
function getKey(): Buffer {
  const raw = config.encryptionKey;
  // Use SHA-256 to derive exactly 32 bytes
  return createHash(raw);
}

function createHash(input: string): Buffer {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(input).digest();
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, payload.iv);
  decipher.setAuthTag(payload.tag);
  const decrypted = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptJSON(obj: unknown): EncryptedPayload {
  return encrypt(JSON.stringify(obj));
}

export function decryptJSON<T>(payload: EncryptedPayload): T {
  return JSON.parse(decrypt(payload)) as T;
}
