# Kilroy Vote

A simple yes/no voting widget for group discussions and polls.

## Description

Kilroy Vote is a real-time voting widget where participants join with a username and cast Yes or No votes. All votes are broadcast to connected instances and displayed in a scrolling feed. The widget uses the Kilroy webwidget SDK for cross-instance messaging.

## Features

- **Simple Join Flow**: Enter your name and click JOIN or press Enter
- **Yes/No Voting**: Two large buttons for quick voting
- **Real-time Display**: All votes appear in a scrolling message feed
- **Multi-instance**: Open multiple instances to vote with others
- **Focus Activation**: Clicking the voting area requests widget focus

## Controls

| Control | Action |
|---------|--------|
| Name input | Enter your username |
| Join Vote button | Join the voting session |
| Yes button | Cast a Yes vote |
| No button | Cast a No vote |
| Click voting area | Request widget focus |

## Technical Details

- **Message Protocol**: Votes sent via `/ww.vote` prefix
- **Message Format**: `/ww.vote <username> votes <yes/no>`
- **SDK Integration**: Uses `initWebWidget` with focus bridge enabled
- **UI**: Dark theme with green (Yes) and red (No) buttons
- **Animation**: Votes fade in with slide-up animation

## Usage

Open the widget in a webwidget instance. Enter your name and click JOIN. Cast Yes or No votes — all connected instances will see your votes in real-time. Open additional instances for group voting.

## Files

- `vote.html` — Main voting widget (self-contained HTML with embedded CSS and JavaScript)
