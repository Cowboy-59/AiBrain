/**
 * SpockAI Credential Encryption Utility
 * Provides secure encryption/decryption for sensitive credentials
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

const KEY_FILE_PATH = join(homedir(), '.openclaw', '.spockai-key');

/**
 * Get or create encryption key
 */
async function getEncryptionKey(): Promise<Buffer> {
  try {
    if (existsSync(KEY_FILE_PATH)) {
      const keyData = await readFile(KEY_FILE_PATH);
      return keyData;
    }

    // Generate new key
    const key = randomBytes(KEY_LENGTH);
    const dir = dirname(KEY_FILE_PATH);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(KEY_FILE_PATH, key, { mode: 0o600 });
    logger.info('Generated new encryption key');

    return key;
  } catch (error) {
    logger.error('Failed to get encryption key', { error });
    throw new Error('Failed to initialize encryption');
  }
}

/**
 * Encrypt sensitive data
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    return '';
  }

  try {
    const key = await getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', { error });
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export async function decrypt(encryptedData: string): Promise<string> {
  if (!encryptedData) {
    return '';
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data components');
    }

    const key = await getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error });
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a password with salt for storage
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) {
      return false;
    }

    const [saltHex, hashHex] = parts;
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const storedHashBuffer = Buffer.from(hashHex, 'hex');
    const hash = scryptSync(password, salt, 64);

    return hash.equals(storedHashBuffer);
  } catch {
    return false;
  }
}

/**
 * Securely clear sensitive data from memory
 */
export function secureClear(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Check if a string is encrypted (has our format)
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  const parts = data.split(':');
  return parts.length === 3 &&
         parts[0]?.length === IV_LENGTH * 2 &&
         parts[1]?.length === AUTH_TAG_LENGTH * 2;
}
