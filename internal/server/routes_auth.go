package server

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/violinbg/violin.retirement/internal/auth"
	"github.com/violinbg/violin.retirement/internal/captcha"
	"github.com/violinbg/violin.retirement/internal/models"
)

func registerAuthRoutes(api *gin.RouterGroup, protected *gin.RouterGroup, db *sql.DB, cs *captcha.Store) {
	api.POST("/auth/login", handleLogin(db))
	api.GET("/auth/captcha", handleGetCaptcha(cs))
	api.POST("/auth/register", handleRegister(db, cs))
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

func handleGetCaptcha(cs *captcha.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, question := cs.Generate()
		c.JSON(http.StatusOK, gin.H{
			"id":       id,
			"question": question,
		})
	}
}

func handleRegister(db *sql.DB, cs *captcha.Store) gin.HandlerFunc {
	type request struct {
		Username     string `json:"username" binding:"required,min=3"`
		FullName     string `json:"full_name" binding:"required"`
		Password     string `json:"password" binding:"required,min=8"`
		CaptchaID    string `json:"captcha_id" binding:"required"`
		CaptchaAnswer string `json:"captcha_answer" binding:"required"`
	}

	return func(c *gin.Context) {
		// Check registration is enabled.
		var enabled string
		db.QueryRow("SELECT value FROM app_config WHERE key = 'registration_enabled'").Scan(&enabled) //nolint:errcheck
		if enabled != "true" {
			c.JSON(http.StatusForbidden, gin.H{"error": "registration is currently disabled"})
			return
		}

		// Check user count against max_users.
		var maxUsersStr string
		db.QueryRow("SELECT value FROM app_config WHERE key = 'max_users'").Scan(&maxUsersStr) //nolint:errcheck
		maxUsers, _ := strconv.Atoi(maxUsersStr)
		if maxUsers <= 0 {
			maxUsers = 100
		}
		var userCount int
		db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount) //nolint:errcheck
		if userCount >= maxUsers {
			c.JSON(http.StatusForbidden, gin.H{"error": "maximum number of users reached"})
			return
		}

		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Verify captcha.
		if !cs.Verify(req.CaptchaID, req.CaptchaAnswer) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "incorrect captcha answer"})
			return
		}

		// Check username uniqueness.
		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)", req.Username).Scan(&exists) //nolint:errcheck
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}

		hash, err := auth.Hash(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}

		userID := uuid.New().String()
		now := time.Now().UTC()
		if _, err := db.Exec(
			"INSERT INTO users (id, username, full_name, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 'user', 1, ?, ?)",
			userID, req.Username, req.FullName, hash, now, now,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
			return
		}

		// Auto-login: issue a JWT.
		secret := jwtSecret(db)
		token, err := auth.Sign(userID, req.Username, req.FullName, "user", secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign token"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"token": token,
			"user": gin.H{
				"id":        userID,
				"username":  req.Username,
				"full_name": req.FullName,
				"role":      "user",
			},
		})
	}
}
