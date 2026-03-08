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
	CreatedAt    time.Time
}

// AppConfig represents a key/value configuration entry.
type AppConfig struct {
	Key   string
	Value string
}

