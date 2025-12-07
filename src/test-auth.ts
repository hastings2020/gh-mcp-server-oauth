#!/usr/bin/env node

/**
 * Test script to verify OAuth authentication works
 * This will trigger the OAuth flow and test GitHub API access
 */

import * as oauth from './auth/oauth.js';
import * as github from './github/client.js';
import { getOAuthConfig } from './config.js';

async function testAuth() {
  console.log('🧪 Testing GitHub OAuth Authentication...\n');

  try {
    // Get OAuth config
    console.log('📋 Loading configuration...');
    const config = await getOAuthConfig();
    console.log(`✓ Client ID: ${config.clientId}`);
    console.log(`✓ Scopes: ${config.scopes.join(', ')}\n`);

    // Get or create access token (this will trigger OAuth if needed)
    console.log('🔐 Checking for valid access token...');
    const token = await oauth.getValidAccessToken(config);
    console.log('✓ Access token obtained\n');

    // Test GitHub API with authenticated request
    console.log('🐙 Testing GitHub API access...');
    const user = await github.getUserInfo();
    console.log('✓ Successfully authenticated with GitHub!\n');

    // Display user info
    console.log('👤 Authenticated User:');
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Username: ${user.login}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Public Repos: ${user.public_repos}`);
    console.log(`   Profile: ${user.html_url}\n`);

    console.log('✅ Authentication test successful!\n');
    console.log('Your GitHub MCP server is ready to use in Cursor.');

  } catch (error) {
    console.error('\n❌ Authentication test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\nPlease check:');
    console.error('  1. mcp-config.json exists and has valid client_id');
    console.error('  2. You have internet connection');
    console.error('  3. Your GitHub OAuth app is configured correctly\n');
    process.exit(1);
  }
}

testAuth();
