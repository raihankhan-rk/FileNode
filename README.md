# FileNode

Ultra-lightweight local file server that exposes your file system as HTTP endpoints. Built for AI agents and automation tools that need seamless file access without SSH complexity.

## Give Your OpenClaw Bot Access to Your Files in 60 Seconds

```
1. Install & start       →  filenode start
2. Copy the auth token   →  fnk_xxxxxxxxxxxxxxxx (printed on startup)
3. Tunnel the port       →  ngrok http 3333
4. Give your bot:
     API URL  →  https://abc123.ngrok.io
     Token    →  fnk_xxxxxxxxxxxxxxxx
5. Done. Your bot can now browse, read, and write files on your machine.
```

The bot hits `GET /` and gets a full self-documenting API response -- every endpoint, query parameter, and usage tip -- plus a listing of your directories. Zero setup on the bot side.

## Features

- **Fast** -- Hono.js + Bun runtime, sub-5ms response times
- **Secure** -- Token auth, path traversal prevention, rate limiting, security headers
- **Simple** -- Single command to start, auto-generates config and auth token
- **Full CRUD** -- Read, write, append, delete files and directories
- **Streaming** -- Large file support with streaming responses
- **Smart paths** -- Fuzzy whitespace matching handles macOS screenshot filenames and other Unicode edge cases
- **Self-documenting** -- `GET /` returns full API docs, tips, and directory listing so bots can figure out usage on their own
- **Cross-platform** -- Works on macOS, Linux, and Windows

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

On first run, FileNode generates a config file at `~/.filenode/config.json` with a secure auth token. The full token is printed on startup so you can copy it directly into your bot or agent.

## Exposing Your Server (Tunneling)

FileNode runs on `localhost:3333` by default. To let a cloud-based AI bot access it, you need to expose it via a tunnel. Here are two options:

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

ngrok gives you a public URL like `https://abc123.ngrok-free.app`. Give this to your bot along with the FileNode auth token.

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

## Using with OpenClaw (Step by Step)

Here's the full walkthrough to connect an OpenClaw bot to your local files:

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

  Auth Token (copy this for your bot):

  fnk_42997d4b868d7c2d7f5864c40162beecb4a79841ee8ead61f884e8ab67b3cf92

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

**Step 4: Give your OpenClaw bot the details**

Tell your bot:

> Here's access to my local filesystem:
> - API endpoint: `https://abc123.ngrok-free.app`
> - Auth token: `fnk_42997d4b868d7c2d7f5864c40162beecb4a79841ee8ead61f884e8ab67b3cf92`
> - Hit GET / with the auth token to see all available endpoints and directories.

**Step 5: Done**

The bot hits `GET /`, sees the full API documentation and your directory listing, and starts working. It can browse your files, read them, create new ones, and organize your filesystem -- all through the API.

## CLI

```bash
filenode start                        # Start server (default port 3333)
filenode start --port 8080            # Start on custom port
filenode stop                         # Stop running server
filenode token regenerate             # Generate new auth token
filenode config show                  # Display configuration
filenode config set port 4444         # Update a setting
filenode config set allowedPaths ~/Documents ~/Projects
filenode config set allowedPaths all  # Allow access to entire filesystem
filenode config add ~/Downloads       # Add a path without replacing existing ones
filenode config remove ~/Desktop      # Remove a specific allowed path
filenode --version                    # Show version
filenode help                         # Show help
```

## API

All endpoints except `/health` require a Bearer token:

```
Authorization: Bearer fnk_xxxxxxxxxxxxxxxxxxxx
```

### GET /

Discover all allowed directories and their top-level contents. Returns a full self-documenting API reference with endpoint descriptions, query parameters, body formats, examples, and tips. This is the best starting point for bots.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3333/
```

### GET /health

```bash
curl http://localhost:3333/health
# {"status":"healthy","version":"0.1.0","uptime":42}
```

### GET /list/:path

List directory contents.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3333/list/Users/you/Documents?recursive=true&maxDepth=2"
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
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3333/files/Users/you/Documents/notes.txt

# Read as JSON
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3333/files/Users/you/Documents/data.json?format=json"

# Read first 10 lines
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3333/files/Users/you/Documents/log.txt?lines=10"

# Read as base64
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3333/files/Users/you/Documents/image.png?format=base64"
```

For filenames with spaces or special characters, use the `?path=` query parameter instead of encoding them in the URL:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  --get --data-urlencode "path=/Users/you/Desktop/Screenshot 2026-02-20 at 6.33.06 PM.png" \
  http://localhost:3333/files/
```

The `?path=` parameter works on all endpoints (`/files/`, `/list/`, `/append/`, `/mkdir/`, `/delete/`).

### POST /files/:path

Write or overwrite a file.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello World"}' \
  http://localhost:3333/files/Users/you/Documents/new.txt
# {"path":"/Users/you/Documents/new.txt","size":11,"created":true}
```

### POST /append/:path

Append to a file (creates if it doesn't exist).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "\nNew line"}' \
  http://localhost:3333/append/Users/you/Documents/log.txt
# {"path":"...","appended":true,"newSize":2048}
```

### DELETE /files/:path

Delete a file or directory.

```bash
# Delete file
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3333/files/Users/you/Documents/old.txt

# Delete directory (requires recursive=true)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3333/files/Users/you/Documents/old_folder?recursive=true"
```

### POST /mkdir/:path

Create a directory (including parent directories).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3333/mkdir/Users/you/Documents/new/nested/dir
# {"path":"...","created":true}
```

## Configuration

Config file: `~/.filenode/config.json`

```json
{
  "port": 3333,
  "host": "0.0.0.0",
  "token": "fnk_...",
  "allowedPaths": ["~/Documents", "~/Desktop"],
  "maxFileSize": "1GB",
  "maxListDepth": 3,
  "rateLimitPerMin": 100,
  "enableLogging": true,
  "logLevel": "info",
  "enableCORS": true,
  "corsOrigins": ["*"]
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

- **Token auth** -- Timing-safe comparison, full token printed on startup for easy copy, never logged in request logs
- **Path traversal prevention** -- All paths normalized and validated against a configurable allowlist
- **Rate limiting** -- Per-token, configurable requests per minute
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Atomic writes** -- Temp file + rename to prevent corruption
- **File size limits** -- Configurable max file size
- **Fuzzy filename matching** -- Handles Unicode whitespace variants (macOS narrow no-break spaces, etc.) without exposing unrelated files
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
