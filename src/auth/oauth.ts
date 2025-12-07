/**
 * GitHub OAuth Device Flow Implementation
 *
 * Implements the OAuth 2.0 Device Authorization Grant flow for GitHub.
 * This allows authentication without a web browser redirect.
 *
 * Flow:
 * 1. Request device and user codes
 * 2. Display user code and verification URL to user
 * 3. Poll for authorization completion
 * 4. Exchange device code for access token
 *
 * Documentation: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

import fetch from 'node-fetch';
import * as tokenStorage from './token-storage.js';

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface OAuthConfig {
  clientId: string;
  scopes: string[];
}

/**
 * Step 1: Request device and user codes from GitHub
 */
export async function requestDeviceCode(config: OAuthConfig): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      scope: config.scopes.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to request device code: ${error}`);
  }

  const data = await response.json() as DeviceCodeResponse;
  return data;
}

/**
 * Step 2: Display user code and verification URL to user
 */
export function displayUserCode(deviceCode: DeviceCodeResponse): void {
  console.error('\n╔══════════════════════════════════════════════════════════════╗');
  console.error('║            GitHub OAuth Device Flow Authentication           ║');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error('║                                                              ║');
  console.error(`║  1. Visit: ${deviceCode.verification_uri.padEnd(44)} ║`);
  console.error('║                                                              ║');
  console.error(`║  2. Enter code: ${deviceCode.user_code.padEnd(40)} ║`);
  console.error('║                                                              ║');
  console.error('║  3. Authorize the application                                ║');
  console.error('║                                                              ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('\nWaiting for authorization...\n');
}

/**
 * Step 3 & 4: Poll for authorization and exchange device code for access token
 */
export async function pollForAccessToken(
  config: OAuthConfig,
  deviceCode: DeviceCodeResponse
): Promise<AccessTokenResponse> {
  const expiresAt = Date.now() + (deviceCode.expires_in * 1000);
  const interval = deviceCode.interval * 1000; // Convert to milliseconds

  while (Date.now() < expiresAt) {
    await sleep(interval);

    try {
      const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          device_code: deviceCode.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json() as any;

      // Check for errors
      if (data.error) {
        if (data.error === 'authorization_pending') {
          // User hasn't authorized yet, continue polling
          continue;
        } else if (data.error === 'slow_down') {
          // We're polling too fast, increase interval
          await sleep(interval);
          continue;
        } else if (data.error === 'expired_token') {
          throw new Error('Device code expired. Please try again.');
        } else if (data.error === 'access_denied') {
          throw new Error('User denied authorization.');
        } else {
          throw new Error(`OAuth error: ${data.error_description || data.error}`);
        }
      }

      // Success! We have an access token
      if (data.access_token) {
        return data as AccessTokenResponse;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('OAuth error')) {
        throw error;
      }
      // Network errors or other issues - continue polling
      console.error(`Polling error: ${error}. Retrying...`);
    }
  }

  throw new Error('Device code expired. Please try again.');
}

/**
 * Complete OAuth flow: request code, display to user, poll for token, store token
 */
export async function authenticateWithDeviceFlow(config: OAuthConfig): Promise<string> {
  console.error('\n🔐 Starting GitHub OAuth Device Flow...\n');

  // Step 1: Request device code
  const deviceCode = await requestDeviceCode(config);

  // Step 2: Display user code
  displayUserCode(deviceCode);

  // Step 3 & 4: Poll for access token
  const tokenResponse = await pollForAccessToken(config, deviceCode);

  // Calculate expiry timestamp
  const expiresAt = tokenResponse.expires_in
    ? Date.now() + (tokenResponse.expires_in * 1000)
    : undefined;

  // Store tokens securely
  await tokenStorage.storeTokens({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
  });

  console.error('\n✅ Authentication successful! Token stored securely.\n');

  return tokenResponse.access_token;
}

/**
 * Get valid access token (from storage or by re-authenticating)
 */
export async function getValidAccessToken(config: OAuthConfig): Promise<string> {
  // Check if we have a stored token
  const hasTokens = await tokenStorage.hasStoredTokens();

  if (hasTokens) {
    // Check if token is still valid
    const isValid = await tokenStorage.isTokenValid();

    if (isValid) {
      const tokens = await tokenStorage.getStoredTokens();
      if (tokens?.accessToken) {
        console.error('✓ Using stored access token from credential manager');
        return tokens.accessToken;
      }
    } else {
      console.error('⚠ Stored token is expired or invalid');
      // TODO: Implement token refresh if refresh token is available
      // For now, we'll re-authenticate
      await tokenStorage.deleteTokens();
    }
  }

  // No valid token - authenticate
  return await authenticateWithDeviceFlow(config);
}

/**
 * Manually revoke/delete stored tokens
 */
export async function revokeTokens(): Promise<void> {
  await tokenStorage.deleteTokens();
  console.error('✓ Tokens revoked successfully');
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
