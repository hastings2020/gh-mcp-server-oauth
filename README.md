# GitHub MCP Server with OAuth Device Flow

A secure GitHub MCP (Model Context Protocol) server that uses OAuth Device Flow for authentication. **Zero hardcoded credentials** - all tokens are stored securely in your operating system's native credential manager.

## Features

- **Secure OAuth Device Flow Authentication**: No browser redirects needed
- **OS-Native Credential Storage**:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service API (libsecret)
- **Zero Hardcoded Credentials**: No tokens in code, config files, or environment variables
- **Automatic Token Management**: Checks for existing tokens, handles expiration
- **Comprehensive GitHub API Coverage**: Repos, issues, PRs, code search, and more

## Security Highlights

✅ **Tokens only in memory and OS credential store**
✅ **OAuth scopes follow principle of least privilege**
✅ **No tokens in logs or config files**
✅ **Automatic re-authentication when tokens expire**
❌ **No tokens committed to git**
❌ **No plaintext token storage**

## Prerequisites

- Node.js 18 or higher
- A GitHub account
- GitHub OAuth App credentials (see [Setup Guide](./SETUP.md))

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd gh-mcp-server-oauth
npm install
```

### 2. Create GitHub OAuth App

Follow the [Setup Guide](./SETUP.md) to create a GitHub OAuth App and get your `client_id`.

### 3. Configure

Copy the example configuration and add your OAuth app client ID:

```bash
cp mcp-config.example.json mcp-config.json
```

Edit `mcp-config.json`:

```json
{
  "github": {
    "client_id": "your_oauth_app_client_id_here",
    "scopes": [
      "repo",
      "read:user",
      "read:org"
    ]
  }
}
```

**IMPORTANT**: `mcp-config.json` is gitignored and should NEVER contain tokens, only the OAuth app client ID.

### 4. Build

```bash
npm run build
```

### 5. Run

```bash
npm start
```

On first run, you'll see:

```
╔══════════════════════════════════════════════════════════════╗
║            GitHub OAuth Device Flow Authentication           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Visit: https://github.com/login/device                   ║
║                                                              ║
║  2. Enter code: XXXX-XXXX                                    ║
║                                                              ║
║  3. Authorize the application                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

After authorization, your token is securely stored and the server is ready!

## Available Tools

The MCP server provides these GitHub tools:

### Repository Operations
- `list_repositories` - List your repositories
- `get_repository` - Get repository details
- `get_file_contents` - Read file contents
- `create_or_update_file` - Create or update files

### Issues
- `list_issues` - List repository issues
- `create_issue` - Create new issues
- `update_issue` - Update existing issues

### Pull Requests
- `list_pull_requests` - List pull requests
- `create_pull_request` - Create new pull requests

### Search
- `search_code` - Search code across GitHub
- `search_repositories` - Search for repositories

### User
- `get_user_info` - Get authenticated user information

## Configuration

### OAuth Scopes

The default scopes are:

- `repo` - Full control of private repositories
- `read:user` - Read user profile data
- `read:org` - Read organization membership

You can customize scopes in `mcp-config.json` based on your needs. See [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) for all available scopes.

### Token Management

**Check token status:**
```bash
# Tokens are stored securely in your OS credential manager
# No command-line access needed - authentication happens automatically
```

**Re-authenticate (revoke and get new token):**
```typescript
// In code, you can revoke tokens:
import { revokeTokens } from './auth/oauth.js';
await revokeTokens();
```

## How It Works

1. **First Run**: No tokens found → OAuth Device Flow starts automatically
2. **Subsequent Runs**: Valid token found in OS credential manager → Use stored token
3. **Token Expired**: Detects expiration → Triggers re-authentication
4. **Manual Revocation**: Delete tokens from credential manager → Re-authenticate on next run

## Development

### Build and Watch

```bash
npm run watch
```

### Run in Development

```bash
npm run dev
```

### Clean Build

```bash
npm run clean
npm run build
```

## Troubleshooting

### "Configuration file not found"

Make sure `mcp-config.json` exists in the project root:

```bash
cp mcp-config.example.json mcp-config.json
# Edit and add your client_id
```

### "Failed to request device code"

Check that your `client_id` in `mcp-config.json` is correct and matches your GitHub OAuth App.

### "Device code expired"

The user code expires after 15 minutes. Start a new authentication flow:

```bash
npm start
```

### Token Storage Issues

**macOS**: Ensure Keychain Access is working
**Windows**: Check Credential Manager in Control Panel
**Linux**: Ensure `libsecret` is installed:

```bash
# Ubuntu/Debian
sudo apt-get install libsecret-1-dev

# Fedora
sudo dnf install libsecret-devel

# Arch
sudo pacman -S libsecret
```

### Re-authenticate

To force re-authentication, delete stored credentials:

**macOS**:
```bash
security delete-generic-password -s "github-mcp-oauth" -a "github-access-token"
```

**Windows**: Open Credential Manager → Remove "github-mcp-oauth" entries

**Linux**:
```bash
secret-tool clear service github-mcp-oauth
```

## Security Best Practices

1. **Never commit `mcp-config.json`** if it contains any sensitive data (it's gitignored by default)
2. **Only share your OAuth App `client_id`** (never share client secret if using OAuth Apps)
3. **Use minimal OAuth scopes** required for your use case
4. **Regularly rotate tokens** by revoking and re-authenticating
5. **Keep dependencies updated** to get security patches

## Architecture

```
src/
├── auth/
│   ├── oauth.ts          # OAuth Device Flow implementation
│   └── token-storage.ts  # OS credential manager integration
├── github/
│   └── client.ts         # GitHub API client wrapper
├── config.ts             # Configuration loader
└── index.ts              # MCP server implementation
```

## Contributing

Contributions are welcome! Please ensure:

- No credentials are hardcoded
- All secrets use OS credential manager
- Tests pass (when implemented)
- Documentation is updated

## License

MIT

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
