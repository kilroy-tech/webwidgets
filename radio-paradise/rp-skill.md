SKILL_ID rp
SKILL_TEXT
# Radio Paradise WebWidget Communication

## Overview
Communicate with the Radio Paradise webwidget to control playback for player <id>. All of your communication is through the chat interface with the user. Commands and responses are sent and received as plain text slash commands to the chat. Output all commands by themselves as a single line with no additional text or formatting before or after the command, to the user's chat. The /wa prefix will forward your command to the webwidget automatically. The webwidget will respond in the chat with you and you can then reformat its response and present an appropriate response to the user.

The user's player will have a unique ID that you must send as part of the commands. If you do not know the user's player ID, ask them for it before attempting to communicate with the widget.

## Command Format
Send all commands prefixed with `/wa` to the widget:
```
/wa /ww.rp.<command> <parameters>
```

## Available Commands

### `/ww.rp.play <id> [local]`
Start playback on the specified player.

### `/ww.rp.pause <id> [local]`
Pause playback on the specified player.

### `/ww.rp.channel <id> <chan> [local]`
Switch to a different channel. Valid channel values: `0`, `1`, `2`, `3`, `5`, `42`, or `945`.

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

## Response Format
All responses are delivered as:
```
/ww.rp.results { id, status, msg }
```

Where:
- `id` = Player identifier (e.g., "ChuckTunes")
- `status` = Operation status ("OK" or error)
- `msg` = Command-specific message or data

## Important Notes
- The `local` parameter (when included) omits the `/wa` prefix from responses.
- Always wait for the JSON response before confirming to the user.
- Player ID for this setup: "ChuckTunes"

## Available Channels
- **0**: The Main Mix
- **1**: Mellow Mix
- **2**: RockIt!
- **3**: The Globe
- **5**: Beyond...
- **42**: Serenity
- **945**: KFAT

If the user requests a channel by name or a close text match, map that name to the appropriate channel number and use the number as the channel argument.

## Examples

**Play music:**
Send: `/wa /ww.rp.play ChuckTunes`
Response: `/ww.rp.results {"id":"ChuckTunes","status":"OK","msg":"Playback started"}`

**Get status:**
Send: `/wa /ww.rp.status ChuckTunes`
Response: `/ww.rp.results {"id":"ChuckTunes","status":"OK","msg":"{...status JSON...}"}`

**Set volume:**
Send: `/wa /ww.rp.volume ChuckTunes 30`
Response: `/ww.rp.results {"id":"ChuckTunes","status":"OK","msg":"Volume set to 30%"}`