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

	// Portfolio routes.
	protected.GET("/portfolio/accounts", handleListPortfolioAccounts(db))
	protected.POST("/portfolio/accounts", handleCreatePortfolioAccount(db))
	protected.PUT("/portfolio/accounts/:id", handleUpdatePortfolioAccount(db))
	protected.DELETE("/portfolio/accounts/:id", handleDeletePortfolioAccount(db))
	protected.GET("/portfolio/accounts/:id/history", handleGetPortfolioAccountHistory(db))
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

// ── portfolio account types/classes ──────────────────────────────────────────

var validAccountTypes = map[string]bool{
	"401k": true, "IRA": true, "Roth IRA": true, "Brokerage": true,
	"Savings": true, "HSA": true, "Other": true,
}

var validAssetClasses = map[string]bool{
	"Stocks": true, "Bonds": true, "Cash": true, "Real Estate": true,
	"Crypto": true, "Commodities": true, "Mixed": true, "Other": true,
}

// portfolioAccountResponse is the JSON representation sent to the client.
type portfolioAccountResponse struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	AccountType      string   `json:"account_type"`
	AssetClass       string   `json:"asset_class"`
	CurrentValue     float64  `json:"current_value"`
	AnnualReturnRate *float64 `json:"annual_return_rate"`
	CreatedAt        string   `json:"created_at"`
	UpdatedAt        string   `json:"updated_at"`
}

// portfolioHistoryResponse is the JSON representation of a history entry.
type portfolioHistoryResponse struct {
	ID         int64   `json:"id"`
	Value      float64 `json:"value"`
	Note       *string `json:"note"`
	RecordedAt string  `json:"recorded_at"`
}

func handleListPortfolioAccounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		rows, err := db.Query(`
			SELECT id, name, account_type, asset_class, current_value, annual_return_rate,
			       created_at, updated_at
			FROM portfolio_accounts WHERE user_id = ? ORDER BY created_at ASC`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		accounts := []portfolioAccountResponse{}
		for rows.Next() {
			var a portfolioAccountResponse
			if err := rows.Scan(&a.ID, &a.Name, &a.AccountType, &a.AssetClass,
				&a.CurrentValue, &a.AnnualReturnRate, &a.CreatedAt, &a.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			accounts = append(accounts, a)
		}
		c.JSON(http.StatusOK, accounts)
	}
}

func handleCreatePortfolioAccount(db *sql.DB) gin.HandlerFunc {
	type request struct {
		Name             string   `json:"name" binding:"required"`
		AccountType      string   `json:"account_type" binding:"required"`
		AssetClass       string   `json:"asset_class" binding:"required"`
		CurrentValue     float64  `json:"current_value"`
		AnnualReturnRate *float64 `json:"annual_return_rate"`
		Note             *string  `json:"note"`
	}
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !validAccountTypes[req.AccountType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account_type"})
			return
		}
		if !validAssetClasses[req.AssetClass] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_class"})
			return
		}

		id := uuid.New().String()
		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		if _, err := tx.Exec(`
			INSERT INTO portfolio_accounts
			  (id, user_id, name, account_type, asset_class, current_value, annual_return_rate)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, userID, req.Name, req.AccountType, req.AssetClass,
			req.CurrentValue, req.AnnualReturnRate,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Record initial history entry.
		if _, err := tx.Exec(`
			INSERT INTO portfolio_account_history (account_id, value, note)
			VALUES (?, ?, ?)`, id, req.CurrentValue, req.Note,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var a portfolioAccountResponse
		db.QueryRow(`
			SELECT id, name, account_type, asset_class, current_value, annual_return_rate,
			       created_at, updated_at
			FROM portfolio_accounts WHERE id = ?`, id,
		).Scan(&a.ID, &a.Name, &a.AccountType, &a.AssetClass,
			&a.CurrentValue, &a.AnnualReturnRate, &a.CreatedAt, &a.UpdatedAt) //nolint:errcheck

		c.JSON(http.StatusCreated, a)
	}
}

func handleUpdatePortfolioAccount(db *sql.DB) gin.HandlerFunc {
	type request struct {
		Name             string   `json:"name" binding:"required"`
		AccountType      string   `json:"account_type" binding:"required"`
		AssetClass       string   `json:"asset_class" binding:"required"`
		CurrentValue     float64  `json:"current_value"`
		AnnualReturnRate *float64 `json:"annual_return_rate"`
		Note             *string  `json:"note"`
	}
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		accountID := c.Param("id")
		var req request
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !validAccountTypes[req.AccountType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account_type"})
			return
		}
		if !validAssetClasses[req.AssetClass] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_class"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck

		res, err := tx.Exec(`
			UPDATE portfolio_accounts
			SET name = ?, account_type = ?, asset_class = ?, current_value = ?,
			    annual_return_rate = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND user_id = ?`,
			req.Name, req.AccountType, req.AssetClass, req.CurrentValue,
			req.AnnualReturnRate, accountID, userID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}

		// Record history entry for the update.
		if _, err := tx.Exec(`
			INSERT INTO portfolio_account_history (account_id, value, note)
			VALUES (?, ?, ?)`, accountID, req.CurrentValue, req.Note,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var a portfolioAccountResponse
		db.QueryRow(`
			SELECT id, name, account_type, asset_class, current_value, annual_return_rate,
			       created_at, updated_at
			FROM portfolio_accounts WHERE id = ?`, accountID,
		).Scan(&a.ID, &a.Name, &a.AccountType, &a.AssetClass,
			&a.CurrentValue, &a.AnnualReturnRate, &a.CreatedAt, &a.UpdatedAt) //nolint:errcheck

		c.JSON(http.StatusOK, a)
	}
}

func handleDeletePortfolioAccount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		accountID := c.Param("id")

		res, err := db.Exec(
			"DELETE FROM portfolio_accounts WHERE id = ? AND user_id = ?",
			accountID, userID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
	}
}

func handleGetPortfolioAccountHistory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(contextKeyUserID)
		accountID := c.Param("id")

		// Verify ownership.
		var ownerID string
		err := db.QueryRow(
			"SELECT user_id FROM portfolio_accounts WHERE id = ?", accountID,
		).Scan(&ownerID)
		if err == sql.ErrNoRows || ownerID != userID {
			c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rows, err := db.Query(`
			SELECT id, value, note, recorded_at
			FROM portfolio_account_history
			WHERE account_id = ? ORDER BY recorded_at DESC`, accountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		history := []portfolioHistoryResponse{}
		for rows.Next() {
			var h portfolioHistoryResponse
			if err := rows.Scan(&h.ID, &h.Value, &h.Note, &h.RecordedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			history = append(history, h)
		}
		c.JSON(http.StatusOK, history)
	}
}

