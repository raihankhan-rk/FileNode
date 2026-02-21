# FileNode

Ultra-lightweight local file server that exposes your file system as HTTP endpoints. Built for AI agents and automation tools that need seamless file access without SSH complexity.

## Connect Your OpenClaw Bot to Your Files

**Option A -- Node Pairing (recommended, no tokens in chat)**

```
1. Install & start       →  filenode start --gateway localhost:18789
2. Approve the pairing   →  openclaw nodes approve (on your gateway)
3. Done. Your agent can now access files through the secure channel.
```

No tokens, no tunneling, no copy-pasting credentials. FileNode registers as a node on your OpenClaw Gateway and the agent invokes file commands directly.

**Option B -- HTTP + Tunnel**

```
1. Install & start       →  filenode start
2. Tunnel the port       →  ngrok http 3333
3. Give your bot:
     API URL  →  https://abc123.ngrok.io
4. Done. Your bot can now browse, read, and write files on your machine.
```

The bot hits `GET /` and gets a full self-documenting API response -- every endpoint, query parameter, and usage tip -- plus a listing of your directories. No authentication needed.

## Features

- **Fast** -- Hono.js + Bun runtime, sub-5ms response times
- **Secure** -- Path traversal prevention, rate limiting, security headers, configurable path allowlist
- **Simple** -- Single command to start, auto-generates config
- **Full CRUD** -- Read, write, append, delete files and directories
- **Streaming** -- Large file support with streaming responses
- **Smart paths** -- Fuzzy whitespace matching handles macOS screenshot filenames and other Unicode edge cases
- **Self-documenting** -- `GET /` returns full API docs, tips, and directory listing so bots can figure out usage on their own
- **Cross-platform** -- Works on macOS, Linux, and Windows
- **OpenClaw Node** -- Connects directly to the OpenClaw Gateway as a paired node, no credentials in chat

## Quick Start

```bash
# Install
bun add -g filenode-server

# Or clone and run directly
git clone https://github.com/raihankhan/filenode.git
cd filenode
bun install
bun link && bun link filenode-server

# Start the server
filenode start
```

On first run, FileNode generates a config file at `~/.filenode/config.json` with default settings.

## Exposing Your Server (Tunneling)

FileNode runs on `localhost:3333` by default. To let a cloud-based AI bot access it, you need to expose it via a tunnel. Here are some options:

### Option 1: ngrok (Recommended)

The fastest way to get a public URL. Free tier works fine.

```bash
# Install ngrok (if you don't have it)
brew install ngrok     # macOS
# or: snap install ngrok  # Linux
# or: choco install ngrok # Windows

# Sign up and add your auth token (one-time)
ngrok config add-authtoken <your-ngrok-token>

# Expose FileNode
ngrok http 3333
```

ngrok gives you a public URL like `https://abc123.ngrok-free.app`. Give this URL to your bot.

### Option 2: Cloudflare Tunnel

Free, no account limits, and you get a `trycloudflare.com` URL without signing up.

```bash
# Install cloudflared
brew install cloudflared   # macOS
# or: sudo apt install cloudflared  # Linux

# Quick tunnel (no account needed)
cloudflared tunnel --url http://localhost:3333
```

This gives you a URL like `https://random-words.trycloudflare.com`.

### Option 3: SSH Port Forwarding

If you have a VPS or remote server with a public IP:

```bash
# Forward remote port 3333 to your local FileNode
ssh -R 3333:localhost:3333 user@your-server.com
```

Then your bot hits `http://your-server.com:3333`.

### Option 4: Tailscale / ZeroTier

For private networks without exposing to the public internet:

```bash
# Install Tailscale, then access FileNode via your Tailscale IP
# e.g. http://100.x.y.z:3333
```

## Using with OpenClaw

### Method 1: Node Pairing (Recommended)

Node pairing connects FileNode directly to the OpenClaw Gateway over WebSocket. The agent can invoke file commands through the Gateway's secure channel -- no tunneling needed.

**Step 1: Start FileNode in node mode**

```bash
filenode start --gateway localhost:18789
```

You'll see:

```
  ╔══════════════════════════════════════════╗
  ║     FileNode v0.1.0 — Node Mode        ║
  ╠══════════════════════════════════════════╣
  ║  Gateway:  ws://localhost:18789          ║
  ╚══════════════════════════════════════════╝

  Commands registered:
    • files.list
    • files.read
    • files.write
    • files.append
    • files.delete
    • files.mkdir
    • files.info

  ⏳ Connecting to Gateway...
  🔐 Responding to challenge...
  ⏳ Pairing requested. Run "openclaw nodes approve" on your gateway.
```

**Step 2: Approve the pairing**

On your OpenClaw gateway, run:

```bash
openclaw nodes approve
```

Once approved, FileNode saves a device token to `~/.filenode/node.json` for automatic reconnection.

**Step 3: Done**

The agent can now invoke file commands (like `files.list`, `files.read`, `files.write`) through the Gateway. No credentials flow through chat.

You can also run both the HTTP server and node mode simultaneously:

```bash
filenode start --gateway localhost:18789 --port 3333
```

To persist the gateway setting:

```bash
filenode config set gateway localhost:18789
filenode start
```

### Method 2: HTTP + Tunnel

**Step 1: Start FileNode**

```bash
filenode start
```

You'll see:

```
  ╔══════════════════════════════════════════╗
  ║           FileNode v0.1.0                ║
  ╠══════════════════════════════════════════╣
  ║  Server:  http://0.0.0.0:3333            ║
  ║  Config:  ~/.filenode/config.json        ║
  ╚══════════════════════════════════════════╝

  Allowed paths:
    - /Users/you/Documents
    - /Users/you/Desktop
```

**Step 2: (Optional) Allow more paths**

```bash
# Add specific directories
filenode config add ~/Projects ~/Downloads

# Or allow everything
filenode config set allowedPaths all
```

Restart the server after config changes.

**Step 3: Tunnel it**

In a new terminal:

```bash
ngrok http 3333
# Output: https://abc123.ngrok-free.app -> http://localhost:3333
```

**Step 4: Give your bot the URL**

Tell your bot:

> Here's access to my local filesystem:
> - API endpoint: `https://abc123.ngrok-free.app`
> - Hit GET / to see all available endpoints and directories.

**Step 5: Done**

The bot hits `GET /`, sees the full API documentation and your directory listing, and starts working. It can browse your files, read them, create new ones, and organize your filesystem -- all through the API.

## CLI

```bash
filenode start                        # Start HTTP server (default port 3333)
filenode start --port 8080            # Start on custom port
filenode start --gateway localhost:18789  # Start as OpenClaw node
filenode start --gateway localhost:18789 --port 3333  # Both HTTP + node
filenode stop                         # Stop running server
filenode config show                  # Display configuration
filenode config set port 4444         # Update a setting
filenode config set gateway localhost:18789  # Set gateway permanently
filenode config set allowedPaths ~/Documents ~/Projects
filenode config set allowedPaths all  # Allow access to entire filesystem
filenode config add ~/Downloads       # Add a path without replacing existing ones
filenode config remove ~/Desktop      # Remove a specific allowed path
filenode --version                    # Show version
filenode help                         # Show help
```

## API

All endpoints are open -- no authentication required.

### GET /

Discover all allowed directories and their top-level contents. Returns a full self-documenting API reference with endpoint descriptions, query parameters, body formats, examples, and tips. This is the best starting point for bots.

```bash
curl http://localhost:3333/
```

### GET /health

```bash
curl http://localhost:3333/health
# {"status":"healthy","version":"0.1.0","uptime":42}
```

### GET /list/:path

List directory contents.

```bash
curl "http://localhost:3333/list/Users/you/Documents?recursive=true&maxDepth=2"
```

Response:
```json
{
  "path": "/Users/you/Documents",
  "type": "directory",
  "contents": [
    { "name": "file.txt", "type": "file", "size": 1024, "modified": "2026-02-19T15:30:00Z" },
    { "name": "subfolder", "type": "directory", "contents": [] }
  ]
}
```

### GET /files/:path

Read file contents.

```bash
# Read as text
curl http://localhost:3333/files/Users/you/Documents/notes.txt

# Read as JSON
curl "http://localhost:3333/files/Users/you/Documents/data.json?format=json"

# Read first 10 lines
curl "http://localhost:3333/files/Users/you/Documents/log.txt?lines=10"

# Read as base64
curl "http://localhost:3333/files/Users/you/Documents/image.png?format=base64"
```

For filenames with spaces or special characters, use the `?path=` query parameter instead of encoding them in the URL:

```bash
curl --get --data-urlencode "path=/Users/you/Desktop/Screenshot 2026-02-20 at 6.33.06 PM.png" \
  http://localhost:3333/files/
```

The `?path=` parameter works on all endpoints (`/files/`, `/list/`, `/append/`, `/mkdir/`, `/delete/`).

### POST /files/:path

Write or overwrite a file.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello World"}' \
  http://localhost:3333/files/Users/you/Documents/new.txt
# {"path":"/Users/you/Documents/new.txt","size":11,"created":true}
```

### POST /append/:path

Append to a file (creates if it doesn't exist).

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "\nNew line"}' \
  http://localhost:3333/append/Users/you/Documents/log.txt
# {"path":"...","appended":true,"newSize":2048}
```

### DELETE /files/:path

Delete a file or directory.

```bash
# Delete file
curl -X DELETE http://localhost:3333/files/Users/you/Documents/old.txt

# Delete directory (requires recursive=true)
curl -X DELETE "http://localhost:3333/files/Users/you/Documents/old_folder?recursive=true"
```

### POST /mkdir/:path

Create a directory (including parent directories).

```bash
curl -X POST http://localhost:3333/mkdir/Users/you/Documents/new/nested/dir
# {"path":"...","created":true}
```

## Configuration

Config file: `~/.filenode/config.json`

```json
{
  "port": 3333,
  "host": "0.0.0.0",
  "allowedPaths": ["~/Documents", "~/Desktop"],
  "maxFileSize": "1GB",
  "maxListDepth": 3,
  "rateLimitPerMin": 100,
  "enableLogging": true,
  "logLevel": "info",
  "enableCORS": true,
  "corsOrigins": ["*"],
  "gateway": null,
  "displayName": "FileNode"
}
```

When using node mode, a separate identity file is stored at `~/.filenode/node.json`:

```json
{
  "deviceId": "a1b2c3d4e5f6...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "deviceToken": "issued-by-gateway-after-pairing"
}
```

### Managing Allowed Paths

By default, only `~/Documents` and `~/Desktop` are accessible. You can manage this in several ways:

```bash
# Add paths incrementally (keeps existing ones)
filenode config add ~/Projects ~/Downloads

# Remove specific paths
filenode config remove ~/Desktop

# Replace the entire list
filenode config set allowedPaths ~/Documents ~/Projects

# Allow access to the entire filesystem
filenode config set allowedPaths all
```

Restart the server after changing the config for it to take effect.

## Security

- **Path traversal prevention** -- All paths normalized and validated against a configurable allowlist
- **Rate limiting** -- Configurable requests per minute
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Atomic writes** -- Temp file + rename to prevent corruption
- **File size limits** -- Configurable max file size
- **Fuzzy filename matching** -- Handles Unicode whitespace variants (macOS narrow no-break spaces, etc.) without exposing unrelated files
- **OpenClaw node pairing** -- Ed25519 device identity, challenge-response authentication with the Gateway, no credentials in chat
- **Tunnel-safe** -- Works behind ngrok, Cloudflare Tunnel, and reverse proxies with no extra config

## Development

```bash
bun install
bun run dev          # Start in dev mode
bun test             # Run tests
bun test --coverage  # Run with coverage
```

## Tech Stack

- [Hono](https://hono.dev) -- Ultra-fast web framework
- [Bun](https://bun.sh) -- Fast JavaScript runtime
- [Pino](https://getpino.io) -- Low-overhead JSON logger
- [Zod](https://zod.dev) -- TypeScript-first schema validation

## License

MIT
