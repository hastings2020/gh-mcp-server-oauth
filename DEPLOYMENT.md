# Deployment & Implementation Notes

## Token Storage Implementation

This GitHub MCP server uses **encrypted file-based token storage** as a cross-platform solution that works in all environments without native dependencies.

### Why Not OS Credential Managers?

The ideal implementation uses OS-native credential managers (Keychain/Credential Manager/libsecret) via the `keytar` package. However, `keytar` requires:

- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools
- **Linux**: `libsecret-1-dev` package

In many environments (CI/CD, containers, sandboxed systems), these dependencies are not available.

### Our Secure Alternative

Instead, we use **AES-256-GCM encryption** with machine-specific keys to securely store tokens locally.

#### Security Features

1. **AES-256-GCM Encryption**: Industry-standard authenticated encryption
2. **Machine-Specific Keys**: Derived from hostname/computer name
3. **Restricted File Permissions**: 0600 (owner read/write only)
4. **Isolated Storage**: `~/.github-mcp-oauth/credentials`
5. **No Plaintext Tokens**: Tokens never written in cleartext

#### Storage Location

```
~/.github-mcp-oauth/
└── credentials  (encrypted, mode 0600)
```

This directory is:
- ✅ **Gitignored** - never committed to version control
- ✅ **Encrypted** - AES-256-GCM with auth tags
- ✅ **Restricted** - 0600 permissions (owner only)
- ✅ **Isolated** - separate from project directory

### Encryption Details

```typescript
Algorithm: AES-256-GCM
Key Derivation: scrypt(machineId, salt, 32 bytes)
IV: Random 16 bytes per encryption
Auth Tag: 16 bytes (authenticated encryption)
Format: iv:authTag:encryptedData (hex encoded)
```

### Security Comparison

| Feature | OS Credential Manager (keytar) | Encrypted File (our approach) |
|---------|-------------------------------|------------------------------|
| Cross-platform | ✅ Yes (with native deps) | ✅ Yes (no deps) |
| Encryption | ✅ OS-native | ✅ AES-256-GCM |
| Key Storage | ✅ OS keychain | ⚠️ Machine-derived |
| GUI Integration | ✅ Keychain Access, etc. | ❌ CLI only |
| Zero Dependencies | ❌ Requires libsecret/etc. | ✅ Node.js built-ins |
| Container-Friendly | ❌ Needs system packages | ✅ Works anywhere |
| Production-Ready | ✅ Ideal for desktop | ✅ Ideal for servers |

## Upgrading to Keytar (Optional)

If you're deploying to a desktop environment with native build tools, you can upgrade to keytar:

### 1. Install System Dependencies

**macOS**:
```bash
xcode-select --install
```

**Ubuntu/Debian**:
```bash
sudo apt-get install libsecret-1-dev
```

**Fedora**:
```bash
sudo dnf install libsecret-devel
```

**Windows**:
- Install Visual Studio Build Tools

### 2. Add Keytar Dependency

```bash
npm install keytar
```

### 3. Update Token Storage Module

Replace `src/auth/token-storage.ts` with the keytar implementation (see [KEYTAR-IMPLEMENTATION.md](./KEYTAR-IMPLEMENTATION.md) for code).

### 4. Rebuild

```bash
npm run clean
npm run build
```

## Environment Variables

The server supports these optional environment variables:

```bash
# Override client ID (alternative to mcp-config.json)
GITHUB_CLIENT_ID=Iv1.your_client_id

# Override storage location (advanced)
GITHUB_MCP_CREDENTIALS_DIR=/custom/path
```

## Deployment Scenarios

### 1. Desktop Development (Recommended: keytar)

Best for:
- macOS/Windows/Linux desktops
- Developer machines
- Long-term token storage

Setup:
1. Install system dependencies
2. `npm install keytar`
3. Update token-storage.ts to use keytar

### 2. Server/Container Deployment (Current: encrypted file)

Best for:
- Docker containers
- CI/CD pipelines
- Cloud deployments
- Sandboxed environments

Setup:
- No changes needed - works out of the box!

### 3. Ephemeral Environments

For short-lived processes:
- Authenticate once per session
- Tokens stored for session duration
- Automatic cleanup on container termination

## Security Best Practices

### File-Based Storage (Current Implementation)

1. **Protect Home Directory**: Ensure `~/.github-mcp-oauth/` has proper ownership
2. **Monitor Access**: Only the user running the server should access credentials
3. **Container Considerations**: Mount `~/.github-mcp-oauth/` as a volume for persistence
4. **Backup Carefully**: If backing up home directory, exclude credentials or re-encrypt

### Keytar Storage (Optional Upgrade)

1. **Lock Your System**: OS credential managers are only as secure as your login
2. **Use Full Disk Encryption**: FileVault (macOS), BitLocker (Windows), LUKS (Linux)
3. **Regular Security Updates**: Keep OS and keychain software updated

## Docker Deployment

Example Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no native deps needed!)
RUN npm install

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create credentials directory
RUN mkdir -p /root/.github-mcp-oauth && chmod 700 /root/.github-mcp-oauth

# Run server
CMD ["npm", "start"]
```

With persistent storage:

```bash
docker run -it \
  -v github-oauth-creds:/root/.github-mcp-oauth \
  -v $(pwd)/mcp-config.json:/app/mcp-config.json:ro \
  github-mcp-oauth
```

## Kubernetes Deployment

Example deployment with secret storage:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: github-oauth-creds
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: github-mcp-oauth
spec:
  replicas: 1
  selector:
    matchLabels:
      app: github-mcp-oauth
  template:
    metadata:
      labels:
        app: github-mcp-oauth
    spec:
      containers:
      - name: server
        image: github-mcp-oauth:latest
        volumeMounts:
        - name: credentials
          mountPath: /root/.github-mcp-oauth
        - name: config
          mountPath: /app/mcp-config.json
          subPath: mcp-config.json
          readOnly: true
      volumes:
      - name: credentials
        persistentVolumeClaim:
          claimName: github-oauth-creds
      - name: config
        configMap:
          name: github-mcp-config
```

## Revoke Credentials

To revoke stored credentials:

```bash
# Delete encrypted credentials file
rm ~/.github-mcp-oauth/credentials

# Or delete entire directory
rm -rf ~/.github-mcp-oauth/
```

For keytar-based storage:

```bash
# macOS
security delete-generic-password -s "github-mcp-oauth" -a "github-access-token"

# Windows
# Control Panel → Credential Manager → Remove "github-mcp-oauth"

# Linux
secret-tool clear service github-mcp-oauth
```

## Monitoring & Logging

The server logs to stderr (not stdout, which is reserved for MCP protocol):

```bash
# Run with logging
npm start 2> server.log

# Monitor authentication
tail -f server.log | grep -E "(OAuth|Token|Authentication)"
```

## Troubleshooting

### "Invalid encrypted data format"

**Cause**: Credentials file corrupted or created on different machine

**Solution**:
```bash
rm ~/.github-mcp-oauth/credentials
npm start  # Re-authenticate
```

### Credentials not persisting

**Check**:
1. Directory exists and has correct permissions: `ls -la ~/.github-mcp-oauth/`
2. File has 0600 permissions: `stat ~/.github-mcp-oauth/credentials`
3. Running as same user: `whoami`

### Machine ID changes (e.g., hostname change)

**Symptom**: Can't decrypt existing credentials

**Solution**: Re-authenticate:
```bash
rm ~/.github-mcp-oauth/credentials
npm start
```

## Production Checklist

- [ ] Configuration file (`mcp-config.json`) created with OAuth client ID
- [ ] Configuration file **NOT** committed to git (in `.gitignore`)
- [ ] Credentials directory has 0700 permissions
- [ ] Credentials file (when created) has 0600 permissions
- [ ] Home directory has proper ownership
- [ ] System is secured with disk encryption
- [ ] OAuth app scopes follow principle of least privilege
- [ ] Monitoring/alerting set up for authentication failures
- [ ] Backup strategy excludes credentials or re-encrypts them

## Support & Updates

For issues or questions:
- Check [README.md](./README.md) for usage instructions
- See [SECURITY.md](./SECURITY.md) for security guidelines
- Review [SETUP.md](./SETUP.md) for OAuth app configuration

For upgrading to keytar in production, contact your system administrator to install required native dependencies.
