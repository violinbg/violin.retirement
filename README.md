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

## Project Structure

```
main.go                 Entry point, embeds UI + migrations
internal/server/        Gin HTTP server and API routes
internal/database/      SQLite connection and migrations
internal/models/        Data models
migrations/             SQL migration files
ui/                     Angular application
```
