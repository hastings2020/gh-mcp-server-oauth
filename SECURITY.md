# Security Documentation

This document explains the security architecture and best practices for the GitHub MCP Server with OAuth Device Flow.

## Security Architecture

### No Hardcoded Credentials

**Problem**: Traditional approaches often hardcode API tokens in:
- Environment variables (`.env` files)
- Configuration files (`config.json`)
- Source code
- CI/CD secrets

**Our Solution**:
- ✅ OAuth Device Flow for dynamic authentication
- ✅ OS-native credential storage for tokens
- ✅ Zero credentials in code or config files
- ✅ Automatic token refresh and re-authentication

### Secure Token Storage

Tokens are stored exclusively in OS-native credential managers:

#### macOS: Keychain
- **Location**: System Keychain (encrypted)
- **Access**: Protected by system keychain APIs
- **Encryption**: AES-128 (or better, depending on macOS version)
- **View**: Keychain Access app → Search "github-mcp-oauth"

#### Windows: Credential Manager
- **Location**: Windows Credential Store
- **Access**: Protected by Windows DPAPI (Data Protection API)
- **Encryption**: User-specific encryption
- **View**: Control Panel → Credential Manager → Windows Credentials

#### Linux: Secret Service API (libsecret)
- **Location**: Secret Service daemon (gnome-keyring, kwallet, etc.)
- **Access**: D-Bus Secret Service API
- **Encryption**: Provider-dependent (typically AES)
- **View**: Seahorse (GNOME), KWalletManager (KDE)

### What's Stored Where

| Data Type | Storage Location | Sensitive? | Encrypted? |
|-----------|-----------------|------------|------------|
| Client ID | `mcp-config.json` | No | No (not needed) |
| OAuth Scopes | `mcp-config.json` | No | No (not needed) |
| Access Token | OS Credential Manager | **YES** | **YES** |
| Refresh Token | OS Credential Manager | **YES** | **YES** |
| Token Expiry | OS Credential Manager | No | Yes (stored with tokens) |

## OAuth Device Flow Security

### Why Device Flow?

The OAuth Device Flow (RFC 8628) is designed for:
- Devices without web browsers
- CLI applications
- Scenarios where redirect URIs aren't practical

**Benefits**:
- No client secret required (public client)
- No redirect URI vulnerabilities
- User explicitly authorizes each session
- Works in headless environments

### Flow Security

1. **Device Code Request**: Public, no secrets sent
2. **User Code Display**: User manually enters code at GitHub
3. **Polling**: Server polls GitHub, no sensitive data exposed
4. **Token Exchange**: Happens server-side, token immediately stored securely

### Attack Surface

| Attack Vector | Mitigation |
|--------------|------------|
| Token theft from disk | ✅ Tokens never written to disk in plaintext |
| Token in logs | ✅ Logging excludes sensitive data |
| Token in version control | ✅ Config files gitignored, no tokens in code |
| Man-in-the-middle | ✅ All OAuth requests use HTTPS |
| Token exposure in memory | ⚠️ Mitigated by short-lived processes |
| Credential manager compromise | ⚠️ Requires system-level access |

## Best Practices

### For Users

1. **Minimal Scopes**: Only request GitHub scopes you actually need
   ```json
   {
     "scopes": ["public_repo", "read:user"]  // Avoid "repo" if you only need public
   }
   ```

2. **Regular Re-authentication**: Periodically revoke and re-authenticate
   ```bash
   # Force re-auth by clearing credentials
   security delete-generic-password -s "github-mcp-oauth" -a "github-access-token"
   ```

3. **Monitor GitHub Access**: Check [GitHub → Settings → Applications](https://github.com/settings/applications) for active OAuth authorizations

4. **Revoke Unused Access**: If you stop using the server, revoke the OAuth app authorization on GitHub

### For Developers

1. **Never Log Tokens**:
   ```typescript
   // ❌ NEVER
   console.log('Token:', token);

   // ✅ ALWAYS
   console.error('✓ Token stored securely');
   ```

2. **Use stderr for Status Messages**: stdout is for MCP protocol, stderr for user messages

3. **Validate Input**: Sanitize all parameters before GitHub API calls

4. **Handle Errors Gracefully**: Don't expose sensitive info in error messages
   ```typescript
   // ❌ BAD
   throw new Error(`Auth failed with token ${token}`);

   // ✅ GOOD
   throw new Error('Authentication failed. Please re-authenticate.');
   ```

5. **Keep Dependencies Updated**:
   ```bash
   npm audit
   npm update
   ```

## Credential Lifecycle

### 1. First Run (No Credentials)

```
User runs server
  ↓
No tokens in credential manager
  ↓
OAuth Device Flow initiated
  ↓
User authorizes on GitHub
  ↓
Access token received
  ↓
Token stored in OS credential manager
  ↓
Server ready
```

### 2. Subsequent Runs (Valid Token)

```
User runs server
  ↓
Token found in credential manager
  ↓
Token expiry checked
  ↓
Token still valid
  ↓
Server ready (no re-auth needed)
```

### 3. Expired Token

```
User runs server
  ↓
Token found but expired
  ↓
Old token deleted
  ↓
OAuth Device Flow re-initiated
  ↓
New token stored
  ↓
Server ready
```

### 4. Manual Revocation

```
User revokes on GitHub
  ↓
Next API call fails with 401
  ↓
Error handled gracefully
  ↓
User prompted to re-authenticate
  ↓
OAuth Device Flow re-initiated
```

## Compliance & Standards

### Standards Followed

- ✅ **OAuth 2.0 Device Authorization Grant** (RFC 8628)
- ✅ **HTTPS for all GitHub API calls**
- ✅ **Principle of Least Privilege** (minimal scopes)
- ✅ **Defense in Depth** (multiple security layers)

### Security Checklist

- [x] No tokens in source code
- [x] No tokens in configuration files
- [x] No tokens in environment variables committed to git
- [x] Tokens encrypted at rest (OS credential manager)
- [x] Tokens encrypted in transit (HTTPS)
- [x] No tokens in logs
- [x] Graceful error handling
- [x] Token expiry validation
- [x] Automatic re-authentication
- [x] Dependency security updates
- [x] .gitignore protects sensitive files

## Incident Response

### If Token is Compromised

1. **Immediately revoke on GitHub**:
   - Go to https://github.com/settings/applications
   - Find your OAuth App
   - Click "Revoke"

2. **Delete local credentials**:
   ```bash
   # macOS
   security delete-generic-password -s "github-mcp-oauth" -a "github-access-token"
   ```

3. **Re-authenticate with new token**:
   ```bash
   npm start
   ```

4. **Review GitHub audit log** for unauthorized activity:
   - https://github.com/settings/security-log

### If OAuth App is Compromised

1. **Delete the OAuth App** on GitHub
2. **Create new OAuth App** with new Client ID
3. **Update configuration** with new Client ID
4. **All users must re-authenticate**

## Auditing

### Token Storage Audit

**macOS**:
```bash
security find-generic-password -s "github-mcp-oauth" -g
```

**Linux**:
```bash
secret-tool lookup service github-mcp-oauth account github-access-token
```

### GitHub Access Audit

Check authorized applications:
```
https://github.com/settings/applications
```

Review security log:
```
https://github.com/settings/security-log
```

## Security Updates

When security vulnerabilities are found:

1. **Update dependencies**:
   ```bash
   npm audit fix
   ```

2. **Review GitHub Security Advisories**:
   - Check https://github.com/advisories

3. **Monitor MCP SDK updates**:
   - Watch https://github.com/modelcontextprotocol/sdk

4. **Test after updates**:
   ```bash
   npm run build
   npm start
   # Verify OAuth flow works
   ```

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email the maintainer privately
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Additional Resources

- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
