---
name: tank
description: Multiplayer tank battle game widget. Real-time canvas-based game with WASD controls and cross-instance messaging.
author: kilroy
license: MIT
version: 1.0.0
tags: [game, multiplayer, canvas, tank, battle]
platforms: [webwidget]
category: game
emoji: "🎮"
---

# Tank Battle Widget

## Overview

A multiplayer tank battle game that runs as a Kilroy webwidget. Players join with usernames and control tanks on a shared canvas in real-time.

## When to Use

- Running a multiplayer tank battle game
- Testing real-time canvas rendering with multiple players
- Demonstrating webwidget SDK messaging capabilities

## When NOT to Use

- Single-player games (use other game widgets)
- Games requiring server-side state management
- Games with complex physics engines

## Commands

| Command | Usage |
|---------|-------|
| Open game | Open `tank.html` in a webwidget instance |
| Join game | Enter username and click JOIN |
| Leave game | Click LEAVE or press ESC |

## Controls

| Key | Action |
|-----|--------|
| W | Move forward |
| S | Move backward |
| A | Rotate counter-clockwise |
| D | Rotate clockwise |
| ESC | Leave the game |

## Technical Details

- **Game Space**: 800x600 pixels (scales to container)
- **Tank Size**: 20px (scales with canvas)
- **Speed**: 200 pixels/second
- **Rotation**: 180 degrees/second
- **Update Interval**: 100ms
- **Heartbeat**: 4 seconds
- **Player Timeout**: 5 seconds

## Webwidget Integration

Uses the Kilroy webwidget SDK for cross-instance messaging:
- Messages prefixed with `/webwidget.tank`
- JSON payload: `{username, x, y, orientation}`
- Filter pattern: `/webwidget.tank`

## Output

- Canvas rendering at 60 FPS
- Real-time position updates to all connected players
- Player count display

## Error Handling

| Error | Cause | Solution |
|-------|-------|-----------|
| Stale remote tanks | Player timeout exceeded (5s) | Players must stay active |
| Blank canvas | SDK not initialized | Ensure proper webwidget context |
| No movement | Keys not captured | Check keyboard input handling |

## Notes

- Tank colors are hashed from usernames for uniqueness
- Local tank renders in blue (#4299ff)
- Remote tanks use hashed HSL colors
- Shooting functionality marked as "coming soon"
