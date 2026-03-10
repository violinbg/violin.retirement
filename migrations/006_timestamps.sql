-- Add missing timestamp columns for consistent created_at / updated_at across all tables.
-- Note: ALTER TABLE ADD COLUMN in SQLite only supports constant defaults (not CURRENT_TIMESTAMP),
-- so we add the column as nullable and backfill existing rows with appropriate values.
-- New rows always have these columns set explicitly by the application code.

-- users: add updated_at, backfill from created_at
ALTER TABLE users ADD COLUMN updated_at DATETIME;
UPDATE users SET updated_at = created_at;

-- fire_settings: add created_at, backfill from updated_at
ALTER TABLE fire_settings ADD COLUMN created_at DATETIME;
UPDATE fire_settings SET created_at = updated_at;

-- app_config: add both timestamps
ALTER TABLE app_config ADD COLUMN created_at DATETIME;
ALTER TABLE app_config ADD COLUMN updated_at DATETIME;
UPDATE app_config SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP;
