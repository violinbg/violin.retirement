package server

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

func registerCalculatorRoutes(protected *gin.RouterGroup, db *sql.DB) {
	protected.GET("/calculator/fire", handleGetFireSettings(db))
	protected.PUT("/calculator/fire", handlePutFireSettings(db))
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
			FROM fire_settings WHERE user_id = ?`,
			userID,
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
			   expected_return, withdrawal_rate, retirement_spending, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
