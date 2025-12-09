#!/usr/bin/env node

/**
 * Jenkins MCP Server with GitHub OAuth Integration
 *
 * MCP server for Jenkins CI/CD operations using GitHub OAuth token.
 * Works alongside the GitHub MCP server for complete DevOps workflow.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as jenkins from './jenkins/client.js';
import { loadConfig } from './config.js';
import * as oauth from './auth/oauth.js';

// Create MCP server instance
const server = new Server(
  {
    name: 'jenkins-mcp-oauth',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Initialize Jenkins configuration
 */
async function initializeJenkins(): Promise<void> {
  try {
    const config = await loadConfig();

    if (!config.jenkins) {
      throw new Error('Jenkins configuration not found in mcp-config.json');
    }

    jenkins.setJenkinsConfig({
      url: config.jenkins.url,
      authMode: config.jenkins.auth_mode || 'github-oauth',
      username: config.jenkins.username,
      apiToken: config.jenkins.api_token,
    });

    console.error('✓ Jenkins configuration loaded');

    // Ensure GitHub OAuth token is available
    if (config.jenkins.auth_mode === 'github-oauth') {
      const oauthConfig = {
        clientId: config.github.client_id,
        scopes: config.github.scopes,
      };
      await oauth.getValidAccessToken(oauthConfig);
      console.error('✓ GitHub OAuth token available for Jenkins');
    }
  } catch (error) {
    console.error('⚠ Jenkins initialization warning:', error);
  }
}

/**
 * List all available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'jenkins_list_jobs',
        description: 'List all Jenkins jobs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'jenkins_get_job',
        description: 'Get details about a specific Jenkins job',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
          },
          required: ['job_name'],
        },
      },
      {
        name: 'jenkins_trigger_build',
        description: 'Trigger a Jenkins build',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
            parameters: {
              type: 'object',
              description: 'Build parameters (optional)',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['job_name'],
        },
      },
      {
        name: 'jenkins_get_build',
        description: 'Get details about a specific build',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
            build_number: {
              type: 'number',
              description: 'Build number',
            },
          },
          required: ['job_name', 'build_number'],
        },
      },
      {
        name: 'jenkins_get_last_build',
        description: 'Get the last build for a job',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
          },
          required: ['job_name'],
        },
      },
      {
        name: 'jenkins_get_build_console',
        description: 'Get console output for a build',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
            build_number: {
              type: 'number',
              description: 'Build number',
            },
          },
          required: ['job_name', 'build_number'],
        },
      },
      {
        name: 'jenkins_stop_build',
        description: 'Stop a running build',
        inputSchema: {
          type: 'object',
          properties: {
            job_name: {
              type: 'string',
              description: 'Name of the Jenkins job',
            },
            build_number: {
              type: 'number',
              description: 'Build number',
            },
          },
          required: ['job_name', 'build_number'],
        },
      },
      {
        name: 'jenkins_get_queue',
        description: 'Get Jenkins build queue status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'jenkins_get_system_info',
        description: 'Get Jenkins system information',
        inputSchema: {
          type: 'object',
          properties: {},
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
      case 'jenkins_list_jobs': {
        const jobs = await jenkins.listJobs();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case 'jenkins_get_job': {
        const job = await jenkins.getJob((args as any).job_name);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(job, null, 2),
            },
          ],
        };
      }

      case 'jenkins_trigger_build': {
        await jenkins.triggerBuild(
          (args as any).job_name,
          (args as any).parameters
        );
        return {
          content: [
            {
              type: 'text',
              text: `Build triggered for job: ${(args as any).job_name}`,
            },
          ],
        };
      }

      case 'jenkins_get_build': {
        const build = await jenkins.getBuild(
          (args as any).job_name,
          (args as any).build_number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(build, null, 2),
            },
          ],
        };
      }

      case 'jenkins_get_last_build': {
        const build = await jenkins.getLastBuild((args as any).job_name);
        return {
          content: [
            {
              type: 'text',
              text: build ? JSON.stringify(build, null, 2) : 'No builds found',
            },
          ],
        };
      }

      case 'jenkins_get_build_console': {
        const console = await jenkins.getBuildConsole(
          (args as any).job_name,
          (args as any).build_number
        );
        return {
          content: [
            {
              type: 'text',
              text: console,
            },
          ],
        };
      }

      case 'jenkins_stop_build': {
        await jenkins.stopBuild(
          (args as any).job_name,
          (args as any).build_number
        );
        return {
          content: [
            {
              type: 'text',
              text: `Build #${(args as any).build_number} stopped for job: ${(args as any).job_name}`,
            },
          ],
        };
      }

      case 'jenkins_get_queue': {
        const queue = await jenkins.getQueue();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(queue, null, 2),
            },
          ],
        };
      }

      case 'jenkins_get_system_info': {
        const info = await jenkins.getSystemInfo();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(info, null, 2),
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
  // Initialize Jenkins configuration
  await initializeJenkins();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Jenkins MCP Server with GitHub OAuth running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
