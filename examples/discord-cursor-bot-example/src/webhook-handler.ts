/**
 * Cursor API Webhook Handler for Discord Integration.
 * Processes webhook events from Cursor Background Agents API and updates Discord threads.
 */

import { ThreadManager } from './thread-manager';
import type { 
  CursorWebhookEvent, 
  Env, 
  StoredCursorAgent, 
  AgentDatabaseRow 
} from './types';
import { dbRowToStoredAgent } from './types';

/**
 * Service for handling Cursor API webhook events and updating agent status
 */
export class WebhookHandler {
  constructor(private env: Env) {}

  /**
   * Get Discord bot token from environment
   */
  private getDiscordBotToken(): string | null {
    return this.env.DISCORD_BOT_TOKEN || null;
  }

  /**
   * Update agent status in the database
   */
  private async updateAgentStatus(
    agentId: string, 
    status: string, 
    error?: string,
    summary?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    try {
      await this.env.DB.prepare(`
        UPDATE agents 
        SET status = ?, error = ?, updated_at = ?
        WHERE id = ?
      `).bind(status, error || null, now, agentId).run();

      console.log(`📝 Updated agent ${agentId} status to ${status}`);
    } catch (error) {
      console.error(`❌ Failed to update agent ${agentId} status:`, error);
      throw error;
    }
  }

  /**
   * Get agent details from the database
   */
  private async getAgent(agentId: string): Promise<StoredCursorAgent | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM agents WHERE id = ?
      `).bind(agentId).first<AgentDatabaseRow>();

      if (!result) {
        console.log(`⚠️ Agent ${agentId} not found in database`);
        return null;
      }

      return dbRowToStoredAgent(result);
    } catch (error) {
      console.error(`❌ Failed to get agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Mark webhook as active for an agent (so polling knows webhook is working)
   */
  private async markWebhookActive(agentId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      // Try to update existing record first
      const result = await this.env.DB.prepare(`
        UPDATE active_agents_polling 
        SET webhook_active = TRUE, updated_at = ?
        WHERE agent_id = ?
      `).bind(now, agentId).run();

      // If no rows were updated, insert a new record
      if (result.changes === 0) {
        await this.env.DB.prepare(`
          INSERT INTO active_agents_polling (agent_id, status, last_polled_at, last_message_index, webhook_active, updated_at)
          VALUES (?, 'WEBHOOK_ACTIVE', ?, 0, TRUE, ?)
        `).bind(agentId, now, now).run();
      }
    } catch (error) {
      console.error(`❌ Failed to mark webhook active for agent ${agentId}:`, error);
    }
  }

  /**
   * Process a Cursor webhook event and update Discord accordingly
   */
  async processWebhookEvent(event: CursorWebhookEvent): Promise<void> {
    console.log(`🔔 Processing webhook event for agent ${event.id}:`, {
      status: event.status,
      summary: event.summary?.substring(0, 100) + '...' || 'No summary',
      timestamp: event.timestamp
    });

    try {
      // Mark webhook as active for this agent
      await this.markWebhookActive(event.id);

      // Update agent status in database
      await this.updateAgentStatus(
        event.id, 
        event.status, 
        event.error ? String(event.error) : undefined,
        event.summary
      );

      // Get agent details to find associated Discord thread
      const agent = await this.getAgent(event.id);
      if (!agent) {
        console.log(`⚠️ No agent found for webhook event: ${event.id}`);
        return;
      }

      if (!agent.discordThreadId) {
        console.log(`⚠️ No Discord thread associated with agent: ${event.id}`);
        return;
      }

      // Send update to Discord thread
      const botToken = this.getDiscordBotToken();
      if (!botToken) {
        console.log('⚠️ No Discord bot token configured, skipping thread update');
        return;
      }

      const threadManager = new ThreadManager(botToken);
      await this.updateDiscordThread(threadManager, agent, event);

    } catch (error) {
      console.error(`❌ Failed to process webhook event for agent ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Update the Discord thread based on the webhook event
   */
  private async updateDiscordThread(
    threadManager: ThreadManager,
    agent: StoredCursorAgent,
    event: CursorWebhookEvent
  ): Promise<void> {
    if (!agent.discordThreadId) return;

    const statusMessage = this.formatStatusMessage(event);

    // Handle different status types with appropriate responses
    switch (event.status) {
      case 'FINISHED':
        await threadManager.sendCompletionMessage({
          threadId: agent.discordThreadId,
          agentId: agent.id,
          summary: event.summary,
          prUrl: event.target.prUrl,
          cursorUrl: event.target.url,
          branchName: event.target.branchName,
        });
        break;

      case 'ERROR':
        await threadManager.sendErrorMessage(
          agent.discordThreadId,
          agent.id,
          event.error ? String(event.error) : 'Unknown error occurred'
        );
        break;

      case 'RUNNING':
        await threadManager.updateThreadWithProgress(
          agent.discordThreadId,
          event.status,
          statusMessage,
          agent.id
        );
        break;

      case 'CREATING':
        await threadManager.updateThreadWithProgress(
          agent.discordThreadId,
          event.status,
          'Agent is being initialized and will start working on your task soon...',
          agent.id
        );
        break;

      default:
        await threadManager.updateThreadWithProgress(
          agent.discordThreadId,
          event.status,
          statusMessage,
          agent.id
        );
    }
  }

  /**
   * Format the status message for Discord thread updates
   */
  private formatStatusMessage(event: CursorWebhookEvent): string {
    const parts: string[] = [];

    if (event.summary) {
      parts.push(event.summary);
    }

    if (event.target?.branchName) {
      parts.push(`**Branch:** \`${event.target.branchName}\``);
    }

    if (event.target?.url && event.status === 'FINISHED') {
      parts.push(`**Result:** ${event.target.url}`);
    }

    if (event.source?.repository) {
      parts.push(`**Repository:** ${event.source.repository}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : 'Agent status updated.';
  }

  /**
   * Validate webhook event data
   */
  private validateWebhookEvent(event: any): event is CursorWebhookEvent {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.id === 'string' &&
      typeof event.status === 'string' &&
      typeof event.timestamp === 'string' &&
      event.event === 'statusChange'
    );
  }

  /**
   * Handle incoming webhook request from Cursor API
   */
  async handleWebhookRequest(request: Request): Promise<Response> {
    try {
      // Validate request method
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Parse webhook payload
      let event: any;
      try {
        event = await request.json();
      } catch (error) {
        console.error('❌ Failed to parse webhook payload:', error);
        return new Response('Invalid JSON payload', { status: 400 });
      }

      // Validate webhook event structure
      if (!this.validateWebhookEvent(event)) {
        console.error('❌ Invalid webhook event structure:', event);
        return new Response('Invalid webhook event structure', { status: 400 });
      }

      // Process the webhook event
      await this.processWebhookEvent(event);

      // Return success response
      return new Response('OK', { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        }
      });

    } catch (error) {
      console.error('❌ Webhook handler error:', error);
      
      return new Response('Internal server error', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        }
      });
    }
  }
}

/**
 * Create a webhook handler instance
 */
export function createWebhookHandler(env: Env): WebhookHandler {
  return new WebhookHandler(env);
}

/**
 * Main webhook handler function (for compatibility with existing code)
 */
export async function handleCursorWebhook(request: Request, env: Env): Promise<Response> {
  const handler = createWebhookHandler(env);
  return handler.handleWebhookRequest(request);
}