package server

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

func registerRoutes(r *gin.Engine, db *sql.DB) {
	api := r.Group("/api/v1")

	api.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "detail": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}
