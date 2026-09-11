# Tank Battle

A multiplayer tank battle game widget for Kilroy.

## Description

Tank Battle is a real-time multiplayer game where players control tanks on a shared canvas. Each player joins with a unique username and can move their tank using WASD controls (W/S for forward/backward, A/D for rotation). Tanks are rendered with unique colors based on their username hash, and players can see other tanks on the battlefield in real-time.

## Features

- **Multiplayer**: Real-time synchronization of tank positions across all connected players
- **WASD Controls**: Move forward/backward and rotate your tank
- **Unique Tank Colors**: Each player's tank is colored based on a hash of their username
- **Heartbeat System**: Keeps remote tanks visible with periodic keep-alive messages
- **Webwidget SDK Integration**: Uses the Kilroy webwidget messaging protocol for cross-instance communication

## Controls

| Key | Action |
|-----|--------|
| W | Move forward |
| S | Move backward |
| A | Rotate counter-clockwise |
| D | Rotate clockwise |
| ESC | Leave the game |

## Technical Details

- **Canvas Size**: 800x600 game space (scales to fit container)
- **Frame Rate**: 60 FPS game loop
- **Update Interval**: Position updates sent every 100ms
- **Heartbeat**: Keep-alive messages every 4 seconds
- **Player Timeout**: Inactive remote tanks removed after 5 seconds

## Usage

Open the widget in a webwidget instance. Enter your desired username and click JOIN to enter the battlefield. Open additional instances to play with others — all players share the same canvas.

## Files

- `tank.html` — Main game file (self-contained HTML with embedded CSS and JavaScript)
