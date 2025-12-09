# Jenkins + GitHub MCP Integration Guide

Complete guide for using Jenkins and GitHub MCP servers together for a full DevOps workflow: commit, push, build, and deploy.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CURSOR IDE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐       ┌──────────────────────┐   │
│  │  GitHub MCP Server   │       │ Jenkins MCP Server   │   │
│  │  Port: stdio-1       │       │ Port: stdio-2        │   │
│  ├──────────────────────┤       ├──────────────────────┤   │
│  │ • Create/Update PR   │       │ • Trigger Build      │   │
│  │ • Commit & Push      │       │ • Get Build Status   │   │
│  │ • Manage Issues      │       │ • View Console       │   │
│  │ • Code Search        │       │ • Deploy Jobs        │   │
│  └──────────────────────┘       └──────────────────────┘   │
│           ↓                              ↓                  │
│    Shared GitHub OAuth Token                                │
│           ↓                              ↓                  │
│  ┌──────────────────────┐       ┌──────────────────────┐   │
│  │   GitHub API         │       │   Jenkins API        │   │
│  │   api.github.com     │       │   jenkins.example    │   │
│  └──────────────────────┘       └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### 1. Jenkins Setup with GitHub OAuth (Recommended)

**Install GitHub OAuth Plugin in Jenkins:**

1. Go to Jenkins → Manage Jenkins → Manage Plugins
2. Search for "GitHub Authentication"
3. Install "GitHub Authentication Plugin"
4. Restart Jenkins

**Configure GitHub OAuth in Jenkins:**

1. Jenkins → Manage Jenkins → Configure Global Security
2. Security Realm → Select "GitHub Authentication Plugin"
3. GitHub Web URI: `https://github.com`
4. GitHub API URI: `https://api.github.com`
5. Client ID: (use same OAuth app as MCP server)
6. Client Secret: (your OAuth app secret)
7. Save

**Alternative: Jenkins API Token**

If not using GitHub OAuth Plugin:

1. Jenkins → Your User → Configure
2. API Token → Add new Token
3. Save the token securely

## 🔧 Configuration

### Update `mcp-config.json`

```json
{
  "github": {
    "client_id": "Iv1.your_oauth_app_client_id",
    "scopes": [
      "repo",
      "read:user",
      "read:org"
    ]
  },
  "jenkins": {
    "url": "https://jenkins.example.com",
    "auth_mode": "github-oauth",
    "username": "optional_for_api_token_mode",
    "api_token": "optional_jenkins_api_token"
  }
}
```

**Authentication Modes:**

1. **`github-oauth`** (Recommended):
   - Uses the same GitHub OAuth token for both GitHub and Jenkins
   - Requires Jenkins GitHub OAuth Plugin
   - Single sign-on experience
   - Set `auth_mode: "github-oauth"`

2. **`api-token`**:
   - Uses Jenkins username + API token
   - Works with standard Jenkins auth
   - Set `auth_mode: "api-token"`
   - Provide `username` and `api_token`

## 🚀 Setup Steps

### 1. Build the Project

```bash
npm install
npm run build
```

### 2. Test Authentication

```bash
# Test GitHub OAuth
npm run test-auth

# Test Jenkins (after configuring)
npm run start:jenkins
# (Check logs for connection status)
```

### 3. Configure Cursor IDE

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "github-oauth": {
      "command": "node",
      "args": ["/absolute/path/to/gh-mcp-server-oauth/dist/index.js"],
      "disabled": false
    },
    "jenkins-oauth": {
      "command": "node",
      "args": ["/absolute/path/to/gh-mcp-server-oauth/dist/jenkins-server.js"],
      "disabled": false
    }
  }
}
```

### 4. Restart Cursor

Both MCP servers will now be available in Cursor!

## 💡 Usage Examples

### Complete DevOps Workflow

**Scenario: Fix a bug, commit, push, and deploy**

```
User to Cursor: "I need to fix the authentication bug in auth.ts,
commit it, create a PR, and trigger a deployment build"

Cursor will:
1. Use GitHub MCP → Get file contents (auth.ts)
2. Make the fix
3. Use GitHub MCP → Commit and push changes
4. Use GitHub MCP → Create pull request
5. Use Jenkins MCP → Trigger deployment build
6. Use Jenkins MCP → Monitor build status
```

### Example Conversations

**1. Code → Commit → Build → Deploy:**

```
👤 User: "Update the API version in config.js to 2.0,
         commit it, and trigger a production build"

🤖 Cursor:
   [Uses github-oauth server]
   ✓ Updated config.js with version 2.0
   ✓ Committed: "Update API version to 2.0"
   ✓ Pushed to main branch

   [Uses jenkins-oauth server]
   ✓ Triggered build: production-deploy
   ✓ Build #142 started
   ✓ Status: Running...
```

**2. Check Build Status:**

```
👤 User: "What's the status of the latest production build?"

🤖 Cursor:
   [Uses jenkins-oauth server]
   ✓ Job: production-deploy
   ✓ Build #142
   ✓ Status: SUCCESS
   ✓ Duration: 5m 32s
   ✓ Deployed at: 2024-01-15 14:30:00
```

**3. Full CI/CD Pipeline:**

```
👤 User: "Create a feature branch for user-dashboard,
         update the dashboard component, commit,
         create a PR, and trigger the test build"

🤖 Cursor:
   [Uses github-oauth server]
   ✓ Created branch: feature/user-dashboard
   ✓ Updated dashboard component
   ✓ Committed changes
   ✓ Pushed to feature/user-dashboard
   ✓ Created PR #123: "Add user dashboard feature"

   [Uses jenkins-oauth server]
   ✓ Triggered job: test-suite
   ✓ Build #89 running

   Monitoring build...
   ✓ Tests passed (142/142)
   ✓ Build SUCCESS

   PR #123 is ready for review!
```

**4. Rollback Scenario:**

```
👤 User: "The latest production build failed.
         Trigger a rollback to the previous version"

🤖 Cursor:
   [Uses jenkins-oauth server]
   ✓ Triggering: rollback-to-previous
   ✓ Build #143 started
   ✓ Rolling back to build #141
   ✓ Deployment successful
   ✓ Status: LIVE on production
```

## 🛠️ Available Tools

### GitHub MCP Tools

- `list_repositories` - List your repos
- `get_file_contents` - Read files
- `create_or_update_file` - Commit changes
- `create_issue` - Create issues
- `create_pull_request` - Create PRs
- `list_pull_requests` - List PRs
- `search_code` - Search code

### Jenkins MCP Tools

- `jenkins_list_jobs` - List all Jenkins jobs
- `jenkins_get_job` - Get job details
- `jenkins_trigger_build` - Trigger a build
- `jenkins_get_build` - Get build details
- `jenkins_get_last_build` - Get last build
- `jenkins_get_build_console` - View console output
- `jenkins_stop_build` - Stop a running build
- `jenkins_get_queue` - View build queue
- `jenkins_get_system_info` - Jenkins system info

## 🔐 Security

### Shared OAuth Token

Both servers use the **same GitHub OAuth token**:

- **Stored once** in `~/.github-mcp-oauth/credentials`
- **Encrypted** with AES-256-GCM
- **Shared** between GitHub and Jenkins (if using GitHub OAuth Plugin)

### Token Flow

```
1. User authenticates via OAuth Device Flow
2. Token stored encrypted
3. GitHub MCP Server reads token → Calls GitHub API
4. Jenkins MCP Server reads token → Calls Jenkins API (if GitHub OAuth)
5. Jenkins validates token with GitHub
6. Access granted to both services
```

### Best Practices

1. **Use GitHub OAuth Plugin in Jenkins** for single sign-on
2. **Minimal Scopes**: Only request what you need
3. **Audit Access**: Review authorized apps regularly
4. **Rotate Tokens**: Re-authenticate periodically
5. **Secure Jenkins**: Use HTTPS, keep Jenkins updated

## 🔄 Workflow Patterns

### Pattern 1: Continuous Deployment

```
Code Change → Commit → Push → PR → Tests → Merge → Deploy

Tools used:
- create_or_update_file (GitHub)
- create_pull_request (GitHub)
- jenkins_trigger_build (Jenkins - tests)
- jenkins_trigger_build (Jenkins - deploy)
```

### Pattern 2: Hotfix

```
Fix → Commit → Push → Emergency Deploy → Monitor

Tools used:
- create_or_update_file (GitHub)
- jenkins_trigger_build (Jenkins - hotfix-deploy)
- jenkins_get_build_console (Jenkins - monitor)
```

### Pattern 3: Release Management

```
Tag Release → Build → Test → Deploy → Verify

Tools used:
- create_pull_request (GitHub - release PR)
- jenkins_trigger_build (Jenkins - release build)
- jenkins_get_last_build (Jenkins - verify)
```

## 🐛 Troubleshooting

### Jenkins Connection Failed

**Check:**
1. Jenkins URL in config is correct
2. Jenkins is accessible from your machine
3. Auth mode matches your Jenkins setup

```bash
# Test Jenkins connectivity
curl -I https://your-jenkins.com
```

### GitHub OAuth Not Working with Jenkins

**Ensure:**
1. GitHub OAuth Plugin installed in Jenkins
2. Same OAuth app used for both
3. OAuth app has correct callback URL

### Build Trigger Failed

**Verify:**
1. Job name is correct (case-sensitive)
2. User has permission to trigger builds
3. Job accepts remote triggers

## 📊 Example Cursor Configuration

### Complete Setup

**`~/.cursor/mcp.json`:**

```json
{
  "mcpServers": {
    "github-oauth": {
      "command": "node",
      "args": [
        "/Users/you/projects/gh-mcp-server-oauth/dist/index.js"
      ],
      "env": {},
      "disabled": false
    },
    "jenkins-oauth": {
      "command": "node",
      "args": [
        "/Users/you/projects/gh-mcp-server-oauth/dist/jenkins-server.js"
      ],
      "env": {},
      "disabled": false
    }
  }
}
```

**`mcp-config.json`:**

```json
{
  "github": {
    "client_id": "Iv1.a1b2c3d4e5f6g7h8",
    "scopes": ["repo", "read:user"]
  },
  "jenkins": {
    "url": "https://jenkins.mycompany.com",
    "auth_mode": "github-oauth"
  }
}
```

## 🎯 Advanced Scenarios

### Multi-Environment Deployment

```
👤 User: "Deploy to staging, run tests, and if successful, deploy to production"

🤖 Cursor:
   [jenkins_trigger_build: deploy-staging]
   ✓ Staging deployed

   [jenkins_trigger_build: test-staging]
   ✓ Tests running... SUCCESS

   [jenkins_trigger_build: deploy-production]
   ✓ Production deployment started
   ✓ All services healthy
```

### Code Review + CI

```
👤 User: "Review the latest PR and check if CI passed"

🤖 Cursor:
   [list_pull_requests] - GitHub
   PR #456: "Add payment gateway"

   [jenkins_get_last_build: ci-pr-456]
   Build #789: SUCCESS
   - Unit tests: 245/245 passed
   - Integration: 89/89 passed
   - Coverage: 94.2%

   ✓ PR is ready to merge!
```

## 📚 Next Steps

1. **Set up GitHub OAuth App** (see SETUP.md)
2. **Configure Jenkins** with GitHub OAuth Plugin
3. **Update mcp-config.json** with both configurations
4. **Add to Cursor** via mcp.json
5. **Start building!** 🚀

## 🤝 Support

For issues:
- GitHub MCP: See README.md
- Jenkins integration: Check Jenkins logs
- OAuth issues: Review SECURITY.md

Happy automating! 🎉
