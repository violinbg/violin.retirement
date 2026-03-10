// Package models defines data structures for the retirement tracker.
package models

import "time"

// User represents an application user.
type User struct {
	ID           string
	Username     string
	FullName     string
	PasswordHash string
	Role         string
	Active       bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
	LastLogin    *time.Time
}

// AppConfig represents a key/value configuration entry.
type AppConfig struct {
	Key   string
	Value string
}

// PortfolioAccount represents an investment account owned by a user.
type PortfolioAccount struct {
	ID               string
	UserID           string
	Name             string
	AccountType      string
	AssetClass       string
	CurrentValue     float64
	AnnualReturnRate *float64
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// PortfolioAccountHistory records a historical value snapshot for an account.
type PortfolioAccountHistory struct {
	ID         int64
	AccountID  string
	Value      float64
	Note       *string
	RecordedAt time.Time
}
