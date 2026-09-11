---
name: vote
description: Simple yes/no voting widget for group discussions. Real-time vote broadcasting via webwidget SDK messaging.
author: kilroy
license: MIT
version: 1.0.0
tags: [voting, poll, discussion, group]
platforms: [webwidget]
category: communication
emoji: "🗳️"
---

# Kilroy Vote Widget

## Overview

A real-time yes/no voting widget where participants join with a username and cast votes broadcast to all connected instances.

## When to Use

- Quick group decisions and polls
- Yes/No voting in group chats
- Real-time consensus building
- Interactive discussions requiring voting

## When NOT to Use

- Multi-option polls (more than yes/no)
- Anonymous voting (usernames are visible)
- Secret ballot requirements
- Long-form survey workflows

## Commands

| Command | Usage |
|---------|-------|
| Open vote | Open `vote.html` in a webwidget instance |
| Join | Enter username, click JOIN or press Enter |
| Vote Yes | Click the Yes button |
| Vote No | Click the No button |
| Request focus | Click anywhere in the voting area |

## Controls

| Control | Action |
|---------|--------|
| Name input | Enter your username (max 30 chars) |
| Join Vote button | Join the voting session |
| Yes button | Cast a Yes vote |
| No button | Cast a No vote |
| Click voting area | Request widget focus from parent window |

## Technical Details

- **Message Protocol**: `/ww.vote` prefix
- **Message Format**: `/ww.vote <username> votes <yes/no>`
- **SDK**: `initWebWidget` with `focusBridgeEnabled: true`
- **Filters**: Only processes messages starting with `/ww.vote`
- **UI Theme**: Dark (#1a1a2e), accent color #e94560
- **Button Colors**: Yes = #22c55e, No = #ef4444

## Output

- Scrolling vote feed with fade-in animation
- Username and vote choice displayed per entry
- Welcome message showing current user's name

## Error Handling

| Error | Cause | Solution |
|-------|-------|-----------|
| Missing alias error | URL missing alias parameter | Include `alias=` in query string |
| No votes displayed | SDK not connected | Check network connection to swarm |
| Empty name rejection | Name input is blank | Enter a username before joining |

## Notes

- Votes are not deduplicated — users can vote multiple times
- Vote messages are displayed in chronological order
- The display area auto-scrolls to the latest vote
- Focus bridge sends `webwidget.focus` message to parent window
