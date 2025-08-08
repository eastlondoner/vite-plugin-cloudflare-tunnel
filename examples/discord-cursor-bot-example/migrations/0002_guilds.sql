-- Create guilds table for tracking connected guilds and command sync status
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT,
  commands_version TEXT,
  last_seen_at TEXT NOT NULL,
  last_synced_at TEXT,
  last_sync_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for recently seen guilds
CREATE INDEX IF NOT EXISTS idx_guilds_last_seen_at ON guilds (last_seen_at DESC);


