package server

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/violinbg/violin.retirement/internal/auth"
	"github.com/violinbg/violin.retirement/internal/models"
)

func registerAuthRoutes(api *gin.RouterGroup, protected *gin.RouterGroup, db *sql.DB) {
	api.POST("/auth/login", handleLogin(db))
	protected.GET("/auth/me", handleMe())
}

// jwtSecret fetches the jwt_secret from app_config, returning "" on any error.
func jwtSecret(db *sql.DB) string {
	var secret string
	db.QueryRow("SELECT value FROM app_config WHERE key = 'jwt_secret'").Scan(&secret) //nolint:errcheck
	return secret
}

func handleLogin(db *sql.DB) gin.HandlerFunc {
	type request struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	return func(c *gin.Context) {
		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var u models.User
		err := db.QueryRow(
			"SELECT id, username, full_name, password_hash, role, active FROM users WHERE username = ?",
			req.Username,
		).Scan(&u.ID, &u.Username, &u.FullName, &u.PasswordHash, &u.Role, &u.Active)
		if err == sql.ErrNoRows || !auth.Check(u.PasswordHash, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Check if user is active — return generic error to avoid revealing account existence
		if !u.Active {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		// Update last_login and updated_at timestamps
		now := time.Now().UTC()
		_, err = db.Exec("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?", now, now, u.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update login time"})
			return
		}

		secret := jwtSecret(db)
		token, err := auth.Sign(u.ID, u.Username, u.FullName, u.Role, secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user": gin.H{
				"id":        u.ID,
				"username":  u.Username,
				"full_name": u.FullName,
				"role":      u.Role,
			},
		})
	}
}

func handleMe() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"id":        c.GetString(contextKeyUserID),
			"username":  c.GetString(contextKeyUsername),
			"full_name": c.GetString(contextKeyFullName),
			"role":      c.GetString(contextKeyRole),
		})
	}
}
