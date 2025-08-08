/**
 * Discord Cursor Bot integration types.
 * Internal storage types and Discord-specific interfaces.
 * External Cursor API types are imported from cursor-api-types.ts
 */

import type { 
  AgentStatus, 
  Agent, 
  CreateAgentInput, 
  CreateAgentResponse,
  ListAgentsResponse,
  CursorWebhookEvent,
  CursorApiError 
} from './cursor-api-types';

// Re-export commonly used types for convenience
export type { AgentStatus, Agent, CreateAgentInput, CursorWebhookEvent, CursorApiError };

// Discord-specific types
export interface StoredInteraction {
  id: number;
  timestamp: string;
  type: string;
  /** Optional structured data included with the Discord interaction. */
  data?: any;
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  raw: any;
}

export interface BotInfo {
  hasPublicKey: boolean;
  hasBotToken: boolean;
  hasApiKey: boolean;
  webhookUrl: string;
  setupComplete: boolean;
  registeredCommands?: {
    applicationId: string;
    commands: Array<{
      id: string;
      name: string;
      description: string;
      type: number;
      version: string;
    }>;
    total: number;
  } | { error: string };
}

// Database row types (snake_case as stored in D1)
export interface AgentDatabaseRow {
  id: string;
  status: string;
  prompt: string;
  repository: string;
  discord_channel_id: string;
  discord_thread_id: string | null;
  discord_user_id: string;
  model: string | null;
  branch_name: string | null;
  pr_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// Internal storage types for Discord integration
export interface StoredCursorAgent {
  id: string; // Cursor Agent ID
  status: AgentStatus;
  prompt: string;
  repository: string;
  discordChannelId: string; // More explicit naming
  discordThreadId?: string;
  discordUserId: string;
  model?: string;
  branchName?: string;
  prUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelApiKey {
  channelId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserApiKey {
  userId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

// Channel configuration for Discord integration
export interface ChannelConfig {
  channelId: string;
  defaultRepository?: `https://github.com/${string}`;
  createdAt: string;
  updatedAt: string;
}

// Discord Interaction types
export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

// Discord Interaction Response types
export interface InteractionResponse {
  type: InteractionResponseType;
  data?: InteractionResponseData;
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
}

export interface InteractionResponseData {
  content?: string;
  embeds?: any[];
  allowed_mentions?: any;
  flags?: number;
  components?: any[];
  // For modal responses
  custom_id?: string;
  title?: string;
}

// Application-specific response types
export interface ServiceInfo {
  hasApiKey: boolean;
  hasBotToken: boolean;
  hasPublicKey: boolean;
  webhookUrl: string;
  setupComplete: boolean;
  totalAgents: number;
  activeAgents: number;
}

export interface AgentsResponse {
  agents: StoredCursorAgent[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  agents_created: number;
  webhook_events_received: number;
  interactions_received: number;
}

export interface TunnelUrlResponse {
  tunnelUrl: string;
  source: string;
}

// Rate limiting types
export interface RateLimitState {
  count: number;
  resetTime: number;
}

// Discord Modal types for secure API key input
export interface ModalSubmitInteraction {
  type: 5; // MODAL_SUBMIT
  data: {
    custom_id: string;
    components: Array<{
      type: 1; // ACTION_ROW
      components: Array<{
        type: 4; // TEXT_INPUT
        custom_id: string;
        value: string;
      }>;
    }>;
  };
}

// Utility functions for converting between database rows and application types
export function dbRowToStoredAgent(row: AgentDatabaseRow): StoredCursorAgent {
  const agent: StoredCursorAgent = {
    id: row.id,
    status: row.status as AgentStatus,
    prompt: row.prompt,
    repository: row.repository,
    discordChannelId: row.discord_channel_id,
    discordUserId: row.discord_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Handle optional properties carefully for exactOptionalPropertyTypes
  if (row.discord_thread_id !== null) {
    agent.discordThreadId = row.discord_thread_id;
  }
  if (row.model !== null) {
    agent.model = row.model;
  }
  if (row.branch_name !== null) {
    agent.branchName = row.branch_name;
  }
  if (row.pr_url !== null) {
    agent.prUrl = row.pr_url;
  }
  if (row.error !== null) {
    agent.error = row.error;
  }

  return agent;
}

// Thread interaction types for Discord event forwarder
export interface ThreadInteraction {
  type: number; // 99 for thread interactions
  thread: {
    id: string;
    name: string;
    parent_id: string;
  };
  messages: Array<{
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      bot: boolean;
    };
    created_at: string;
  }>;
  triggering_message: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      bot: boolean;
    };
  };
}



// Utility types for converting between external API and storage
export type ApiAgentToStoredAgent = (
  agent: Agent, 
  discordChannelId: string, 
  discordUserId: string, 
  discordThreadId?: string
) => StoredCursorAgent;

// Cloudflare Workers environment interface
export interface Env {
  DB: D1Database;
  API_KEYS: KVNamespace;
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  CURSOR_API_KEY?: string;
}