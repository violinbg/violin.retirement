package server

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/violinbg/violin.retirement/internal/auth"
	"github.com/violinbg/violin.retirement/internal/models"
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

	// Setup routes — no auth required.
	api.GET("/setup/status", handleSetupStatus(db))
	api.POST("/setup", handleSetup(db))

	// Auth routes — no auth required.
	api.POST("/auth/login", handleLogin(db))

	// Protected routes.
	protected := api.Group("/")
	protected.Use(AuthRequired(func() string { return jwtSecret(db) }))
	protected.GET("/auth/me", handleMe())
	protected.GET("/calculator/fire", handleGetFireSettings(db))
	protected.PUT("/calculator/fire", handlePutFireSettings(db))
}

// ── helpers ──────────────────────────────────────────────────────────────────

// isInitialized reports whether at least one user exists.
func isInitialized(db *sql.DB) (bool, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	return count > 0, err
}

// jwtSecret fetches the jwt_secret from app_config, returning "" on any error.
func jwtSecret(db *sql.DB) string {
	var secret string
	db.QueryRow("SELECT value FROM app_config WHERE key = 'jwt_secret'").Scan(&secret) //nolint:errcheck
	return secret
}

// ── handlers ─────────────────────────────────────────────────────────────────

func handleSetupStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, err := isInitialized(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"initialized": ok})
	}
}

func handleSetup(db *sql.DB) gin.HandlerFunc {
	type request struct {
		Username string `json:"username" binding:"required,min=3"`
		FullName string `json:"full_name" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	return func(c *gin.Context) {
		initialized, err := isInitialized(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if initialized {
			c.JSON(http.StatusConflict, gin.H{"error": "app already initialized"})
			return
		}

		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		hash, err := auth.Hash(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}

		// Generate a random JWT secret.
		secretBytes := make([]byte, 32)
		if _, err := rand.Read(secretBytes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate secret"})
			return
		}
		secret := hex.EncodeToString(secretBytes)

		userID := uuid.New().String()

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		if _, err := tx.Exec(
			"INSERT INTO users (id, username, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
			userID, req.Username, req.FullName, hash, time.Now().UTC(),
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := tx.Exec(
			"INSERT INTO app_config (key, value) VALUES ('jwt_secret', ?)", secret,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "setup complete"})
	}
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
			"SELECT id, username, full_name, password_hash, role FROM users WHERE username = ?",
			req.Username,
		).Scan(&u.ID, &u.Username, &u.FullName, &u.PasswordHash, &u.Role)
		if err == sql.ErrNoRows || !auth.Check(u.PasswordHash, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

// fireSettings mirrors the fire_settings table columns sent over the wire.
type fireSettings struct {
	CurrentAge         int     `json:"current_age"`
	CurrentPortfolio   float64 `json:"current_portfolio"`
	AnnualIncome       float64 `json:"annual_income"`
	AnnualExpenses     float64 `json:"annual_expenses"`
	ExpectedReturn     float64 `json:"expected_return"`
	WithdrawalRate     float64 `json:"withdrawal_rate"`
	RetirementSpending float64 `json:"retirement_spending"`
}

func handleGetFireSettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		var s fireSettings
		err := db.QueryRow(`
			SELECT current_age, current_portfolio, annual_income, annual_expenses,
			       expected_return, withdrawal_rate, retirement_spending
			FROM fire_settings WHERE user_id = ?`, userID,
		).Scan(&s.CurrentAge, &s.CurrentPortfolio, &s.AnnualIncome, &s.AnnualExpenses,
			&s.ExpectedReturn, &s.WithdrawalRate, &s.RetirementSpending)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "no saved settings"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

func handlePutFireSettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		var s fireSettings
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_, err := db.Exec(`
			INSERT INTO fire_settings
			  (user_id, current_age, current_portfolio, annual_income, annual_expenses,
			   expected_return, withdrawal_rate, retirement_spending, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id) DO UPDATE SET
			  current_age         = excluded.current_age,
			  current_portfolio   = excluded.current_portfolio,
			  annual_income       = excluded.annual_income,
			  annual_expenses     = excluded.annual_expenses,
			  expected_return     = excluded.expected_return,
			  withdrawal_rate     = excluded.withdrawal_rate,
			  retirement_spending = excluded.retirement_spending,
			  updated_at          = excluded.updated_at`,
			userID, s.CurrentAge, s.CurrentPortfolio, s.AnnualIncome, s.AnnualExpenses,
			s.ExpectedReturn, s.WithdrawalRate, s.RetirementSpending,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "settings saved"})
	}
}

