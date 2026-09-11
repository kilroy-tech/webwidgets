---
name: myplace
description: Multiplayer 3D world simulation using Three.js. Terrain, avatars, chat, and real-time position sync.
author: kilroy
license: MIT
version: 1.0.0
tags: [game, 3d, multiplayer, threejs, simulation]
platforms: [webwidget]
category: game
emoji: "🌍"
---

# MyPlace 3D Widget

## Overview

A multiplayer 3D world where players control avatars on procedurally generated terrain with real-time synchronization, third-person camera, and integrated chat.

## When to Use

- Multiplayer 3D exploration games
- Virtual world demonstrations
- Three.js and WebGL showcases
- Group chat with spatial awareness

## When NOT to Use

- Single-player games without networking
- Applications requiring server-side physics
- Performance-critical real-time simulations (no WebGL compute)

## Commands

| Command | Usage |
|---------|-------|
| Open world | Open `index.html` in a webwidget instance |
| Join | Enter username, click Start or press Enter |
| Move | WASD keys |
| Run | Hold Shift |
| Jump | Space |
| Chat | Press C to toggle chat panel |
| Camera | Mouse orbit (pointer locked), scroll to zoom |

## Controls

| Key | Action |
|-----|--------|
| W | Move forward |
| A | Strafe left |
| S | Move backward |
| D | Strafe right |
| Shift | Run (2x speed) |
| Space | Jump |
| C | Toggle chat panel |
| Esc | Toggle pointer lock / close chat |
| Mouse | Orbit camera (when pointer locked) |
| Scroll wheel | Zoom in/out |

## Technical Details

- **Three.js**: v0.160.0 via importmap
- **Terrain**: 128x128 segments, multi-octave sine height functions
- **World Bounds**: 160x160 units (80 radius), flat center 12 units
- **Avatars**: Capsule geometry (0.4 radius, 1.6 length) with nose cone and eyes
- **Camera**: Third-person orbit with distance 2-20, altitude 0.5-12
- **Lighting**: Ambient, directional (with shadows), hemisphere
- **Position Sync**: 5-second heartbeat, immediate on movement
- **Chat Protocol**: `/ww.myplace.chat` prefix, JSON payloads
- **Position Protocol**: `/ww.myplace.position` prefix, JSON payloads

## Output

- Real-time 3D canvas rendering at 60 FPS
- Avatar positions broadcast to connected instances
- Chat messages displayed in panel and toast notifications
- Connection status in top bar

## Error Handling

| Error | Cause | Solution |
|-------|-------|-----------|
| Connection failed | Swarm WebSocket unavailable | Check network, refresh page |
| Blank canvas | WebGL not supported | Use a modern browser |
| No avatars visible | No other players connected | Open additional instances |
| Chat not working | SDK not initialized | Ensure alias parameter in URL |

## Notes

- Terrain uses seeded random generation (mulberry32) for consistency
- Clouds orbit the world center, water has animated vertices
- 60 trees and 40 rocks placed procedurally
- Remote avatars lerp positions for smooth interpolation
- Username labels rendered as Three.js sprites
- Toast notifications auto-fade after 10 seconds
