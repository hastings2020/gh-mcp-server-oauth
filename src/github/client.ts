/**
 * GitHub API Client Wrapper
 *
 * Wraps Octokit with authenticated GitHub API client.
 * Uses OAuth token from secure credential storage.
 */

import { Octokit } from '@octokit/rest';
import * as oauth from '../auth/oauth.js';
import { getOAuthConfig } from '../config.js';

let octokitInstance: Octokit | null = null;

/**
 * Initialize authenticated GitHub client
 */
export async function getGitHubClient(): Promise<Octokit> {
  if (octokitInstance) {
    return octokitInstance;
  }

  // Get OAuth config
  const config = await getOAuthConfig();

  // Get valid access token (will authenticate if needed)
  const accessToken = await oauth.getValidAccessToken(config);

  // Create authenticated Octokit instance
  octokitInstance = new Octokit({
    auth: accessToken,
    userAgent: 'github-mcp-oauth/1.0.0',
  });

  return octokitInstance;
}

/**
 * Reset client (useful for re-authentication)
 */
export function resetClient(): void {
  octokitInstance = null;
}

/**
 * List user repositories
 */
export async function listRepositories(params?: {
  visibility?: 'all' | 'public' | 'private';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  per_page?: number;
  page?: number;
}) {
  const client = await getGitHubClient();
  const response = await client.repos.listForAuthenticatedUser({
    visibility: params?.visibility || 'all',
    sort: params?.sort || 'updated',
    per_page: params?.per_page || 30,
    page: params?.page || 1,
  });
  return response.data;
}

/**
 * Get file contents from a repository
 */
export async function getFileContents(params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}) {
  const client = await getGitHubClient();
  const response = await client.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ref: params.ref,
  });
  return response.data;
}

/**
 * Create or update a file in a repository
 */
export async function createOrUpdateFile(params: {
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: string;
  branch?: string;
  sha?: string;
}) {
  const client = await getGitHubClient();

  // Encode content to base64
  const contentEncoded = Buffer.from(params.content).toString('base64');

  const response = await client.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: contentEncoded,
    branch: params.branch,
    sha: params.sha,
  });
  return response.data;
}

/**
 * List issues for a repository
 */
export async function listIssues(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  per_page?: number;
  page?: number;
}) {
  const client = await getGitHubClient();
  const response = await client.issues.listForRepo({
    owner: params.owner,
    repo: params.repo,
    state: params.state || 'open',
    per_page: params.per_page || 30,
    page: params.page || 1,
  });
  return response.data;
}

/**
 * Create an issue
 */
export async function createIssue(params: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}) {
  const client = await getGitHubClient();
  const response = await client.issues.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    labels: params.labels,
    assignees: params.assignees,
  });
  return response.data;
}

/**
 * Update an issue
 */
export async function updateIssue(params: {
  owner: string;
  repo: string;
  issue_number: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
}) {
  const client = await getGitHubClient();
  const response = await client.issues.update({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issue_number,
    title: params.title,
    body: params.body,
    state: params.state,
    labels: params.labels,
  });
  return response.data;
}

/**
 * List pull requests for a repository
 */
export async function listPullRequests(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  per_page?: number;
  page?: number;
}) {
  const client = await getGitHubClient();
  const response = await client.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: params.state || 'open',
    per_page: params.per_page || 30,
    page: params.page || 1,
  });
  return response.data;
}

/**
 * Create a pull request
 */
export async function createPullRequest(params: {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}) {
  const client = await getGitHubClient();
  const response = await client.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    head: params.head,
    base: params.base,
    body: params.body,
    draft: params.draft,
  });
  return response.data;
}

/**
 * Search code in GitHub
 */
export async function searchCode(params: {
  query: string;
  per_page?: number;
  page?: number;
}) {
  const client = await getGitHubClient();
  const response = await client.search.code({
    q: params.query,
    per_page: params.per_page || 30,
    page: params.page || 1,
  });
  return response.data;
}

/**
 * Search repositories
 */
export async function searchRepositories(params: {
  query: string;
  sort?: 'stars' | 'forks' | 'updated';
  per_page?: number;
  page?: number;
}) {
  const client = await getGitHubClient();
  const response = await client.search.repos({
    q: params.query,
    sort: params.sort,
    per_page: params.per_page || 30,
    page: params.page || 1,
  });
  return response.data;
}

/**
 * Get authenticated user information
 */
export async function getUserInfo() {
  const client = await getGitHubClient();
  const response = await client.users.getAuthenticated();
  return response.data;
}

/**
 * Get repository information
 */
export async function getRepository(params: {
  owner: string;
  repo: string;
}) {
  const client = await getGitHubClient();
  const response = await client.repos.get({
    owner: params.owner,
    repo: params.repo,
  });
  return response.data;
}
