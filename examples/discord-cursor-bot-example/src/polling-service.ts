/**
 * Polling Service for Discord Cursor Bot
 * 
 * This service polls active agents every 2 minutes to check for new chat messages
 * when webhook updates are not available. It tracks which messages have been sent
 * to avoid duplicates and updates Discord threads with new conversation logs.
 */

import { CursorApiService } from './cursor-service';
import { ThreadManager } from './thread-manager';
import { getEffectiveApiKey, createApiKeyManager } from './api-key-manager';
import type { 
  Env, 
  StoredCursorAgent, 
  AgentDatabaseRow 
} from './types';
import { dbRowToStoredAgent } from './types';

interface AgentThreadMessage {
  id: number;
  agent_id: string;
  message_index: number;
  message_content: string;
  message_role: string;
  discord_message_id: string | null;
  sent_at: string;
  created_at: string;
}

interface ActiveAgentPolling {
  id: number;
  agent_id: string;
  status: string;
  last_polled_at: string;
  last_message_index: number;
  webhook_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export class PollingService {
  constructor(private env: Env) {}

  /**
   * Get Discord bot token from environment
   */
  private getDiscordBotToken(): string | null {
    return this.env.DISCORD_BOT_TOKEN || null;
  }

  /**
   * Get all active agents that need polling (where webhooks are not working)
   */
  private async getActiveAgents(): Promise<StoredCursorAgent[]> {
    try {
      // Get active agents where webhooks haven't been active in the last 5 minutes
      // This gives webhooks time to work before falling back to polling
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const result = await this.env.DB.prepare(`
        SELECT a.* FROM agents a
        LEFT JOIN active_agents_polling p ON a.id = p.agent_id
        WHERE a.status IN ('CREATING', 'PENDING', 'RUNNING')
        AND a.discord_thread_id IS NOT NULL
        AND (
          p.agent_id IS NULL 
          OR p.webhook_active = FALSE 
          OR p.updated_at < ?
        )
        ORDER BY a.updated_at DESC
      `).bind(fiveMinutesAgo).all<AgentDatabaseRow>();

      return (result.results || []).map(dbRowToStoredAgent);
    } catch (error) {
      console.error('❌ Failed to get active agents:', error);
      return [];
    }
  }

  /**
   * Get or create polling record for an agent
   */
  private async getOrCreatePollingRecord(agentId: string, status: string): Promise<ActiveAgentPolling | null> {
    try {
      // Try to get existing record
      const existing = await this.env.DB.prepare(`
        SELECT * FROM active_agents_polling WHERE agent_id = ?
      `).bind(agentId).first<ActiveAgentPolling>();

      if (existing) {
        return existing;
      }

      // Create new record
      const now = new Date().toISOString();
      await this.env.DB.prepare(`
        INSERT INTO active_agents_polling (agent_id, status, last_polled_at, last_message_index, webhook_active)
        VALUES (?, ?, ?, ?, ?)
      `).bind(agentId, status, now, 0, true).run();

      // Return the newly created record
      return await this.env.DB.prepare(`
        SELECT * FROM active_agents_polling WHERE agent_id = ?
      `).bind(agentId).first<ActiveAgentPolling>();
    } catch (error) {
      console.error(`❌ Failed to get/create polling record for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Update polling record with latest poll time and message index
   */
  private async updatePollingRecord(agentId: string, status: string, lastMessageIndex: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.env.DB.prepare(`
        UPDATE active_agents_polling 
        SET status = ?, last_polled_at = ?, last_message_index = ?, webhook_active = FALSE, updated_at = ?
        WHERE agent_id = ?
      `).bind(status, now, lastMessageIndex, now, agentId).run();
    } catch (error) {
      console.error(`❌ Failed to update polling record for agent ${agentId}:`, error);
    }
  }

  /**
   * Check if a message has already been sent to Discord
   */
  private async isMessageAlreadySent(agentId: string, messageIndex: number): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT id FROM agent_thread_messages 
        WHERE agent_id = ? AND message_index = ?
      `).bind(agentId, messageIndex).first();

      return !!result;
    } catch (error) {
      console.error(`❌ Failed to check if message exists for agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Record that a message was sent to Discord
   */
  private async recordSentMessage(
    agentId: string, 
    messageIndex: number, 
    message: ConversationMessage,
    discordMessageId?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.env.DB.prepare(`
        INSERT INTO agent_thread_messages (
          agent_id, message_index, message_content, message_role, discord_message_id, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        agentId, 
        messageIndex, 
        message.content, 
        message.role, 
        discordMessageId || null, 
        now
      ).run();
    } catch (error) {
      console.error(`❌ Failed to record sent message for agent ${agentId}:`, error);
    }
  }

  /**
   * Format conversation message for Discord
   */
  private formatMessageForDiscord(message: ConversationMessage, index: number): string {
    const roleEmojis: Record<string, string> = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️',
      'tool': '🔧'
    };

    const emoji = roleEmojis[message.role] || '💬';
    const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';
    
    // Truncate very long messages for Discord
    const content = message.content.length > 1500 
      ? message.content.slice(0, 1500) + '...\n\n*[Message truncated for Discord]*' 
      : message.content;

    return [
      `${emoji} **${message.role.charAt(0).toUpperCase() + message.role.slice(1)}${timestamp ? ` (${timestamp})` : ''}**`,
      '',
      content,
      '',
      `*Message #${index + 1}*`
    ].join('\n');
  }

  /**
   * Process new messages for an agent and send to Discord
   */
  private async processNewMessages(
    agent: StoredCursorAgent,
    pollingRecord: ActiveAgentPolling,
    messages: ConversationMessage[]
  ): Promise<void> {
    if (!agent.discordThreadId) {
      console.log(`⚠️ Agent ${agent.id} has no Discord thread`);
      return;
    }

    const botToken = this.getDiscordBotToken();
    if (!botToken) {
      console.log('⚠️ No Discord bot token configured, skipping message updates');
      return;
    }

    const threadManager = new ThreadManager(botToken);
    const startIndex = pollingRecord.last_message_index;
    const newMessages = messages.slice(startIndex);

    if (newMessages.length === 0) {
      console.log(`📝 No new messages for agent ${agent.id.slice(-8)}`);
      return;
    }

    console.log(`📬 Found ${newMessages.length} new messages for agent ${agent.id.slice(-8)}`);

    // Send new messages to Discord thread
    for (let i = 0; i < newMessages.length; i++) {
      const messageIndex = startIndex + i;
      const message = newMessages[i];

      // Skip if already sent (extra safety check)
      if (await this.isMessageAlreadySent(agent.id, messageIndex)) {
        console.log(`⏭️ Message ${messageIndex} already sent for agent ${agent.id.slice(-8)}`);
        continue;
      }

      try {
        const formattedMessage = this.formatMessageForDiscord(message, messageIndex);
        await threadManager.sendMessageToThread(agent.discordThreadId, formattedMessage);
        
        // Record that we sent this message
        await this.recordSentMessage(agent.id, messageIndex, message);
        
        console.log(`✅ Sent message ${messageIndex} to thread for agent ${agent.id.slice(-8)}`);
        
        // Add small delay between messages to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to send message ${messageIndex} for agent ${agent.id}:`, error);
        // Continue with other messages even if one fails
      }
    }

    // Update polling record with new message count
    await this.updatePollingRecord(agent.id, agent.status, messages.length);
  }

  /**
   * Poll a single agent for new messages
   */
  private async pollAgent(agent: StoredCursorAgent): Promise<void> {
    console.log(`🔍 Polling agent ${agent.id.slice(-8)} for new messages...`);

    try {
      // Get or create polling record
      const pollingRecord = await this.getOrCreatePollingRecord(agent.id, agent.status);
      if (!pollingRecord) {
        console.error(`❌ Could not get polling record for agent ${agent.id}`);
        return;
      }

      // Get API key for the channel
      const keyManager = createApiKeyManager(this.env.API_KEYS);
      const apiKey = await getEffectiveApiKey(agent.discordChannelId, keyManager, this.env.CURSOR_API_KEY);

      if (!apiKey) {
        console.log(`⚠️ No API key available for agent ${agent.id} in channel ${agent.discordChannelId}`);
        return;
      }

      // Fetch conversation from Cursor API
      const cursorService = new CursorApiService(apiKey);
      const conversation = await cursorService.getAgentConversation(agent.id);

      if (!conversation.messages || conversation.messages.length === 0) {
        console.log(`📭 No conversation messages found for agent ${agent.id.slice(-8)}`);
        await this.updatePollingRecord(agent.id, agent.status, 0);
        return;
      }

      // Process new messages
      await this.processNewMessages(agent, pollingRecord, conversation.messages);

    } catch (error) {
      console.error(`❌ Failed to poll agent ${agent.id}:`, error);
      
      // If API call fails, it might be because webhook is down
      // Continue polling this agent
      try {
        await this.updatePollingRecord(agent.id, agent.status, 0);
      } catch (updateError) {
        console.error(`❌ Failed to update polling record after error:`, updateError);
      }
    }
  }

  /**
   * Mark agents as completed/inactive when they're no longer active
   */
  private async cleanupInactiveAgents(): Promise<void> {
    try {
      // Get agents that are no longer active but still in polling table
      const result = await this.env.DB.prepare(`
        SELECT p.agent_id, p.status as polling_status, a.status as current_status
        FROM active_agents_polling p
        LEFT JOIN agents a ON p.agent_id = a.id
        WHERE a.status NOT IN ('CREATING', 'PENDING', 'RUNNING')
        OR a.id IS NULL
      `).all();

      for (const row of result.results || []) {
        console.log(`🧹 Cleaning up inactive agent ${row.agent_id}`);
        
        // Remove from polling table
        await this.env.DB.prepare(`
          DELETE FROM active_agents_polling WHERE agent_id = ?
        `).bind(row.agent_id).run();
      }
    } catch (error) {
      console.error('❌ Failed to cleanup inactive agents:', error);
    }
  }

  /**
   * Main polling function - checks all active agents for new messages
   */
  async pollActiveAgents(): Promise<void> {
    console.log('🔄 Starting polling cycle for active agents...');

    try {
      // Get all active agents
      const activeAgents = await this.getActiveAgents();
      
      if (activeAgents.length === 0) {
        console.log('📭 No active agents found for polling');
        return;
      }

      console.log(`📊 Found ${activeAgents.length} active agents to poll`);

      // Poll each agent (with some parallelism but not too much to avoid rate limits)
      const batchSize = 3; // Process 3 agents at a time
      for (let i = 0; i < activeAgents.length; i += batchSize) {
        const batch = activeAgents.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(agent => this.pollAgent(agent)));
        
        // Small delay between batches
        if (i + batchSize < activeAgents.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Cleanup inactive agents
      await this.cleanupInactiveAgents();

      console.log('✅ Polling cycle completed');

    } catch (error) {
      console.error('❌ Error during polling cycle:', error);
    }
  }
}

/**
 * Create a polling service instance
 */
export function createPollingService(env: Env): PollingService {
  return new PollingService(env);
}