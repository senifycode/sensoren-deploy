# Service Manager

Interactive CLI tool for updating services and their dependencies.

## Features

-   🎨 Beautiful interactive CLI (like create-vite)
-   ✅ Multi-select support - update multiple services at once
-   🔄 Pull repositories from git with uncommitted change detection
-   📦 Automatic git submodule updates
-   ⚡ Fast dependency installation with bun
-   🎯 Easy service selection with keyboard navigation

## Services

-   **Main Service** - Sensoren-Server (Frontend)
-   **Broker Service** - MQTT Broker
-   **Backup Service** - Backup Manager
-   **WebSocket Service** - WebSocket Server

## Usage

```bash
# From the service-manager directory
bun start

# Or from anywhere in shared-utils
bun run tools/service-manager/index.ts
```

## What it does

### Pull Repositories Mode
1. Shows an interactive menu to select one or more services
2. Checks each service for uncommitted changes
3. Pulls latest changes from git (skips repos with uncommitted changes)
4. Updates all submodules recursively
5. Shows progress with spinners and colored output
6. Reports success/failure/skipped for each service

### Update Services Mode
1. Shows an interactive menu to select one or more services
2. Updates the `shared-utils` submodule in each selected service
3. Runs `bun install` to update all dependencies
4. Shows progress with spinners and colored output
5. Reports success/failure for each service

### How to use the interactive menu:

**Action Selection:**
- **↑/↓** - Navigate between Pull/Update
- **Enter** - Confirm action choice

**Service Selection:**
- **↑/↓** - Navigate through services
- **Space** - Select/deselect a service
- **Enter** - Confirm selection and start
- **Ctrl+C** - Cancel operation

### Pull Repositories Behavior

When pulling repositories, the tool will:
- ✅ Pull repos that have no uncommitted changes
- ⚠️ Skip repos with uncommitted changes (with a warning)
- 🔄 Automatically update all submodules after pulling
- 📊 Show a summary of pulled/skipped/failed repos

This prevents accidentally losing uncommitted work when switching between machines.

## Configuration

The tool uses `config.json` to define services and their paths. This file is git-ignored so you can customize it locally.

### config.json structure:

```json
{
	"services": {
		"main": {
			"name": "Main Service",
			"path": "C:\\Coding\\Javascript\\Sensoren-Server"
		},
		"broker": {
			"name": "Broker Service",
			"path": "C:\\Coding\\Projects\\Senify\\broker-service"
		},
		"backup": {
			"name": "Backup Service",
			"path": "C:\\Coding\\Projects\\Senify\\backup-service"
		},
		"websocket": {
			"name": "WebSocket Service",
			"path": "C:\\Coding\\Projects\\Senify\\websocket-service"
		}
	}
}
```

Each service needs:

-   **name**: Display name shown in the menu
-   **path**: Absolute path to the service directory

## Requirements

-   Bun runtime
-   Git
