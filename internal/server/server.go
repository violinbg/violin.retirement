package server

import (
	"database/sql"
	"embed"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
)

// New creates a Gin engine that serves the API and the embedded Angular SPA.
func New(db *sql.DB, uiFS embed.FS) *gin.Engine {
	r := gin.Default()

	registerRoutes(r, db)

	// Serve the embedded Angular SPA.
	// The embed path is "ui/dist/browser", so we strip that prefix.
	stripped, err := fs.Sub(uiFS, "ui/dist/browser")
	if err != nil {
		panic("failed to create sub filesystem for UI: " + err.Error())
	}

	// Read index.html once for SPA fallback.
	indexHTML, err := fs.ReadFile(stripped, "index.html")
	if err != nil {
		panic("failed to read index.html from embedded UI: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(stripped))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path[1:] // strip leading "/"

		// Try to serve a static file if it exists.
		if path != "" {
			if f, err := stripped.Open(path); err == nil {
				f.Close()
				fileServer.ServeHTTP(c.Writer, c.Request)
				return
			}
		}

		// Fall back to index.html for Angular client-side routing.
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
	})

	return r
}
