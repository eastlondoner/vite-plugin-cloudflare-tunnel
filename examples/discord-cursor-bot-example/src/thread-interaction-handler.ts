/**
 * Discord Thread Interaction Handler for Follow-up Messages.
 * Handles thread interactions from Discord event forwarder, extracts agent IDs,
 * and sends follow-up messages to existing Cursor agents.
 */

import { CursorApiService } from './cursor-service';
import { ThreadManager } from './thread-manager';
import { ApiKeyManager, createApiKeyManager } from './api-key-manager';
import type { 
  Env, 
  ThreadInteraction, 
  StoredCursorAgent,
  AgentDatabaseRow 
} from './types';
import { dbRowToStoredAgent } from './types';

/**
 * Service for handling Discord thread interactions and creating follow-up messages
 */
export class ThreadInteractionHandler {
  constructor(private env: Env) {}

  /**
   * Handle a thread interaction from Discord event forwarder
   */
  async handleThreadInteraction(interaction: ThreadInteraction): Promise<Response> {
    try {
      console.log(`🧵 Handling thread interaction in thread ${interaction.thread.id}`);
      console.log(`📝 Triggering message: "${interaction.triggering_message.content.substring(0, 100)}..."`);

      // Extract agent ID from the first bot message in the thread
      const agentId = this.extractAgentId(interaction.messages);
      if (!agentId) {
        console.error('❌ Could not extract agent ID from thread messages');
        return new Response('Agent ID not found in thread', { status: 400 });
      }

      console.log(`🤖 Found agent ID: ${agentId}`);

      // Get all user messages since the last bot message
      const followUpMessages = this.getMessagesSinceLastBot(interaction.messages);
      
      // Get the last reply user ID (for API key resolution)
      const lastReplyUserId = this.getLastReplyUserId(interaction.messages);

      // Skip if no meaningful user messages found
      if (followUpMessages.length === 0) {
        console.log('🤖 No user messages found since last bot message');
        return new Response('No user messages found', { status: 200 });
      }

      // Combine all messages into a single follow-up
      const combinedMessage = this.combineFollowUpMessages(followUpMessages);

      // Skip if the combined message is too short (likely not a meaningful follow-up)
      if (combinedMessage.trim().length < 4) {
        console.log('📏 Combined message too short, skipping');
        
        // Send a helpful message to the user
        const botToken = this.getDiscordBotToken();
        if (botToken) {
          const threadManager = new ThreadManager(botToken);
          const helpMessage = [
            '💬 **Message Too Short**',
            '',
            'Your message is too short to send as a follow-up. Please provide more detail about what you\'d like the agent to do.',
            '',
            '💡 **Example:** "Can you also add error handling to that function?"'
          ].join('\n');

          await threadManager.sendMessageToThread(interaction.thread.id, helpMessage);
        }
        
        return new Response('Message too short', { status: 200 });
      }

      // Create follow-up message to Cursor agent
      await this.createFollowUpMessage(
        agentId, 
        combinedMessage, 
        lastReplyUserId, 
        interaction.thread.id
      );

      return new Response('Follow-up message sent', { status: 200 });
    } catch (error) {
      console.error('❌ Error handling thread interaction:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Extract agent ID from thread messages by finding the initial bot message
   */
  private extractAgentId(messages: Array<any>): string | null {
    console.log(`🔍 Searching through ${messages.length} messages for agent ID`);

    // Find the first bot message containing the agent ID
    const botMessage = messages.find(msg => 
      msg.author.bot && 
      msg.content.includes('**Agent ID:**') &&
      msg.content.includes('🚀 **Agent Created Successfully!**')
    );

    if (!botMessage) {
      console.log('❌ No bot message with agent ID found');
      return null;
    }

    console.log(`🔍 Found bot message: "${botMessage.content.substring(0, 200)}..."`);

    // Extract agent ID using regex to match the backtick-wrapped ID
    const match = botMessage.content.match(/\*\*Agent ID:\*\* `([^`]+)`/);
    if (!match) {
      console.log('❌ No agent ID pattern found in bot message');
      return null;
    }

    const agentId = match[1];
    console.log(`✅ Extracted agent ID: ${agentId}`);
    return agentId;
  }

  /**
   * Get all user messages since the last bot message in the thread
   */
  private getMessagesSinceLastBot(messages: Array<any>): Array<any> {
    console.log(`🔍 Analyzing ${messages.length} messages to find user messages since last bot message`);

    // Sort messages by creation time (oldest first) without mutating original array
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Find the index of the last bot message
    let lastBotMessageIndex = -1;
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      if (sortedMessages[i].author.bot) {
        lastBotMessageIndex = i;
        break;
      }
    }

    console.log(`🤖 Last bot message found at index: ${lastBotMessageIndex}`);

    // Get all messages after the last bot message
    const messagesSinceBot = lastBotMessageIndex >= 0 
      ? sortedMessages.slice(lastBotMessageIndex + 1)
      : sortedMessages;

    // Filter to only include user messages (not bot messages)
    const userMessages = messagesSinceBot.filter(msg => !msg.author.bot);

    console.log(`📝 Found ${userMessages.length} user messages since last bot message`);
    return userMessages;
  }

  /**
   * Get the user ID of the last non-bot message in the thread
   */
  private getLastReplyUserId(messages: Array<any>): string {
    // Sort messages by creation time (newest first) without mutating original array
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Find the last user message (not bot message)
    const lastUserMessage = sortedMessages.find(msg => !msg.author.bot);
    return lastUserMessage?.author.id || '';
  }

  /**
   * Combine multiple follow-up messages into a single coherent message
   */
  private combineFollowUpMessages(messages: Array<any>): string {
    if (messages.length === 0) {
      return '';
    }

    if (messages.length === 1) {
      return messages[0].content;
    }

    // For multiple messages, combine them with context
    const combinedParts: string[] = [
      'Here are the follow-up requests from the user:',
      ''
    ];

    messages.forEach((msg, index) => {
      const author = msg.author.username || 'User';
      const timestamp = new Date(msg.created_at).toLocaleTimeString();
      
      combinedParts.push(`**${index + 1}.** (${author} at ${timestamp}):`);
      combinedParts.push(msg.content);
      combinedParts.push(''); // Empty line for separation
    });

    const combined = combinedParts.join('\n');
    console.log(`📝 Combined ${messages.length} messages into follow-up (${combined.length} characters)`);
    
    return combined;
  }

  /**
   * Create and send a follow-up message to an existing Cursor agent
   */
  private async createFollowUpMessage(
    agentId: string, 
    followUpMessage: string, 
    lastReplyUserId: string, 
    threadId: string
  ): Promise<void> {
    try {
      // Get agent details from database
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found in database`);
      }

      console.log(`📋 Found agent: ${agent.id} in channel ${agent.discordChannelId}`);

      // Get API key using thread-specific resolution logic
      const apiKeyManager = createApiKeyManager(this.env.API_KEYS);
      const apiKey = await apiKeyManager.resolveApiKeyForThread(
        agent.discordChannelId, 
        lastReplyUserId, 
        this.env.CURSOR_API_KEY
      );
      
      if (!apiKey) {
        throw new Error('No API key available for this channel');
      }

      // Send follow-up message to Cursor API
      console.log(`🔄 Sending follow-up to Cursor API...`);
      const cursorService = new CursorApiService(apiKey);
      const result = await cursorService.sendFollowUpMessage(agentId, followUpMessage);

      console.log(`✅ Follow-up message sent to Cursor API. Response ID: ${result.id}`);

      // Send acknowledgment to Discord thread
      const botToken = this.getDiscordBotToken();
      if (botToken) {
        const threadManager = new ThreadManager(botToken);
        const acknowledgmentMessage = [
          '🔄 **Follow-up Message Sent**',
          '',
          'Your follow-up request has been sent to the agent. I\'ll post updates here when the agent responds!',
          '',
          `*Follow-up ID: \`${result.id}\`*`
        ].join('\n');

        await threadManager.sendMessageToThread(threadId, acknowledgmentMessage);
        console.log(`✅ Sent acknowledgment to Discord thread`);
      }

    } catch (error) {
      console.error('❌ Error creating follow-up message:', error);
      
      // Send error message to Discord thread
      const botToken = this.getDiscordBotToken();
      if (botToken) {
        const threadManager = new ThreadManager(botToken);
        const errorMessage = [
          '❌ **Follow-up Error**',
          '',
          `Failed to send follow-up message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          '',
          '🔧 Please try again or check your agent status with `/agents list`.'
        ].join('\n');

        await threadManager.sendMessageToThread(threadId, errorMessage);
      }

      throw error;
    }
  }

  /**
   * Get agent details from database by agent ID
   */
  private async getAgentById(agentId: string): Promise<StoredCursorAgent | null> {
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
      console.error(`❌ Failed to get agent ${agentId} from database:`, error);
      return null;
    }
  }

  /**
   * Get Discord bot token from environment
   */
  private getDiscordBotToken(): string | null {
    return this.env.DISCORD_BOT_TOKEN || null;
  }

  /**
   * Validate thread interaction data
   */
  private validateThreadInteraction(interaction: any): interaction is ThreadInteraction {
    return (
      interaction &&
      typeof interaction === 'object' &&
      interaction.type === 99 &&
      interaction.thread &&
      typeof interaction.thread.id === 'string' &&
      Array.isArray(interaction.messages) &&
      interaction.triggering_message &&
      typeof interaction.triggering_message.content === 'string'
    );
  }

  /**
   * Handle incoming thread interaction request
   */
  async handleThreadInteractionRequest(request: Request): Promise<Response> {
    try {
      // Validate request method
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Parse interaction payload
      let interaction: any;
      try {
        interaction = await request.json();
      } catch (error) {
        console.error('❌ Failed to parse thread interaction payload:', error);
        return new Response('Invalid JSON payload', { status: 400 });
      }

      // Validate thread interaction structure
      if (!this.validateThreadInteraction(interaction)) {
        console.error('❌ Invalid thread interaction structure:', interaction);
        return new Response('Invalid thread interaction structure', { status: 400 });
      }

      // Process the thread interaction
      return await this.handleThreadInteraction(interaction);

    } catch (error) {
      console.error('❌ Thread interaction handler error:', error);
      
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
 * Create a thread interaction handler instance
 */
export function createThreadInteractionHandler(env: Env): ThreadInteractionHandler {
  return new ThreadInteractionHandler(env);
}

/**
 * Main thread interaction handler function (for compatibility)
 */
export async function handleThreadInteraction(request: Request, env: Env): Promise<Response> {
  const internalKey = request.headers.get('X-Discord-Webhook-Secret');
  if(internalKey === process.env.INTERNAL_WEBHOOK_SECRET) {
    console.log('🔒 Internal key detected');
  } else {
    return new Response('Unauthorized', { status: 401 });
  }

  const handler = createThreadInteractionHandler(env);
  return handler.handleThreadInteractionRequest(request);
}