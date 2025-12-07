# Setup Guide: GitHub OAuth App Registration

This guide walks you through creating a GitHub OAuth App to get the `client_id` needed for this MCP server.

## Why OAuth App?

GitHub OAuth Device Flow requires an OAuth App (not a GitHub App). OAuth Apps are simpler and perfect for this use case where we need to authenticate users without a web redirect.

## Step 1: Create GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:

   - **Application name**: `GitHub MCP Server` (or any name you prefer)
   - **Homepage URL**: `http://localhost:3000` (or your preferred URL)
   - **Authorization callback URL**: `http://localhost:3000/callback` (required but not used in Device Flow)
   - **Application description**: (Optional) "MCP server for GitHub integration"

4. Click **"Register application"**

## Step 2: Get Your Client ID

After creating the OAuth App:

1. You'll see your **Client ID** on the app settings page
2. Copy this Client ID - you'll need it for configuration

**IMPORTANT**:
- You do **NOT** need to generate or use the Client Secret for OAuth Device Flow
- The Client ID is not sensitive and can be committed to configuration (though we gitignore config files to be safe)

## Step 3: Configure the MCP Server

1. Create your configuration file:

   ```bash
   cp mcp-config.example.json mcp-config.json
   ```

2. Edit `mcp-config.json` and paste your Client ID:

   ```json
   {
     "github": {
       "client_id": "Iv1.your_client_id_here",
       "scopes": [
         "repo",
         "read:user",
         "read:org"
       ]
     }
   }
   ```

3. Customize scopes if needed (see [Available Scopes](#available-scopes) below)

## Step 4: Build and Run

```bash
npm install
npm run build
npm start
```

You should see the OAuth Device Flow authentication screen!

## Available Scopes

Choose only the scopes you need. Here are common options:

### Repository Access
- `repo` - Full control of private repositories
- `public_repo` - Access to public repositories only

### User Information
- `read:user` - Read user profile data
- `user:email` - Access user email addresses

### Organization Access
- `read:org` - Read organization membership and data
- `write:org` - Manage organization membership

### Gists
- `gist` - Create and manage gists

### Notifications
- `notifications` - Access notifications

See [all available scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) in GitHub documentation.

## Security Notes

### What's Safe to Share

✅ **Client ID**: Safe to share, can be public
✅ **OAuth App Name**: Public information
✅ **Scopes**: Public information

### What to NEVER Share

❌ **Client Secret**: Keep private (though not used in Device Flow)
❌ **Access Tokens**: Generated during authentication, stored in OS credential manager
❌ **Refresh Tokens**: Stored securely, never share

## Troubleshooting

### "Invalid client_id"

**Solution**: Double-check your Client ID in `mcp-config.json`. It should start with `Iv1.` for OAuth Apps.

### Can't find OAuth Apps in Settings

**Solution**: Make sure you're in your personal GitHub settings, not organization settings:
- Go to: https://github.com/settings/developers
- Select "OAuth Apps" (not "GitHub Apps")

### OAuth App vs GitHub App?

For this MCP server, use **OAuth App**. Here's why:

| Feature | OAuth App | GitHub App |
|---------|-----------|------------|
| Device Flow | ✅ Supported | ❌ Not supported |
| Setup Complexity | Simple | Complex |
| User Authentication | ✅ Yes | Limited |
| Best For | User access, Device Flow | Bot/automation, webhooks |

### Rate Limiting

OAuth Apps have the following rate limits:

- **Authenticated requests**: 5,000 requests/hour
- **Unauthenticated requests**: 60 requests/hour

For most use cases, 5,000/hour is more than sufficient.

### Updating Scopes

To change scopes:

1. Edit `mcp-config.json` and update the `scopes` array
2. Delete stored credentials (force re-authentication):

   **macOS**:
   ```bash
   security delete-generic-password -s "github-mcp-oauth" -a "github-access-token"
   ```

   **Windows**: Credential Manager → Delete "github-mcp-oauth"

   **Linux**:
   ```bash
   secret-tool clear service github-mcp-oauth
   ```

3. Run the server again - it will re-authenticate with new scopes

## Next Steps

After setup:

1. ✅ OAuth App created
2. ✅ Client ID added to config
3. ✅ Server built and running
4. ✅ Authentication successful

Now you can:

- Add this server to your MCP client (like Claude Desktop)
- Use GitHub tools through the MCP protocol
- Enjoy secure, credential-free GitHub integration!

## Additional Resources

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps)
- [OAuth Device Flow Spec](https://www.rfc-editor.org/rfc/rfc8628)
- [GitHub REST API](https://docs.github.com/en/rest)
