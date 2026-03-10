CREATE TABLE IF NOT EXISTS portfolio_accounts (
    id                 TEXT    PRIMARY KEY,
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT    NOT NULL,
    account_type       TEXT    NOT NULL DEFAULT 'Other',
    asset_class        TEXT    NOT NULL DEFAULT 'Other',
    current_value      REAL    NOT NULL DEFAULT 0,
    annual_return_rate REAL,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_account_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT    NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
    value      REAL    NOT NULL,
    note       TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portfolio_accounts_user_id
    ON portfolio_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_account_history_account_id
    ON portfolio_account_history(account_id);
