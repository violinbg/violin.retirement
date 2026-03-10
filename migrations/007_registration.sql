-- Seed registration configuration into app_config.
-- INSERT OR IGNORE so re-running or manual pre-existing entries are not overwritten.
INSERT OR IGNORE INTO app_config (key, value) VALUES ('registration_enabled', 'true');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('max_users', '100');
