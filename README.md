# violin.retirement

A retirement savings tracker for people pursuing FIRE (Financial Independence, Retire Early) or approaching traditional retirement.

## Tech Stack

- **Backend:** Go + Gin + SQLite (modernc, pure Go)
- **Frontend:** Angular 21 + SCSS
- **Deployment:** Single binary with embedded UI

## Quick Start

```bash
# Install root dev tools (first time only)
npm install

# Build everything
npm run build

# Run
./violin.retirement.exe

# Open http://localhost:8080
```

## Development

```bash
# Install root dev tools (first time only)
npm install

# Run both backend and Angular dev server concurrently
npm run dev

# Or separately:
npm run dev:server   # Go backend on :8080
npm run dev:ui       # Angular dev server on :4200 (proxies /api to :8080)
```

## Deployment

### Docker (Alpine)

Build the container image:

```bash
docker build -t violin-retirement:latest .
```

Run with a named Docker volume:

```bash
docker run --rm \
	-p 8080:8080 \
	-e PORT=8080 \
	-e DB_PATH=/data/violin.retirement.db \
	-v violin_retirement_data:/data \
	violin-retirement:latest
```

Run with a host data folder so the SQLite file is created on your machine.

Linux/macOS:

```bash
mkdir -p ./data
docker run --rm \
	-p 8080:8080 \
	-e PORT=8080 \
	-e DB_PATH=/data/violin.retirement.db \
	-v "$(pwd)/data:/data" \
	violin-retirement:latest
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .\data | Out-Null
docker run --rm `
	-p 8080:8080 `
	-e PORT=8080 `
	-e DB_PATH=/data/violin.retirement.db `
	-v "${PWD}\data:/data" `
	violin-retirement:latest
```

In both examples, the database file will be created at:

- `./data/violin.retirement.db` on your host
- `/data/violin.retirement.db` inside the container

### Runtime configuration precedence

Configuration resolution order is:

1. CLI flags
2. Environment variables
3. Defaults

Supported values:

- Listen address: `-addr` > `PORT` > `:8080`
- Database path: `-db` > `DB_PATH` > `violin.retirement.db`

Examples:

```bash
# Env vars only
PORT=9090 DB_PATH=/data/custom.db ./violin.retirement

# Flags override env vars
PORT=9090 DB_PATH=/data/custom.db ./violin.retirement -addr :7070 -db ./local.db
```

## Project Structure

```
main.go                 Entry point, embeds UI + migrations
internal/server/        Gin HTTP server and API routes
internal/database/      SQLite connection and migrations
internal/models/        Data models
migrations/             SQL migration files
ui/                     Angular application
```
