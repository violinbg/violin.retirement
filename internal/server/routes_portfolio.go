package server

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func registerPortfolioRoutes(protected *gin.RouterGroup, db *sql.DB) {
	protected.GET("/portfolio/accounts", handleListPortfolioAccounts(db))
	protected.POST("/portfolio/accounts", handleCreatePortfolioAccount(db))
	protected.PUT("/portfolio/accounts/:id", handleUpdatePortfolioAccount(db))
	protected.DELETE("/portfolio/accounts/:id", handleDeletePortfolioAccount(db))
	protected.GET("/portfolio/accounts/:id/history", handleGetPortfolioAccountHistory(db))
}

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

		if _, err := tx.Exec(`
			INSERT INTO portfolio_account_history (account_id, value, note)
			VALUES (?, ?, ?)`,
			id, req.CurrentValue, req.Note,
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
			FROM portfolio_accounts WHERE id = ?`,
			id,
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

		if _, err := tx.Exec(`
			INSERT INTO portfolio_account_history (account_id, value, note)
			VALUES (?, ?, ?)`,
			accountID, req.CurrentValue, req.Note,
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
			FROM portfolio_accounts WHERE id = ?`,
			accountID,
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

		var ownerID string
		err := db.QueryRow(
			"SELECT user_id FROM portfolio_accounts WHERE id = ?",
			accountID,
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
