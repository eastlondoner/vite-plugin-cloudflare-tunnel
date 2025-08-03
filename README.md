# Cloudflare Tunnel Vite Plugin

A powerful Vite plugin that automatically creates and manages Cloudflare tunnels for local development. Expose your local dev server to the internet instantly with HTTPS, no port forwarding or complex setup required. Works seamlessly on Windows, macOS, and Linux.

[![npm version](https://badge.fury.io/js/vite-plugin-cloudflare-tunnel.svg)](https://badge.fury.io/js/vite-plugin-cloudflare-tunnel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> *Local code flows out*  
> *Through clouds to distant browsers*  
> *Dev magic happens*

## ✨ Features

- 🚀 **Zero Configuration** - Works out of the box with minimal setup
- ⚡ **Quick Tunnel Mode** - Instant public URLs without API tokens or custom domains
- 🔒 **Automatic HTTPS** - Secure connections via Cloudflare's SSL certificates  
- 🌐 **Public Access** - Share your local dev server with anyone, anywhere
- 🎯 **Smart DNS Management** - Automatically creates and manages DNS records
- 🔄 **Hot Reload Support** - Works seamlessly with Vite's development features
- 📝 **Comprehensive Logging** - Debug tunnel issues with configurable log levels
- 🖥️ **Cross-Platform** - Works on Windows, macOS, and Linux
- 🛡️ **Type Safe** - Full TypeScript support with proper type definitions

## 🚀 Quick Start

### Installation

```bash
npm install vite-plugin-cloudflare-tunnel --save-dev
```

### Quick Tunnel Mode (Recommended for Getting Started)

The fastest way to get a public URL for your local dev server:

```typescript
import { defineConfig } from 'vite';
import cloudflareTunnel from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    cloudflareTunnel() // No configuration needed!
  ]
});
```

```bash
npm run dev
```

That's it! You'll get a random `https://xyz.trycloudflare.com` URL instantly - no API token or setup required! 🎉

### Named Tunnel Mode (For Custom Domains)

For persistent URLs with your own domain:

1. **Add to your `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import cloudflareTunnel from 'vite-plugin-cloudflare-tunnel';

export default defineConfig({
  plugins: [
    cloudflareTunnel({
      hostname: 'dev.yourdomain.com', // Your desired public URL
      tunnelName: 'my-dev-tunnel',    // Unique name for this tunnel
    })
  ]
});
```

2. **Set your Cloudflare API token:**

```bash
# Environment variable
export CLOUDFLARE_API_KEY="your-api-token-here"
```

3. **Start development:**

```bash
npm run dev
```

Your local server is now accessible at `https://dev.yourdomain.com` 🎉

## 📋 Prerequisites

### For Quick Tunnel Mode
- **Node.js** 16.0.0 or higher
- That's it! No Cloudflare account or API token needed.

### For Named Tunnel Mode  
- **Cloudflare Account** with a domain added to your account
- **Cloudflare API Token** with the following permissions:
  - Account level: `Cloudflare Tunnel:Edit`
  - Zone level (for each domain): `SSL and Certificates:Edit`, `DNS:Edit`
- **Node.js** 16.0.0 or higher

## 🔑 Cloudflare API Token Setup

> **Note:** Only required for Named Tunnel Mode when a hostname is specified. Quick Tunnel Mode works without any API token.

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. We recommend using **Account tokens**, but Personal tokens can also be used
4. Configure the token with these permissions:

   **Account level permissions:**
   - `Cloudflare Tunnel:Edit`

   **Zone level permissions (for each zone/domain you want to use for tunnel hostnames):**
   - `SSL and Certificates:Edit`
   - `DNS:Edit`

   **Zone Resources:** Include - All zones (or specific zone)  
   **Account Resources:** Include - All accounts (or specific account)

5. Copy the generated token and configure it:
   ```bash
   # Option 1: Environment variable
   export CLOUDFLARE_API_KEY="your-token-here"
   
   # Option 2: Pass directly in your vite.config.ts:
   # cloudflareTunnel({ apiToken: "your-token-here", hostname: "dev.example.com" })
   ```

## 📦 Import Styles

This plugin supports both default and named imports:

```typescript
// Default import (recommended)
import cloudflareTunnel from 'vite-plugin-cloudflare-tunnel';

// Named import
import { cloudflareTunnel } from 'vite-plugin-cloudflare-tunnel';

// Both work the same way
export default defineConfig({
  plugins: [cloudflareTunnel({ hostname: 'dev.example.com', tunnelName: 'my-dev-tunnel' })]
});
```

## 🌐 Access Tunnel URL in Your App

Your application code can access the current tunnel URL at runtime using the virtual module:

```typescript
import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';

// In your app code
console.log('Public tunnel URL:', getTunnelUrl());

// Example: Share the URL with users
const shareButton = document.getElementById('share');
shareButton.onclick = () => {
  navigator.clipboard.writeText(getTunnelUrl());
  alert('Tunnel URL copied to clipboard!');
};
```

**Key Features:**
- 🔄 **Always Current** - Returns the active tunnel URL (updates automatically on port changes)
- 🚀 **Works in Both Modes** - Quick tunnel (random URL) and named tunnel (custom domain)
- ⚡ **Dev Only** - Virtual module is only available during development
- 🎯 **TypeScript Ready** - Full type support with proper imports

### TypeScript Setup

To use the virtual module with TypeScript, you need to reference the provided type definitions:

**Option 1: Add to your `tsconfig.json` (Recommended)**
```json
{
  "compilerOptions": {
    // ... your other options
    "types": [
      "vite/client",
      "vite-plugin-cloudflare-tunnel/virtual"
    ]
  }
}
```

**Option 2: Triple-slash directive in your TypeScript files**
```typescript
/// <reference types="vite-plugin-cloudflare-tunnel/virtual" />

import { getTunnelUrl } from 'virtual:vite-plugin-cloudflare-tunnel';
```

**Option 3: Manual type declaration**
If you prefer to declare the types yourself, create a `types/virtual-modules.d.ts` file:
```typescript
declare module 'virtual:vite-plugin-cloudflare-tunnel' {
  export function getTunnelUrl(): string;
}
```

The virtual module function is fully typed and includes JSDoc documentation for better IDE support.

## 🔀 Two Tunnel Modes

The plugin supports two distinct modes:

### 🚀 Quick Tunnel Mode
- **No configuration required** - Just add the plugin with no options
- **Random URL** - Gets a `https://xyz.trycloudflare.com` URL
- **No API token needed** - Works without Cloudflare account
- **Temporary** - URL changes on each restart
- **Perfect for**: Demos, quick sharing, development testing

### 🏠 Named Tunnel Mode  
- **Custom domain** - Use your own domain (e.g., `dev.example.com`)
- **Persistent URL** - Same URL every time
- **Unique tunnel name** - Give each project its own `tunnelName`; re-using the same name across multiple apps will cause them to share Cloudflare resources (tunnel, DNS records, SSL certificates) and lead to conflicts
- **Requires API token** - Needs Cloudflare account and API setup
- **DNS & SSL management** - Automatic domain and certificate handling
- **Perfect for**: Persistent development, staging environments

## ⚙️ Configuration Options

### Quick Tunnel Mode

```typescript
// Minimal - no options needed
cloudflareTunnel()

// With optional logging
cloudflareTunnel({
  port: 3000,                        // Optional: Local dev server port
  logFile: './cloudflared.log',      // Optional: Path to write logs
  logLevel: 'info',                  // Optional: debug, info, warn, error, fatal
  debug: true,                       // Optional: Extra verbose logging
})
```

### Named Tunnel Mode

```typescript
cloudflareTunnel({
  // Required: Your public hostname
  hostname: 'dev.example.com',
  
  // Optional: API token (can use CLOUDFLARE_API_KEY env var instead)
  apiToken: process.env.CLOUDFLARE_API_KEY,
  
  // Optional: Local dev server port (default: 5173)
  port: 5173,
  
  // Optional: Tunnel name (default: "vite-tunnel")
  tunnelName: 'my-dev-tunnel',
  
  // Optional: Custom DNS configuration
  dns: '*.example.com',              // Wildcard or exact hostname match
  
  // Optional: Custom SSL certificate configuration  
  ssl: '*.example.com',              // Wildcard or exact hostname match
  
  // Optional: Enable debug logging
  debug: true,                       // Extra verbose logging for troubleshooting
  
  // Optional: Logging configuration
  logFile: './cloudflared.log',      // Path to write logs to a file
  logLevel: 'debug',                 // Log level: debug, info, warn, error, fatal
  
  // Optional: Cloudflare account ID (auto-detected if omitted)
  accountId: 'your-account-id',
  
  // Optional: Cloudflare zone ID (auto-detected if omitted) 
  zoneId: 'your-zone-id',
  
  // Optional: Resource cleanup configuration
  cleanup: {
    autoCleanup: true,                 // Clean up mismatched resources on startup
  }
})
```

### Configuration Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hostname` | `string` | **Required** | The public hostname you want (e.g., `dev.example.com`) |
| `apiToken` | `string` | `process.env.CLOUDFLARE_API_KEY` | Cloudflare API token with tunnel permissions |
| `port` | `number` | `5173` | Local port your dev server runs on |
| `enabled` | `boolean` | `true` | When set to `false` the plugin is **disabled** — `cloudflared` will not be downloaded or started. The virtual module is still available but returns an empty string. Useful for temporarily switching off the tunnel without removing the plugin. |
| `tunnelName` | `string` | `"vite-tunnel"` | Unique name for the tunnel in your Cloudflare dashboard (letters, numbers, hyphens only). This name is applied to **all** Cloudflare resources the plugin creates (tunnel, DNS record comments, SSL certificate tags). If two apps share the same `tunnelName` they will overwrite each other's resources and conflict — always give each project its own tunnel name. |
| `dns` | `string` | `undefined` | Custom DNS record (wildcard like `*.example.com` or exact hostname match) |
| `ssl` | `string` | `undefined` | Custom SSL certificate (wildcard like `*.example.com` or exact hostname match) |
| `debug` | `boolean` | `false` | Enable extra debug logging for troubleshooting |
| `logFile` | `string` | `undefined` | Path to write cloudflared logs to a file |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` | `undefined` | Logging level for cloudflared |
| `accountId` | `string` | Auto-detected | Cloudflare account ID (optional) |
| `zoneId` | `string` | Auto-detected | Cloudflare zone ID (optional) |
| `cleanup` | `object` | `{}` | Resource cleanup configuration (see below) |

### Cleanup Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoCleanup` | `boolean` | `true` | Automatically clean up mismatched resources from current tunnel on startup |


## 🧹 Resource Management & Cleanup

The plugin automatically tags resources it creates and can clean up mismatched resources from previous runs or configuration changes. **By default, cleanup actively deletes mismatched resources** to prevent cloud resource accumulation.

### Automatic Resource Tagging

**DNS Records:** All DNS records created by the plugin include a comment field with metadata:
- Format: `vite-plugin-cloudflare-tunnel:tunnelName`
- Example: `vite-plugin-cloudflare-tunnel:vite-tunnel`

**SSL Certificates:** Since Cloudflare doesn't support metadata fields, the plugin adds a special "tag" hostname to certificates for identification:
- Format: `cf-tunnel-plugin-{tunnelName}-{date}.{parentDomain}`
- Example: `cf-tunnel-plugin-vitetunnel-20250127.api.example.com` (for hostname `dev.api.example.com`)

### Cleanup Configuration

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  cleanup: {
    // autoCleanup: true,                 // Enabled by default
  }
})

// To disable auto cleanup:
cloudflareTunnel({
  hostname: 'dev.example.com',
  cleanup: {
    autoCleanup: false                    // Disable automatic cleanup
  }
})
```

### How Cleanup Works

1. **Current Tunnel Only:** The plugin only cleans up resources created by the **current tunnel name**
2. **Configuration Mismatch Detection:** 
   - **DNS Records:** Finds records from current tunnel that don't match current hostname/target
   - **SSL Certificates:** Finds certificates from current tunnel that don't cover current hostname
3. **Safe Cleanup:** DNS records are deleted automatically by default, SSL certificates require manual review
4. **Preserves Other Tunnels:** Resources from different tunnel names are never touched
5. **No Resource Leaks:** Default behavior prevents accumulation of stale cloud resources

### Manual Cleanup

If you need to manually clean up resources:

1. **List DNS records by tunnel:**
   ```bash
   # Using Cloudflare API - replace 'your-tunnel-name' with actual tunnel name
   curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records?comment=vite-plugin-cloudflare-tunnel:your-tunnel-name&match=all" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
   ```

2. **Review SSL certificates:**
   ```bash
   # List all certificate packs
   curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/ssl/certificate_packs" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
   ```

## 🌐 DNS & SSL Configuration

The plugin provides advanced DNS and SSL management options for custom setups:

### DNS Configuration

Use the `dns` option to control DNS record creation:

```typescript
// Wildcard DNS - creates A and AAAA records for *.example.com
cloudflareTunnel({
  hostname: 'dev.example.com',
  dns: '*.example.com'  // Creates wildcard DNS records
})

// Exact hostname DNS - must match the hostname exactly
cloudflareTunnel({
  hostname: 'dev.example.com', 
  dns: 'dev.example.com'  // Creates specific DNS record
})
```

**Wildcard DNS (`*.example.com`):**
- Creates both A and AAAA records for the wildcard domain
- Allows any subdomain to resolve through Cloudflare
- Useful for multi-environment setups

**Exact hostname DNS:**
- Must exactly match the `hostname` option
- Creates a CNAME record pointing to the tunnel
- Default behavior when `dns` option is omitted

### SSL Certificate Configuration

Use the `ssl` option to control SSL certificate provisioning:

```typescript
// Wildcard SSL - requests *.example.com certificate
cloudflareTunnel({
  hostname: 'dev.example.com',
  ssl: '*.example.com'  // Requests wildcard certificate
})

// Exact hostname SSL - must match the hostname exactly  
cloudflareTunnel({
  hostname: 'dev.example.com',
  ssl: 'dev.example.com'  // Requests specific certificate
})
```

**Wildcard SSL (`*.example.com`):**
- Requests a wildcard edge certificate from Let's Encrypt
- Covers all subdomains under the domain
- Useful for development environments with multiple subdomains

**Exact hostname SSL:**
- Must exactly match the `hostname` option
- Requests a certificate for the specific hostname only

**Automatic SSL (default behavior):**
When no `ssl` option is provided, the plugin:
1. Checks for existing wildcard certificate covering the domain
2. If no wildcard exists, checks if Total TLS is enabled
3. If neither exists, requests a regular certificate for the hostname

#### SSL/TLS Scenarios & Recommendations

> These guidelines cover the most common SSL/TLS situations you might encounter when exposing local development servers through Cloudflare.

0. **First-level subdomains with Universal SSL**  
   For a simple subdomain such as `dev.example.com` Cloudflare’s free Universal SSL already includes a certificate that covers `*.example.com`.  
   👉 In this case **no extra certificate** needs to be created – the tunnel is ready as soon as it starts.

   ```typescript
   // Universal SSL already covers *.example.com so no ssl option is required
   cloudflareTunnel({
     hostname: 'dev.example.com'
   });
   ```

1. **Nested sub-domains without Advanced Certificate Management (ACM)**  
   If you attempt to use a hostname with more than one level of sub-domain (e.g. `api.dev.example.com`) Cloudflare requires an **Advanced Certificate** to cover that hostname.  
   Without ACM enabled the plugin cannot order that certificate, so stick to `dev.example.com`, `staging.example.com`, etc.  
   If you do have ACM you can use nested sub-domains freely – see point&nbsp;3 below.

2. **Total TLS support**  
   Cloudflare’s *Total TLS* (a feature inside ACM) automatically provisions certificates as soon as a DNS record is created.  
   The plugin detects when Total TLS is enabled and will use these certificates automatically so you don’t consume any of your ACM quota.  
   We highly recommend enabling Total TLS on development zones.

3. **Pre-provisioning a wildcard with the `ssl` option**  
   Ordering a brand-new certificate can take **3-10&nbsp;minutes**. If you regularly work with many nested sub-domains you can order **one wildcard certificate** upfront and share it between all your dev apps:

   ```typescript
   // Provision a single *.dev.example.com certificate
   cloudflareTunnel({
     hostname: 'api.dev.example.com',
    tunnelName: 'api-dev-tunnel',    // Unique name for this tunnel
     ssl: '*.dev.example.com'      // wildcard cert covers api.*, auth.*, etc.
   });
   ```

   Every tunnel that targets `*.dev.example.com` will be secured instantly without waiting or consuming additional ACM quota.

### Combined DNS & SSL Example

```typescript
cloudflareTunnel({
  hostname: 'api.dev.example.com',
  tunnelName: 'api-dev-tunnel',    // Unique name for this tunnel
  dns: '*.dev.example.com',      // Wildcard DNS for dev subdomains
  ssl: '*.dev.example.com',      // Wildcard SSL for dev subdomains
  debug: true                    // Enable debug logging
})
```

## 📝 Logging & Debugging

The plugin supports comprehensive logging to help debug tunnel issues:

### Log Levels

- `debug` - Most verbose, shows all tunnel activity
- `info` - General information about tunnel status  
- `warn` - Warning messages
- `error` - Error messages only
- `fatal` - Only fatal errors

### Example with Logging

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  logLevel: 'debug',
  logFile: './logs/cloudflared.log'
})
```

### What Gets Logged

- Tunnel connection status and health
- HTTP/TCP/UDP traffic flowing through the tunnel
- DNS resolution and routing information
- Performance metrics and latency data
- Error messages and debugging information

## 🛠️ How It Works

1. **Plugin Initialization** - When Vite starts, the plugin begins setup
2. **Binary Installation** - Downloads `cloudflared` binary if not present
3. **API Authentication** - Validates your Cloudflare API token
4. **Resource Discovery** - Finds your Cloudflare account and DNS zone
5. **Tunnel Creation** - Creates or reuses a Cloudflare tunnel
6. **DNS Configuration** - Sets up CNAME record pointing to the tunnel
7. **Connection Establishment** - Starts `cloudflared` daemon with secure token
8. **Process Management** - Registers cleanup handlers to ensure `cloudflared` is terminated when the parent process exits
9. **Ready!** - Your local server is now publicly accessible via HTTPS

### Process Cleanup

The plugin includes robust process management to prevent orphaned `cloudflared` processes:

- **Signal Handlers** - Listens for `SIGINT`, `SIGTERM`, `SIGQUIT`, and `SIGHUP` signals
- **Process Group Management** - Spawns `cloudflared` in the same process group for automatic cleanup
- **Exception Handling** - Cleans up on uncaught exceptions and unhandled rejections
- **Graceful Termination** - Attempts `SIGTERM` first, falls back to `SIGKILL` after timeout
- **Multiple Exit Points** - Handles Vite server shutdown, build completion, and process termination

## 📁 Examples

Check out the [`examples/`](./examples/) directory for complete working examples:

- **[Quick Tunnel Example](./examples/quick-tunnel-example/)** - Zero-config quick tunnel with random URL
- **[Basic Vite App](./examples/basic-vite-app/)** - Named tunnel with custom domain
- **[Discord Bot Webhook Receiver](./examples/discord-webhook-example/)** - Receive Discord bot interactions via webhooks

### Running Examples

**Quick Tunnel Example (No setup required):**
```bash
cd examples/quick-tunnel-example
npm install
npm run dev
# No API token needed - get instant public URL!
```

**Basic Vite App (Named tunnel):**
```bash
cd examples/basic-vite-app
npm install
cp .env.example .env
# Edit .env with your API token
npm run dev
```

**Discord Bot Webhook Receiver:**
```bash
cd examples/discord-webhook-example
npm install
cp env.example .env
# Edit .env with your Discord bot public key and Cloudflare API token
npm run dev
```

## 🐛 Troubleshooting

### Common Issues

**"Zone not found"**
- Ensure your domain is added to your Cloudflare account
- Verify the hostname matches a domain you own

**"API token invalid"**  
- Check your token has all required permissions
- Ensure the token isn't expired

**"Tunnel connection failed"**
- Check your internet connection
- Verify firewall isn't blocking the connection
- Try enabling debug logging: `logLevel: 'debug'`

**"tunnelName must contain only letters, numbers, and hyphens"**
- Tunnel names must be DNS-safe for use in comments and SSL certificate hostnames
- Valid: `my-tunnel`, `dev`, `tunnel123`
- Invalid: `my_tunnel`, `tunnel-`, `-tunnel`, `my.tunnel`

**TypeScript errors**
- Make sure the plugin is built: `npm run build`
- Check your `tsconfig.json` includes the plugin types

**Orphaned `cloudflared` processes**
- The plugin includes comprehensive cleanup handlers for all exit scenarios
- If you still see orphaned processes, they may be from previous versions or crashes
- Kill them manually: `pkill -f cloudflared` or `ps aux | grep cloudflared`
- Check if your process manager (PM2, Docker, etc.) is sending `SIGKILL` instead of `SIGTERM`

### Debug Mode

Enable verbose logging to diagnose issues:

```typescript
cloudflareTunnel({
  hostname: 'dev.example.com',
  debug: true,                    // Enable extra debug logging
  logLevel: 'debug',              // Set cloudflared log level  
  logFile: './debug.log'          // Write logs to file
})
```

**Debug Options:**
- `debug: true` - Enables extra plugin debug logging with `[cloudflare-tunnel:debug]` prefix
- `logLevel: 'debug'` - Sets the cloudflared process log level to debug
- `logFile` - Writes all cloudflared logs to a file for analysis

## 🔒 Security Considerations

- **API Token Security** - Never commit API tokens to version control
- **Environment Variables** - Store tokens in `.env` files (add to `.gitignore`)
- **Token Logging** - The plugin never logs your API token in debug output for security

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/eastlondoner/vite-plugin-cloudflare-tunnel.git
   cd vite-plugin-cloudflare-tunnel
   ```