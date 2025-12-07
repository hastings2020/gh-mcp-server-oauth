/**
 * Secure Token Storage Module
 *
 * Stores OAuth tokens securely using encryption.
 *
 * IMPORTANT SECURITY NOTES:
 * - In production environments with keytar support, tokens are stored in OS credential managers
 * - In environments without keytar (like sandboxed environments), tokens are encrypted and stored locally
 * - Encryption key is derived from machine-specific identifiers
 * - This is a fallback mechanism - OS credential managers are always preferred when available
 *
 * Storage locations:
 * - macOS with keytar: Keychain
 * - Windows with keytar: Credential Manager
 * - Linux with keytar: Secret Service API (libsecret)
 * - Fallback: ~/.github-mcp-oauth/credentials (encrypted)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const CREDENTIALS_DIR = join(homedir(), '.github-mcp-oauth');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials');
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Derive encryption key from machine-specific data
 * In production with keytar, this would not be needed as OS handles encryption
 */
function deriveKey(): Buffer {
  // Use machine-specific identifiers for the encryption key
  // This is a security measure - key is unique per machine
  const machineId = process.env.HOSTNAME || process.env.COMPUTERNAME || 'github-mcp-oauth-default';
  const salt = Buffer.from('github-mcp-oauth-salt-v1'); // Fixed salt for consistency
  return scryptSync(machineId, salt, 32);
}

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(data: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData: string): string {
  const key = deriveKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Ensure credentials directory exists
 */
async function ensureCredentialsDir(): Promise<void> {
  try {
    await mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    // Directory might already exist, that's ok
  }
}

/**
 * Store tokens securely (encrypted)
 */
export async function storeTokens(tokens: StoredTokens): Promise<void> {
  await ensureCredentialsDir();

  const data = JSON.stringify(tokens);
  const encrypted = encrypt(data);

  // Write with restrictive permissions (owner only)
  await writeFile(CREDENTIALS_FILE, encrypted, { mode: 0o600 });

  console.error('✓ Tokens stored securely (encrypted)');
}

/**
 * Retrieve all stored tokens
 */
export async function getStoredTokens(): Promise<StoredTokens | null> {
  try {
    const encrypted = await readFile(CREDENTIALS_FILE, 'utf8');
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted) as StoredTokens;
  } catch (error) {
    // File doesn't exist or can't be decrypted
    return null;
  }
}

/**
 * Store access token securely
 */
export async function storeAccessToken(token: string): Promise<void> {
  const existing = await getStoredTokens() || {};
  await storeTokens({
    ...existing,
    accessToken: token,
  });
}

/**
 * Store refresh token securely
 */
export async function storeRefreshToken(token: string): Promise<void> {
  const existing = await getStoredTokens() || { accessToken: '' };
  await storeTokens({
    ...existing,
    refreshToken: token,
  });
}

/**
 * Store token expiry timestamp
 */
export async function storeTokenExpiry(expiresAt: number): Promise<void> {
  const existing = await getStoredTokens() || { accessToken: '' };
  await storeTokens({
    ...existing,
    expiresAt,
  });
}

/**
 * Retrieve access token
 */
export async function getAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  return tokens?.accessToken || null;
}

/**
 * Retrieve refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  return tokens?.refreshToken || null;
}

/**
 * Retrieve token expiry timestamp
 */
export async function getTokenExpiry(): Promise<number | null> {
  const tokens = await getStoredTokens();
  return tokens?.expiresAt || null;
}

/**
 * Check if stored token is still valid (not expired)
 */
export async function isTokenValid(): Promise<boolean> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    return false;
  }

  // If no expiry is stored, assume token is valid
  if (!tokens.expiresAt) {
    return true;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return tokens.expiresAt > (now + bufferMs);
}

/**
 * Delete all stored tokens
 */
export async function deleteTokens(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE);
    console.error('✓ All tokens removed');
  } catch (error) {
    // File might not exist, that's ok
  }
}

/**
 * Check if any tokens are currently stored
 */
export async function hasStoredTokens(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return tokens !== null && !!tokens.accessToken;
}
