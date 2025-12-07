#!/usr/bin/env node

/**
 * GitHub MCP Server with OAuth Device Flow
 *
 * An MCP server that provides GitHub integration with secure OAuth authentication.
 * No hardcoded credentials - all tokens stored in OS credential manager.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as github from './github/client.js';

// Create MCP server instance
const server = new Server(
  {
    name: 'github-mcp-oauth',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List all available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_repositories',
        description: 'List repositories for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            visibility: {
              type: 'string',
              enum: ['all', 'public', 'private'],
              description: 'Filter by repository visibility',
              default: 'all',
            },
            sort: {
              type: 'string',
              enum: ['created', 'updated', 'pushed', 'full_name'],
              description: 'Sort order for repositories',
              default: 'updated',
            },
            per_page: {
              type: 'number',
              description: 'Number of results per page (max 100)',
              default: 30,
            },
            page: {
              type: 'number',
              description: 'Page number to retrieve',
              default: 1,
            },
          },
        },
      },
      {
        name: 'get_file_contents',
        description: 'Get contents of a file from a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            path: {
              type: 'string',
              description: 'Path to the file in the repository',
            },
            ref: {
              type: 'string',
              description: 'Git ref (branch, tag, or commit SHA). Defaults to default branch.',
            },
          },
          required: ['owner', 'repo', 'path'],
        },
      },
      {
        name: 'create_or_update_file',
        description: 'Create or update a file in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            path: {
              type: 'string',
              description: 'Path where to create/update the file',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
            content: {
              type: 'string',
              description: 'File content',
            },
            branch: {
              type: 'string',
              description: 'Branch to commit to',
            },
            sha: {
              type: 'string',
              description: 'SHA of the file being replaced (required for updates)',
            },
          },
          required: ['owner', 'repo', 'path', 'message', 'content'],
        },
      },
      {
        name: 'list_issues',
        description: 'List issues for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description: 'Filter by issue state',
              default: 'open',
            },
            per_page: {
              type: 'number',
              description: 'Results per page',
              default: 30,
            },
            page: {
              type: 'number',
              description: 'Page number',
              default: 1,
            },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a new issue in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            title: {
              type: 'string',
              description: 'Issue title',
            },
            body: {
              type: 'string',
              description: 'Issue body/description',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to apply to the issue',
            },
            assignees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Usernames to assign to the issue',
            },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
      {
        name: 'update_issue',
        description: 'Update an existing issue',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            issue_number: {
              type: 'number',
              description: 'Issue number',
            },
            title: {
              type: 'string',
              description: 'New issue title',
            },
            body: {
              type: 'string',
              description: 'New issue body',
            },
            state: {
              type: 'string',
              enum: ['open', 'closed'],
              description: 'Issue state',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to apply',
            },
          },
          required: ['owner', 'repo', 'issue_number'],
        },
      },
      {
        name: 'list_pull_requests',
        description: 'List pull requests for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description: 'Filter by PR state',
              default: 'open',
            },
            per_page: {
              type: 'number',
              description: 'Results per page',
              default: 30,
            },
            page: {
              type: 'number',
              description: 'Page number',
              default: 1,
            },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_pull_request',
        description: 'Create a new pull request',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            title: {
              type: 'string',
              description: 'Pull request title',
            },
            head: {
              type: 'string',
              description: 'Branch containing changes',
            },
            base: {
              type: 'string',
              description: 'Branch to merge into',
            },
            body: {
              type: 'string',
              description: 'Pull request description',
            },
            draft: {
              type: 'boolean',
              description: 'Create as draft PR',
              default: false,
            },
          },
          required: ['owner', 'repo', 'title', 'head', 'base'],
        },
      },
      {
        name: 'search_code',
        description: 'Search for code across GitHub repositories',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (supports GitHub code search syntax)',
            },
            per_page: {
              type: 'number',
              description: 'Results per page',
              default: 30,
            },
            page: {
              type: 'number',
              description: 'Page number',
              default: 1,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_repositories',
        description: 'Search for repositories on GitHub',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            sort: {
              type: 'string',
              enum: ['stars', 'forks', 'updated'],
              description: 'Sort field',
            },
            per_page: {
              type: 'number',
              description: 'Results per page',
              default: 30,
            },
            page: {
              type: 'number',
              description: 'Page number',
              default: 1,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_info',
        description: 'Get information about the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_repository',
        description: 'Get detailed information about a specific repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
          },
          required: ['owner', 'repo'],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'list_repositories': {
        const repos = await github.listRepositories(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(repos, null, 2),
            },
          ],
        };
      }

      case 'get_file_contents': {
        const content = await github.getFileContents(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(content, null, 2),
            },
          ],
        };
      }

      case 'create_or_update_file': {
        const result = await github.createOrUpdateFile(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_issues': {
        const issues = await github.listIssues(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issues, null, 2),
            },
          ],
        };
      }

      case 'create_issue': {
        const issue = await github.createIssue(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      }

      case 'update_issue': {
        const issue = await github.updateIssue(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      }

      case 'list_pull_requests': {
        const prs = await github.listPullRequests(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(prs, null, 2),
            },
          ],
        };
      }

      case 'create_pull_request': {
        const pr = await github.createPullRequest(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pr, null, 2),
            },
          ],
        };
      }

      case 'search_code': {
        const results = await github.searchCode(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'search_repositories': {
        const results = await github.searchRepositories(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_user_info': {
        const user = await github.getUserInfo();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(user, null, 2),
            },
          ],
        };
      }

      case 'get_repository': {
        const repo = await github.getRepository(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(repo, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${errorMessage}`
    );
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('GitHub MCP Server with OAuth running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
