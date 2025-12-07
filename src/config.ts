/**
 * Configuration Loader
 *
 * Loads OAuth configuration from mcp-config.json file.
 * IMPORTANT: Config file should NEVER contain secrets or tokens!
 * Only non-sensitive metadata like client_id and scopes.
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface GitHubConfig {
  client_id: string;
  scopes: string[];
}

export interface Config {
  github: GitHubConfig;
}

/**
 * Load configuration from mcp-config.json
 */
export async function loadConfig(): Promise<Config> {
  const configPath = resolve(process.cwd(), 'mcp-config.json');

  try {
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData) as Config;

    // Validate configuration
    if (!config.github?.client_id) {
      throw new Error('Missing required configuration: github.client_id');
    }

    if (!config.github?.scopes || !Array.isArray(config.github.scopes)) {
      throw new Error('Missing or invalid configuration: github.scopes');
    }

    return config;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Configuration file not found. Please create mcp-config.json. ' +
        'See mcp-config.example.json for template.'
      );
    }
    throw error;
  }
}

/**
 * Get OAuth configuration for GitHub
 */
export async function getOAuthConfig(): Promise<{ clientId: string; scopes: string[] }> {
  const config = await loadConfig();
  return {
    clientId: config.github.client_id,
    scopes: config.github.scopes,
  };
}
