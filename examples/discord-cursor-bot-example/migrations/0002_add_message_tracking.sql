-- migrations/0002_add_message_tracking.sql
-- Add table to track which agent messages have been sent to Discord threads

-- Create agent_thread_messages table to track sent messages
CREATE TABLE IF NOT EXISTS agent_thread_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  message_content TEXT NOT NULL,
  message_role TEXT NOT NULL,
  discord_message_id TEXT,
  sent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, message_index)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_thread_messages_agent_id ON agent_thread_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_messages_sent_at ON agent_thread_messages(sent_at);

-- Create active_agents_polling table to track polling status
CREATE TABLE IF NOT EXISTS active_agents_polling (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  last_polled_at TEXT NOT NULL,
  last_message_index INTEGER DEFAULT 0,
  webhook_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for polling table
CREATE INDEX IF NOT EXISTS idx_active_agents_polling_status ON active_agents_polling(status);
CREATE INDEX IF NOT EXISTS idx_active_agents_polling_last_polled ON active_agents_polling(last_polled_at);
CREATE INDEX IF NOT EXISTS idx_active_agents_polling_webhook_active ON active_agents_polling(webhook_active);