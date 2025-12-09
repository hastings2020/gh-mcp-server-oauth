/**
 * Jenkins API Client
 *
 * Integrates with Jenkins using GitHub OAuth token or Jenkins API token.
 * Supports Jenkins with GitHub OAuth Plugin or traditional API tokens.
 */

import fetch from 'node-fetch';
import { getStoredTokens } from '../auth/token-storage.js';

export interface JenkinsConfig {
  url: string;
  authMode: 'github-oauth' | 'api-token';
  apiToken?: string; // For traditional Jenkins auth
  username?: string; // For traditional Jenkins auth
}

export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  lastBuild?: {
    number: number;
    url: string;
  };
}

export interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
}

let jenkinsConfig: JenkinsConfig | null = null;

/**
 * Initialize Jenkins configuration
 */
export function setJenkinsConfig(config: JenkinsConfig): void {
  jenkinsConfig = config;
}

/**
 * Get authentication headers for Jenkins
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!jenkinsConfig) {
    throw new Error('Jenkins not configured. Set JENKINS_URL in config.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (jenkinsConfig.authMode === 'github-oauth') {
    // Use GitHub OAuth token for Jenkins (requires GitHub OAuth Plugin)
    const tokens = await getStoredTokens();
    if (!tokens?.accessToken) {
      throw new Error('No GitHub OAuth token found. Please authenticate first.');
    }
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  } else if (jenkinsConfig.authMode === 'api-token') {
    // Use Jenkins API token
    if (!jenkinsConfig.username || !jenkinsConfig.apiToken) {
      throw new Error('Jenkins username and API token required for api-token mode.');
    }
    const auth = Buffer.from(`${jenkinsConfig.username}:${jenkinsConfig.apiToken}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  return headers;
}

/**
 * Make authenticated request to Jenkins API
 */
async function jenkinsRequest(endpoint: string, options: any = {}): Promise<any> {
  if (!jenkinsConfig) {
    throw new Error('Jenkins not configured');
  }

  const url = `${jenkinsConfig.url}${endpoint}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jenkins API error (${response.status}): ${error}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }

  return await response.text();
}

/**
 * List all Jenkins jobs
 */
export async function listJobs(): Promise<JenkinsJob[]> {
  const data = await jenkinsRequest('/api/json?tree=jobs[name,url,color,lastBuild[number,url]]');
  return data.jobs || [];
}

/**
 * Get job details
 */
export async function getJob(jobName: string): Promise<any> {
  return await jenkinsRequest(`/job/${encodeURIComponent(jobName)}/api/json`);
}

/**
 * Trigger a build
 */
export async function triggerBuild(jobName: string, parameters?: Record<string, string>): Promise<void> {
  const endpoint = parameters
    ? `/job/${encodeURIComponent(jobName)}/buildWithParameters`
    : `/job/${encodeURIComponent(jobName)}/build`;

  const url = new URL(endpoint, jenkinsConfig!.url);
  if (parameters) {
    Object.entries(parameters).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  await jenkinsRequest(url.pathname + url.search, {
    method: 'POST',
  });
}

/**
 * Get build details
 */
export async function getBuild(jobName: string, buildNumber: number): Promise<JenkinsBuild> {
  return await jenkinsRequest(
    `/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`
  );
}

/**
 * Get build console output
 */
export async function getBuildConsole(jobName: string, buildNumber: number): Promise<string> {
  return await jenkinsRequest(
    `/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`
  );
}

/**
 * Get last build for a job
 */
export async function getLastBuild(jobName: string): Promise<JenkinsBuild | null> {
  try {
    return await jenkinsRequest(
      `/job/${encodeURIComponent(jobName)}/lastBuild/api/json`
    );
  } catch (error) {
    // Job might not have any builds yet
    return null;
  }
}

/**
 * Stop a build
 */
export async function stopBuild(jobName: string, buildNumber: number): Promise<void> {
  await jenkinsRequest(
    `/job/${encodeURIComponent(jobName)}/${buildNumber}/stop`,
    { method: 'POST' }
  );
}

/**
 * Get queue information
 */
export async function getQueue(): Promise<any> {
  return await jenkinsRequest('/queue/api/json');
}

/**
 * Get Jenkins version and system info
 */
export async function getSystemInfo(): Promise<any> {
  return await jenkinsRequest('/api/json');
}
