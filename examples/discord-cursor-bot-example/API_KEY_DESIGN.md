# API Key Management Design Proposal

## Overview

This document proposes an enhanced API key management system for the Cursor Discord Bot that allows users to save API keys either for themselves (by user ID) or for a channel. The system implements a hierarchical resolution strategy for determining which API key to use when running agents.

## Current State

The current implementation only supports channel-level API keys stored in Cloudflare KV with the pattern:
- **Storage Key**: `channel:{channelId}:api_key`
- **Resolution**: Channel key → Default fallback key

## Proposed Changes

### 1. Enhanced Storage Schema

#### User API Keys
- **Storage Key**: `user:{userId}:api_key`
- **Data Structure**:
```typescript
interface UserApiKey {
  userId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Channel API Keys (Enhanced)
- **Storage Key**: `channel:{channelId}:api_key` (unchanged)
- **Data Structure** (unchanged):
```typescript
interface ChannelApiKey {
  channelId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. API Key Resolution Logic

#### For Regular Agent Creation (Slash Commands)
**Priority Order:**
1. **Requesting User's API Key** (`user:{userId}:api_key`)
2. **Channel API Key** (`channel:{channelId}:api_key`)
3. **Default/Fallback API Key** (environment variable)

#### For Thread Replies (Follow-up Messages)
**Priority Order:**
1. **Channel API Key** (`channel:{channelId}:api_key`)
2. **Last Reply User's API Key** (`user:{lastReplyUserId}:api_key`)
3. **Default/Fallback API Key** (environment variable)

**Note**: For thread replies, we prioritize the channel key first, then check the user ID of the *last reply in the thread only* (not the original requester).

### 3. Implementation Details

#### Enhanced API Key Manager

```typescript
export class ApiKeyManager {
  constructor(private readonly kv: KVNamespace) {}

  // User API key methods
  async setUserApiKey(userId: string, apiKey: string): Promise<void>
  async getUserApiKey(userId: string): Promise<string | null>
  async deleteUserApiKey(userId: string): Promise<void>

  // Channel API key methods (existing)
  async setApiKey(channelId: string, apiKey: string): Promise<void>
  async getApiKey(channelId: string): Promise<string | null>
  async deleteApiKey(channelId: string): Promise<void>

  // Enhanced resolution methods
  async resolveApiKeyForAgent(
    channelId: string, 
    userId: string, 
    defaultApiKey?: string
  ): Promise<string | null>

  async resolveApiKeyForThread(
    channelId: string, 
    lastReplyUserId: string, 
    defaultApiKey?: string
  ): Promise<string | null>
}
```

#### New Discord Commands

**Unified API Key Management:**
```
/agents set-api-key [type: user|channel]
  - type: user - Sets API key for the requesting user
  - type: channel - Sets API key for current channel
  - Uses Discord Modal for secure input
  - Channel type requires appropriate Discord permissions

/agents remove-api-key [type: user|channel]
  - type: user - Removes the requesting user's API key
  - type: channel - Removes channel API key (requires permissions)
  - Confirmation prompt for safety
```

**Status/Info Commands:**
```
/agents api-key-status
  - Shows which API key would be used (without revealing the key)
  - Example output:
    "✅ User API Key (your personal key will be used)"
    "🏢 Channel API Key (channel key will be used)" 
    "🔄 Default API Key (fallback key will be used)"
    "❌ No API Key Available"
```

#### Thread Reply Enhancement

**Current Thread Handler Changes:**
```typescript
class ThreadInteractionHandler {
  private async createFollowUpMessage(
    agentId: string, 
    followUpMessage: string, 
    lastReplyUserId: string,  // Changed: now tracks last reply user
    threadId: string
  ): Promise<void> {
    // Get agent details to find parent channel
    const agent = await this.getAgentById(agentId);
    const channelId = agent.discordChannelId;

    // NEW: Use thread-specific resolution logic
    const apiKeyManager = createApiKeyManager(this.env.API_KEYS);
    const apiKey = await apiKeyManager.resolveApiKeyForThread(
      channelId, 
      lastReplyUserId,  // Use last reply user, not original requester
      this.env.CURSOR_API_KEY
    );

    // ... rest of the method unchanged
  }

  private getLastReplyUserId(messages: Array<any>): string {
    // Find the last non-bot message in the thread
    const sortedMessages = messages.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const lastUserMessage = sortedMessages.find(msg => !msg.author.bot);
    return lastUserMessage?.author.id || '';
  }
}
```

### 4. Database Schema Changes

No database schema changes required - all API keys are stored in Cloudflare KV.

### 5. Security Considerations

#### Key Isolation
- User keys are completely isolated by user ID
- Channel keys are isolated by channel ID
- No cross-contamination possible

#### Access Control
- Users can only set/remove their own API keys
- Channel API key management requires appropriate Discord permissions
- All API key operations use Discord Modals for secure input

#### Key Validation
- All API keys are validated against Cursor API before storage
- Invalid keys are rejected with clear error messages
- Validation happens on both user and channel key operations

### 6. User Experience

#### Clear Feedback
- Commands show which type of API key will be used
- Status command reveals the resolution hierarchy
- Error messages clearly indicate missing API key type

#### Flexible Configuration
- Teams can use channel keys for shared access
- Individual users can override with personal keys
- Fallback to default key ensures system reliability

#### Thread Context Awareness
- Thread replies respect channel-first policy
- Last replier's context is preserved
- Clear indication of which key is being used

### 7. Migration Strategy

#### Backward Compatibility
- All existing channel API keys continue to work
- No breaking changes to existing commands
- Gradual rollout of new features

#### Migration Steps
1. Deploy enhanced API key manager
2. Add new user API key commands
3. Update thread handler logic
4. Add status/info commands
5. Update documentation and examples

### 8. Implementation Files

#### New Files
- `src/types.ts` - Add `UserApiKey` interface
- Enhanced `src/api-key-manager.ts` - New resolution methods
- Updated `src/discord-commands.ts` - New command definitions

#### Modified Files
- `src/worker.ts` - New command handlers
- `src/thread-interaction-handler.ts` - Updated resolution logic
- `README.md` - Updated documentation

### 9. Example Usage Scenarios

#### Scenario 1: Team Channel with Individual Overrides
```
Setup Commands:
- Admin runs: /agents set-api-key type:channel → Sets team_key_123
- Alice runs: /agents set-api-key type:user → Sets alice_key_456
- Bob has no personal key (uses channel key)

Agent Creation:
- Alice runs /task "fix bug" → Uses alice_key_456 (user key priority)
- Bob runs /task "add feature" → Uses team_key_123 (channel key)

Thread Replies:
- In Alice's agent thread, Bob replies → Uses team_key_123 (channel first)
- In Bob's agent thread, Alice replies → Uses team_key_123 (channel first)
```

#### Scenario 2: Personal Channel
```
Setup Commands:
- Alice runs: /agents set-api-key type:user → Sets alice_key_456
- No channel key set

Agent Creation:
- Alice runs /task "experiment" → Uses alice_key_456
- Bob runs /task "help" → ❌ No API key available

Thread Replies:
- In Alice's thread, Alice replies → Uses alice_key_456
- In Alice's thread, Bob replies → ❌ No API key available
```

#### Scenario 3: Thread with Multiple Users
```
Setup Commands:
- Admin runs: /agents set-api-key type:channel → Sets collab_key_789
- Alice runs: /agents set-api-key type:user → Sets alice_key_456
- Bob runs: /agents set-api-key type:user → Sets bob_key_123

Agent Creation:
- Alice runs /agents create "project setup" → Uses alice_key_456

Thread Activity:
1. Alice replies "add tests" → Uses collab_key_789 (channel first)
2. Bob replies "fix linting" → Uses collab_key_789 (channel first) 
3. Charlie (no personal key) replies "deploy" → Uses collab_key_789

Note: All thread replies use channel key since it's available
```

This design provides maximum flexibility while maintaining clear, predictable behavior for both individual and team usage scenarios.