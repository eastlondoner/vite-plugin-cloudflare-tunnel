# Implementation Summary: Enhanced API Key Management

## Key Changes Required

### 1. Types Enhancement (`src/types.ts`)

Add new interface for user API keys:

```typescript
export interface UserApiKey {
  userId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. API Key Manager Enhancement (`src/api-key-manager.ts`)

Add new methods to the `ApiKeyManager` class:

```typescript
// User API key methods
async setUserApiKey(userId: string, apiKey: string): Promise<void>
async getUserApiKey(userId: string): Promise<string | null>
async deleteUserApiKey(userId: string): Promise<void>

// Enhanced resolution methods
async resolveApiKeyForAgent(channelId: string, userId: string, defaultApiKey?: string): Promise<string | null>
async resolveApiKeyForThread(channelId: string, lastReplyUserId: string, defaultApiKey?: string): Promise<string | null>
```

**Storage Pattern for User Keys**: `user:{userId}:api_key`

### 3. Discord Commands (`src/discord-commands.ts`)

**Update existing `set-api-key` subcommand** to include type parameter:

```typescript
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
}
```

**Add new subcommands**:

```typescript
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
}
```

### 4. Worker Command Handlers (`src/worker.ts`)

**Update existing handler** to support type parameter:

```typescript
case 'set-api-key':
  const apiKeyType = subcommand.options?.find((opt: any) => opt.name === 'type')?.value;
  response = await handleSetApiKey(interaction, channelId, userId, apiKeyType, env);
  break;
```

**Add new handlers**:

```typescript
case 'remove-api-key':
  const removeType = subcommand.options?.find((opt: any) => opt.name === 'type')?.value;
  response = await handleRemoveApiKey(interaction, channelId, userId, removeType, env);
  break;
case 'api-key-status':
  response = await handleApiKeyStatus(interaction, channelId, userId, env);
  break;
```

**Updated Handler Function Signatures**:

```typescript
async function handleSetApiKey(
  interaction: any,
  channelId: string,
  userId: string,
  type: 'user' | 'channel',
  env: Env
): Promise<InteractionResponse>

async function handleRemoveApiKey(
  interaction: any,
  channelId: string,
  userId: string,
  type: 'user' | 'channel',
  env: Env
): Promise<InteractionResponse>
```

Update existing agent creation to use new resolution:

```typescript
// Replace getEffectiveApiKey calls with:
const apiKey = await keyManager.resolveApiKeyForAgent(channelId, userId, env.CURSOR_API_KEY);
```

### 5. Thread Handler Enhancement (`src/thread-interaction-handler.ts`)

**Critical Change**: Update thread reply handling to use the last reply user ID and channel-first resolution:

```typescript
private async createFollowUpMessage(
  agentId: string, 
  followUpMessage: string, 
  lastReplyUserId: string,  // Changed parameter
  threadId: string
): Promise<void> {
  // Get parent channel from agent
  const agent = await this.getAgentById(agentId);
  const channelId = agent.discordChannelId;

  // Use thread-specific resolution (channel first, then last reply user)
  const apiKeyManager = createApiKeyManager(this.env.API_KEYS);
  const apiKey = await apiKeyManager.resolveApiKeyForThread(
    channelId, 
    lastReplyUserId,
    this.env.CURSOR_API_KEY
  );
  
  // ... rest unchanged
}

// Update caller to pass last reply user ID
public async handleThreadInteraction(interaction: ThreadInteraction): Promise<Response> {
  const lastReplyUserId = this.getLastReplyUserId(interaction.messages);
  
  await this.createFollowUpMessage(
    agentId, 
    combinedMessage, 
    lastReplyUserId,  // Changed: use last reply user, not triggering message user
    interaction.thread.id
  );
}

private getLastReplyUserId(messages: Array<any>): string {
  const sortedMessages = messages.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const lastUserMessage = sortedMessages.find(msg => !msg.author.bot);
  return lastUserMessage?.author.id || '';
}
```

## Resolution Logic Summary

### For Agent Creation (Slash Commands):
1. User's personal API key
2. Channel API key  
3. Default/fallback API key

### For Thread Replies:
1. Channel API key
2. Last reply user's API key
3. Default/fallback API key

## Backward Compatibility

- All existing channel API keys continue to work unchanged
- Existing commands remain functional
- New features are additive, no breaking changes

## Security Features

- User keys isolated by Discord user ID
- Channel keys isolated by Discord channel ID
- All API key input via secure Discord Modals
- API key validation before storage
- Clear error messages for missing keys

This implementation provides flexible API key management while maintaining the specific thread reply behavior requested (channel-first, then last reply user).