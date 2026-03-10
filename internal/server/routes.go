package server

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func registerRoutes(r *gin.Engine, db *sql.DB) {
	api := r.Group("/api/v1")
	protected := api.Group("/")
	protected.Use(AuthRequired(func() string { return jwtSecret(db) }))
	admin := protected.Group("/")
	admin.Use(AdminRequired())

	registerHealthRoutes(api, db)
	registerSetupRoutes(api, db)
	registerAuthRoutes(api, protected, db)
	registerCalculatorRoutes(protected, db)
	registerPortfolioRoutes(protected, db)
	registerUserRoutes(admin, db)
}
