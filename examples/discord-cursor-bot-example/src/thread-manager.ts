/**
 * Discord Thread Management for Cursor Background Agents.
 * Handles creating and updating Discord threads for agent progress tracking.
 */

import type { AgentStatus } from './cursor-api-types';

/**
 * Manages Discord threads for Cursor agents.
 * Each agent gets its own thread for progress updates and communication.
 */
export class ThreadManager {
  constructor(private readonly botToken: string) {
    if (!botToken) {
      throw new Error('Discord bot token is required for thread management');
    }
  }

  /**
   * Create a new Discord thread for an agent.
   * The thread will be used for real-time progress updates.
   */
  async createAgentThread(
    channelId: string, 
    agentId: string, 
    prompt: string
  ): Promise<{ id: string; name: string } | null> {
    try {
      // Create a descriptive thread name (Discord has a 100 character limit)
      const shortAgentId = agentId.slice(-8);
      const shortPrompt = prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt;
      const threadName = `🤖 Agent ${shortAgentId} - ${shortPrompt}`;
      
      console.log(`🧵 Creating Discord thread for agent ${agentId} in channel ${channelId}`);
      
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          name: threadName,
          type: 11, // PUBLIC_THREAD
          auto_archive_duration: 1440, // 24 hours
          invitable: false, // Only people with access to parent channel can join
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to create thread: ${response.status} ${response.statusText}`, errorText);
        return null;
      }

      const thread = await response.json() as { id: string; name: string };
      console.log(`✅ Created thread ${thread.id} for agent ${agentId}`);

      // Send initial message to the thread
      await this.sendInitialMessage(thread.id, agentId, prompt);

      return {
        id: thread.id,
        name: thread.name,
      };
    } catch (error) {
      console.error('❌ Error creating Discord thread:', error);
      return null;
    }
  }

  /**
   * Send an initial welcome message to the agent thread
   */
  private async sendInitialMessage(threadId: string, agentId: string, prompt: string): Promise<void> {
    try {
      const cursorWebUrl = `https://cursor.com/agents?id=${agentId}`;
      const welcomeMessage = [
        `🚀 **Agent Created Successfully!**`,
        ``,
        `**Agent ID:** \`${agentId}\``,
        `**Task:** ${prompt}`,
        ``,
        `🌐 **View in Cursor Web App:** ${cursorWebUrl}`,
        ``,
        `I'll post updates here as the agent works on your task. Stay tuned! 👀`
      ].join('\n');

      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          content: welcomeMessage,
        }),
      });
    } catch (error) {
      console.error('❌ Error sending initial message:', error);
    }
  }

  /**
   * Update a thread with agent progress information.
   * Uses status-specific emojis and formatting for better UX.
   */
  async updateThreadWithProgress(
    threadId: string, 
    status: AgentStatus, 
    message: string,
    agentId?: string
  ): Promise<void> {
    try {
      const statusEmojis: Record<AgentStatus, string> = {
        'CREATING': '🏗️',
        'PENDING': '⏳',
        'RUNNING': '⚙️',
        'FINISHED': '✅',
        'ERROR': '❌',
        'EXPIRED': '⏰',
      };

      const emoji = statusEmojis[status] || '📡';
      const timestamp = new Date().toLocaleTimeString();
      
      // Format the status update message
      const statusMessage = [
        `${emoji} **Status Update: ${status}**`,
        `🕒 ${timestamp}`,
        '',
        message,
        agentId ? `\n*Agent ID: \`${agentId}\`*` : ''
      ].filter(Boolean).join('\n');

      console.log(`📢 Updating thread ${threadId} with status: ${status}`);

      const response = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          content: statusMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to update thread: ${response.status} ${response.statusText}`, errorText);
      } else {
        console.log(`✅ Updated thread ${threadId} with ${status} status`);
      }
    } catch (error) {
      console.error('❌ Error updating thread with progress:', error);
    }
  }

  /**
   * Send a completion message to the thread when an agent finishes
   */
  async sendCompletionMessage({
    threadId,
    agentId,
    summary,
    prUrl,
    cursorUrl,
    branchName,
  }: {
    threadId: string,
    agentId: string,
    summary?: string,
    prUrl?: string,
    cursorUrl?: string,
    branchName?: string
  }): Promise<void> {
    try {
      const completionParts = [
        '🎉 **Agent Task Completed!**',
        '',
        summary ? `**Summary:** ${summary}` : '',
        branchName ? `**Branch:** \`${branchName}\`` : '',
        prUrl ? `**Pull Request:** ${prUrl}` : '',
        cursorUrl ? `**Cursor URL:** ${cursorUrl}` : '',
        '',
        '✨ Great work! Your task has been completed successfully.'
      ].filter(Boolean);

      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          content: completionParts.join('\n'),
        }),
      });
    } catch (error) {
      console.error('❌ Error sending completion message:', error);
    }
  }

  /**
   * Send an error message to the thread when an agent fails
   */
  async sendErrorMessage(
    threadId: string,
    agentId: string,
    error: string
  ): Promise<void> {
    try {
      const errorMessage = [
        '❌ **Agent Error**',
        '',
        `**Agent ID:** \`${agentId}\``,
        `**Error:** ${error}`,
        '',
        '🔧 You may want to try creating a new agent with a different approach or check your repository settings.'
      ].join('\n');

      await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          content: errorMessage,
        }),
      });
    } catch (error) {
      console.error('❌ Error sending error message:', error);
    }
  }

  /**
   * Send a general message to a Discord thread
   * Used for follow-up acknowledgments and other general messages
   */
  async sendMessageToThread(threadId: string, content: string): Promise<void> {
    try {
      console.log(`💬 Sending message to thread ${threadId}`);

      const response = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to send message to thread: ${response.status} ${response.statusText}`, errorText);
      } else {
        console.log(`✅ Sent message to thread ${threadId}`);
      }
    } catch (error) {
      console.error('❌ Error sending message to thread:', error);
    }
  }

  /**
   * Archive a thread (useful when an agent expires or is no longer needed)
   */
  async archiveThread(threadId: string, reason?: string): Promise<void> {
    try {
      console.log(`📦 Archiving thread ${threadId}${reason ? ` (${reason})` : ''}`);
      
      // Send final message before archiving
      if (reason) {
        await this.sendMessageToThread(threadId, `📦 **Thread Archived**\n\n${reason}`);
      }

      // Archive the thread
      await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Cursor-Bot/1.0',
        },
        body: JSON.stringify({
          archived: true,
        }),
      });
    } catch (error) {
      console.error('❌ Error archiving thread:', error);
    }
  }
}

/**
 * Create a ThreadManager instance with the given bot token
 */
export function createThreadManager(botToken: string): ThreadManager {
  return new ThreadManager(botToken);
}