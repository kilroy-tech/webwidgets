# MyPlace 3D

A multiplayer 3D world simulation widget using Three.js with terrain, avatars, and chat.

## Description

MyPlace 3D is a multiplayer 3D world where players control avatars on a procedurally generated terrain. The widget features a third-person camera, real-time avatar synchronization, and an integrated chat system. Players can explore the world, interact with others, and communicate via text chat.

## Features

- **3D World**: Procedurally generated terrain with trees, rocks, water, and clouds
- **Multiplayer Avatars**: Real-time synchronization of player positions and rotations
- **Third-Person Camera**: Mouse-controlled orbit camera with zoom
- **Chat System**: In-world text chat with message history and toast notifications
- **Terrain Variety**: Flat center zone, rolling hills, and steep edges

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
| Scroll wheel | Zoom in/out (adjust camera distance and altitude) |
| Click canvas | Request pointer lock |

## Technical Details

- **Rendering**: Three.js with WebGL (antialiasing, shadow mapping)
- **Terrain**: 128x128 segment plane with multi-octave height functions
- **World Size**: 160x160 units (80 radius), flat center 12 units
- **Avatars**: Capsule meshes with nose cone, eyes, and username labels
- **Chat**: Real-time messaging via webwidget SDK
- **Position Sync**: Broadcasts every 5 seconds (heartbeat) and on movement

## Usage

Open the widget in a webwidget instance. Enter your username and click Start. Click the game canvas to lock your mouse and begin exploring. Use WASD to move, mouse to orbit the camera, and C to open chat. Open additional instances to play with others.

## Files

- `index.html` — Main entry point
- `js/main.js` — Core game loop, camera, and input handling
- `js/avatar.js` — Avatar rendering (local and remote)
- `js/chat.js` — Chat panel and messaging
- `js/sdk.js` — Webwidget SDK integration
- `js/terrain.js` — Terrain generation, water, trees, rocks, clouds
- `css/style.css` — All styling
