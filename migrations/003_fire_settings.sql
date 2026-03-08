CREATE TABLE IF NOT EXISTS fire_settings (
    user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_age        INTEGER NOT NULL DEFAULT 30,
    current_portfolio  REAL    NOT NULL DEFAULT 50000,
    annual_income      REAL    NOT NULL DEFAULT 80000,
    annual_expenses    REAL    NOT NULL DEFAULT 50000,
    expected_return    REAL    NOT NULL DEFAULT 7,
    withdrawal_rate    REAL    NOT NULL DEFAULT 4,
    retirement_spending REAL   NOT NULL DEFAULT 50000,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
