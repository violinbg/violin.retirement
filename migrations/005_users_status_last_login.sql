-- Add user activation and login tracking fields for existing databases.
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login DATETIME;
