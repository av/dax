# Quickstart: Dax Development Environment

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20 LTS+ | Frontend build, package management |
| pnpm | 8.0+ | Package manager (faster than npm) |
| Rust | 1.75+ | Backend (Tauri) |
| Tauri CLI | 2.0+ | Build tooling |

### Optional (for Sandbox)

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.11+ | Python sandbox runtime |
| Deno | 1.40+ | JavaScript sandbox runtime |

---

## Installation

### 1. Install Rust

```bash
# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Windows: Download from https://rustup.rs

# Verify
rustc --version  # Should be 1.75+
```

### 2. Install Node.js and pnpm

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Verify
node --version  # Should be 20.x
pnpm --version  # Should be 8.x+
```

### 3. Install Tauri CLI

```bash
cargo install tauri-cli

# Verify
cargo tauri --version  # Should be 2.x
```

### 4. System Dependencies (Linux only)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

---

## Project Setup

### Clone and Install

```bash
# Clone repository
git clone <repository-url> dax
cd dax

# Install frontend dependencies
pnpm install

# Build Rust dependencies (first time takes a while)
cd src-tauri
cargo build
cd ..
```

### Environment Configuration

Create `.env` file in project root:

```bash
# LLM Configuration (at least one required for agent features)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or
LOCAL_LLM_URL=http://localhost:11434  # Ollama, etc.

# Development
VITE_DEV_TOOLS=true
RUST_LOG=debug
```

---

## Development Workflow

### Start Development Server

```bash
# Terminal 1: Frontend dev server (hot reload)
pnpm dev

# Terminal 2: Tauri dev mode (compiles Rust on change)
cargo tauri dev
```

The app will open automatically. Frontend changes hot-reload; Rust changes trigger recompile.

### Build for Production

```bash
# Build optimized bundle
pnpm build

# Build native application
cargo tauri build

# Output in: src-tauri/target/release/bundle/
```

### Run Tests

```bash
# Frontend unit tests
pnpm test

# Frontend E2E tests (requires built app)
pnpm test:e2e

# Rust tests
cd src-tauri
cargo test
```

---

## Project Structure Overview

```
dax/
├── src/                    # TypeScript frontend
│   ├── main.tsx           # Entry point
│   ├── engine/            # Three.js + Rapier 3D engine
│   ├── objects/           # 3D object types
│   ├── agent/             # Agent system
│   ├── ui/                # React components
│   └── services/          # Tauri bridges, utilities
│
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs       # Tauri entry
│   │   ├── commands/     # IPC handlers
│   │   └── sandbox/      # Code execution
│   ├── Cargo.toml
│   └── tauri.conf.json   # Tauri config
│
├── public/                # Static assets
│   ├── assets/models/    # 3D models
│   └── assets/icons/     # File type icons
│
├── tests/                 # Test suites
│   ├── e2e/              # Playwright
│   ├── integration/      # Tauri commands
│   └── unit/             # Component tests
│
├── specs/                 # Feature specifications
│   └── 001-dax-core/     # This feature
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env                   # Local config (gitignored)
```

---

## IDE Setup

### VS Code (Recommended)

Install extensions:
- `rust-analyzer` - Rust language support
- `Tauri` - Tauri debugging
- `ESLint` - TypeScript linting
- `Prettier` - Code formatting
- `Three.js Snippets` - 3D development helpers

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "rust-analyzer.cargo.features": "all"
}
```

### Debugging

Launch configs (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Tauri Dev",
      "cargo": {
        "args": ["build", "--manifest-path=./src-tauri/Cargo.toml"]
      },
      "preLaunchTask": "pnpm: dev"
    }
  ]
}
```

---

## Common Tasks

### Add New Tauri Command

1. Define command in `src-tauri/src/commands/mod.rs`
2. Register in `src-tauri/src/main.rs` builder
3. Add TypeScript wrapper in `src/services/tauri.ts`
4. Add to contract in `specs/001-dax-core/contracts/tauri-commands.md`

### Add New 3D Object Type

1. Create class in `src/objects/NewObject.ts`
2. Register in `src/objects/index.ts`
3. Add type to `src/types/objects.ts`
4. Add 3D model to `public/assets/models/`
5. Update factory in `src/engine/ObjectManager.ts`

### Add New UI Component

1. Create in `src/ui/components/NewComponent.tsx`
2. Add to appropriate layout in `src/App.tsx`
3. Connect to stores as needed
4. Add unit test in component directory

---

## Troubleshooting

### Rust compilation fails

```bash
# Clear cargo cache and rebuild
cd src-tauri
cargo clean
cargo build
```

### WebGL not working

- Ensure GPU drivers are up to date
- Check browser console for WebGL errors
- Try with `LIBGL_ALWAYS_SOFTWARE=1` on Linux

### Tauri window doesn't open

```bash
# Check for port conflicts
lsof -i :1420  # Vite default port

# Check Tauri logs
RUST_LOG=debug cargo tauri dev
```

### Hot reload not working

```bash
# Restart dev servers
# Kill both terminals and restart:
pnpm dev
cargo tauri dev
```
