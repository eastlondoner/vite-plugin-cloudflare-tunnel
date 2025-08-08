/**
 * Discord slash command definitions for the Cursor Background Agents bot.
 * These commands integrate Discord interactions with Cursor's Background Agents API.
 */

// Discord Application Command Types
export const ApplicationCommandType = {
  CHAT_INPUT: 1,
  USER: 2,
  MESSAGE: 3,
} as const;

export const ApplicationCommandOptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const;

/**
 * Main /agents command with subcommands for managing Cursor agents
 */
export const AGENT_COMMANDS = {
  name: 'agents',
  description: 'Manage Cursor background agents',
  type: ApplicationCommandType.CHAT_INPUT,
  options: [
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'set-api-key',
      description: 'Set Cursor API key for user or channel',
      options: [{
        type: ApplicationCommandOptionType.STRING,
        name: 'type',
        description: 'Set API key for user or channel',
        required: true,
        choices: [
          { name: 'User (Personal API Key)', value: 'user' },
          { name: 'Channel (Shared API Key)', value: 'channel' }
        ]
      }]
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'create',
      description: 'Create a new Cursor agent',
      options: [
        {
          type: ApplicationCommandOptionType.STRING,
          name: 'prompt',
          description: 'Instructions for the agent',
          required: true
        },
        {
          type: ApplicationCommandOptionType.STRING,
          name: 'repository',
          description: 'GitHub repository URL (e.g., https://github.com/org/repo)',
          required: true
        },
        {
          type: ApplicationCommandOptionType.STRING,
          name: 'model',
          description: 'Model to use for the agent (optional)',
          required: false
        }
      ]
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'list',
      description: 'List agents in this channel',
      options: [{
        type: ApplicationCommandOptionType.INTEGER,
        name: 'limit',
        description: 'Number of agents to show (default: 10)',
        required: false,
        min_value: 1,
        max_value: 50
      }]
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'set-default-repo',
      description: 'Set default repository for /task command',
      options: [{
        type: ApplicationCommandOptionType.STRING,
        name: 'repository',
        description: 'GitHub repository URL (e.g., https://github.com/org/repo)',
        required: true
      }]
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'remove-api-key',
      description: 'Remove Cursor API key for user or channel',
      options: [{
        type: ApplicationCommandOptionType.STRING,
        name: 'type',
        description: 'Remove API key for user or channel',
        required: true,
        choices: [
          { name: 'User (Personal API Key)', value: 'user' },
          { name: 'Channel (Shared API Key)', value: 'channel' }
        ]
      }]
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'api-key-status',
      description: 'Check which API key would be used',
      options: []
    },
    {
      type: ApplicationCommandOptionType.SUB_COMMAND,
      name: 'sync-commands',
      description: 'Admin: Sync slash commands for this guild',
      options: []
    }
  ]
} as const;

/**
 * Quick /task command for creating agents with minimal input
 */
export const TASK_COMMAND = {
  name: 'task',
  description: 'Quick task agent creation (uses channel default repository)',
  type: ApplicationCommandType.CHAT_INPUT,
  options: [
    {
      type: ApplicationCommandOptionType.STRING,
      name: 'prompt',
      description: 'Task description for the agent',
      required: true
    },
    {
      type: ApplicationCommandOptionType.STRING,
      name: 'repository',
      description: 'GitHub repository URL (overrides channel default)',
      required: false
    }
  ]
} as const;

/**
 * /agent command for individual agent operations
 */
export const AGENT_LOGS_COMMAND = {
  name: 'agent',
  description: 'Agent operations',
  type: ApplicationCommandType.CHAT_INPUT,
  options: [{
    type: ApplicationCommandOptionType.SUB_COMMAND,
    name: 'logs',
    description: 'View agent conversation logs',
    options: [{
      type: ApplicationCommandOptionType.STRING,
      name: 'agent_id',
      description: 'Agent ID to view logs for',
      required: true
    }]
  }]
} as const;

/**
 * All commands that should be registered with Discord
 */
export const ALL_COMMANDS = [
  AGENT_COMMANDS,
  TASK_COMMAND,
  AGENT_LOGS_COMMAND,
] as const;

/**
 * Command names for easy reference
 */
export const COMMAND_NAMES = {
  AGENTS: 'agents',
  TASK: 'task',
  AGENT: 'agent',
} as const;

/**
 * Subcommand names for agents command
 */
export const AGENTS_SUBCOMMANDS = {
  SET_API_KEY: 'set-api-key',
  CREATE: 'create',
  LIST: 'list',
  SET_DEFAULT_REPO: 'set-default-repo',
  REMOVE_API_KEY: 'remove-api-key',
  API_KEY_STATUS: 'api-key-status',
  SYNC_COMMANDS: 'sync-commands',
} as const;

/**
 * Agent subcommand names
 */
export const AGENT_SUBCOMMANDS = {
  LOGS: 'logs',
} as const;