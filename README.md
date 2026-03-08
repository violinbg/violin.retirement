# violin.retirement

A retirement savings tracker for people pursuing FIRE (Financial Independence, Retire Early) or approaching traditional retirement.

## Tech Stack

- **Backend:** Go + Gin + SQLite (modernc, pure Go)
- **Frontend:** Angular 21 + SCSS
- **Deployment:** Single binary with embedded UI

## Quick Start

```bash
# Build everything
make build

# Run
./violin.retirement.exe

# Open http://localhost:8080
```

## Development

```bash
# Terminal 1: Go backend
make dev-server

# Terminal 2: Angular dev server (proxies /api to :8080)
make dev-ui

# Open http://localhost:4200
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
