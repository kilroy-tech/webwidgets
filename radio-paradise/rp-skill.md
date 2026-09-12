SKILL_ID rp
SKILL_TEXT
---
# Radio Paradise WebWidget Communication

## CRITICAL: Communication Method
**NEVER use any tool (swarm_message, kilroy.groups.send_to_chat, or any other tool) to communicate with the Radio Paradise webwidget.**

**ALWAYS output commands directly as plain text in your response.** The chat interface automatically detects the `/wa` prefix and forwards your command to the webwidget. The webwidget then responds in the chat, and you read that response.

### Correct Pattern:
1. You output: `/wa /ww.rp.<command> <parameters>`
2. The chat interface forwards it to the webwidget
3. The webwidget responds in chat with: `/ww.rp.results { ... }`
4. You read the response and present it to the user

### WRONG: Using tool calls
- `kilroy.ai.harness.swarm_message(message: "/wa /ww.rp.status <player-id>")`
- `kilroy.groups.send_to_chat(text: "/wa /ww.rp.status <player-id>")`
- Any other tool-based communication

### RIGHT: Direct text output
After determining the actual player ID, write `/wa /ww.rp.status <player-id>` as plain text in your response. Nothing else. No explanation. No formatting. Just the command on its own line.

## Player ID
The player ID is environment- and user-specific. Never assume an example value is the user's ID. If the ID is not already known from the conversation or trusted context, ask the user for it before issuing a command. Use an example ID only after the user confirms that it is their actual ID.

An unset/empty player ID or configured ID `*` causes a widget to accept commands addressed to any target ID. This does not authorize guessing an ID: request the intended ID from the user when it is unknown.

## Available Commands

### `/ww.rp.play <id> [local]`
Start playback on the specified player.

### `/ww.rp.pause <id> [local]`
Pause playback on the specified player.

### `/ww.rp.channel <id> <chan> [local]`
Switch to a different channel. Valid channel values are the numbers listed in the Channel Reference table below.

### `/ww.rp.volume <id> <percent> [local]`
Set volume level from `0` to `100`.

### `/ww.rp.status <id> [local]`
Return current player status including:
- Channel information
- Volume level
- Now-playing song details (title, artist, album, year)
- Playback progress
- Cover art URL

### `/ww.rp.help [id] [local]`
Display help documentation for all available commands.

## Channel Reference

| Channel Number | Channel Name |
|----------------|--------------|
| 0 | The Main Mix |
| 1 | Mellow Mix |
| 2 | RockIt! |
| 3 | The Globe |
| 5 | Beyond... |
| 42 | Serenity |
| 945 | KFAT |

## Response Format
The webwidget responds in chat as:
```
/ww.rp.results { id, status, msg }
```

Where:
- `id` = The configured player identifier, which may be empty or `*` for a wildcard player
- `status` = Operation status ("OK" or error)
- `msg` = Command-specific message or data

## Examples

**Play music:**
Output: `/wa /ww.rp.play <player-id>`
Response in chat: `/ww.rp.results {"id":"<player-id>","status":"OK","msg":"Playback started"}`

**Get status:**
Output: `/wa /ww.rp.status <player-id>`
Response in chat: `/ww.rp.results {"id":"<player-id>","status":"OK","msg":"{...status JSON...}"}`

**Set volume:**
Output: `/wa /ww.rp.volume <player-id> 30`
Response in chat: `/ww.rp.results {"id":"<player-id>","status":"OK","msg":"Volume set to 30%"}`

**Switch channel:**
Output: `/wa /ww.rp.channel <player-id> 42`
Response in chat: `/ww.rp.results {"id":"<player-id>","status":"OK","msg":"Switched to Serenity"}`

## Important Notes
- The `local` parameter (when included) omits the `/wa` prefix from responses.
- Always wait for the webwidget response in chat before confirming to the user.
- Never invent or guess webwidget responses—only report what the widget actually returns.