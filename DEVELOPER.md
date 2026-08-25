# Developer Documentation for kilroy.groups

This document describes how to extend and interoperate with the kilroy.groups suite of tools, agents, and SDKs.

## WebWidget SDK for Developers

The WebWidget SDK (`/apps/kilroy.groups/js/webwidget_sdk.js`) is a complete, self-contained JavaScript library for integrating real-time messaging and pub/sub communication into web applications running as iframes inside kilroy.groups webwidget process diagrams.

### Overview

The SDK provides:
- Automatic Faye pub/sub transport setup and lifecycle management
- Message filtering and delivery
- Key-value storage for widget state persistence
- Connection and lifecycle event callbacks
- Parent window focus control
- OAuth token forwarding for backend webhook calls

### WebWidget Swarm Routing

Webwidgets communicate with other Kilroy agents through a group-scoped swarm topic that is derived by the backend workflow. The WebWidget SDK handles iframe lifecycle and message delivery, but the actual swarm topic is decided server-side by the `webwidget` pdclass.

#### How the swarm name is built

The workflow takes the group name and appends `-ww` to create the webwidget swarm topic.

Examples:
- `radio-paradise` → `radio-paradise-ww`
- `kilroy.groups.docs` → `kilroy.groups.docs-ww`

This matters for pipeline authors because any Kilroy agent that needs to communicate with the webwidget must join or publish to the same derived swarm topic.

If webwidget swarm bootstrap is disabled, the widget does not join or publish to a swarm.

#### How communication works

- Outbound widget messages go through `swarm_send_hook`, which publishes to the derived swarm topic.
- Inbound swarm traffic goes through `swarm_hook`, which bridges normalized `MESSAGE_RECEIVED` events into the widget’s alias channel so the WebWidget SDK can consume them with `onMessage()`.
- Other Kilroy agents communicate with the widget by joining the same derived swarm topic and publishing to that same group-level swarm.

#### Important distinction

- The widget alias is the SDK transport channel.
- The swarm topic is the backend collaboration channel.
- The SDK listens on the alias channel, while the backend bridges swarm traffic into that channel.

### Installation

Simply import and initialize the SDK in your HTML:

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";

const sdk = initWebWidget({ alias: "your.widget.alias", guid: "your-widget-id" });
```

#### Reading Parameters from URL

Kilroy passes widget parameters via URL query string. Extract them using `URLSearchParams`:

```javascript
// Get parameters from current URL
const params = new URLSearchParams(window.location.search);
const alias = params.get("alias");
const guid = params.get("guid");

// Initialize with URL parameters
const sdk = initWebWidget({ 
    alias: alias || "fallback.alias",
    guid: guid || "fallback-guid"
});
```

Or more concisely, let the SDK auto-detect from the window:

```javascript
// The SDK automatically reads these from window.location.search if available
const sdk = initWebWidget({}); // Will use URL params if present
```

**Example URLs:**
- For a widget hosted by Kilroy, append the bootstrap placeholder so the runtime can inject the alias, guid, swarm, and other webwidget parameters:
    - `http://localhost:3000/kilroypublic/my-widget.html?{{bootstrap_args}}`
    - `http://localhost:3000/kilroypublic/trainz/index.html?{{bootstrap_args}}`
- For a non-Kilroy host, parameters may be supplied explicitly:
    - `http://example.com/my-widget.html?alias=my.widget&guid=instance-123`
    - `http://example.com/my-widget.html?alias=kilroy.groups.tank-game&guid=player-001`

**Kilroy URL bootstrap:**

When opening a page from `kilroypublic` in a webwidget, always use the `?{{bootstrap_args}}` suffix. Kilroy expands this placeholder when launching the page and supplies the runtime query parameters needed for SDK routing and swarm communication. Do not replace it with a manually constructed `alias` or `guid` query string for Kilroy-hosted pages, and do not append a second `?` if the URL already has query parameters; use `&{{bootstrap_args}}` in that case.

### Core API

#### Initialization

```javascript
// Create and initialize SDK
const sdk = initWebWidget({
    alias: "your.widget.alias",           // Required: Kilroy alias for this widget
    guid: "unique-guid",                   // Optional: Unique widget instance ID
    pubsubUrl: "/ws",                      // Optional: Faye WebSocket URL (default: /ws)
    focusBridgeEnabled: true,              // Optional: Enable parent window focus control
    targetOrigin: window.location.origin   // Optional: PostMessage target (default: current origin)
});

// The SDK connects asynchronously; wait for ready if needed
await sdk.ready;
```

#### Sending Messages

```javascript
// Send a message to the widget's alias channel
sdk.sendMessage("Hello from my widget", {
    username: "player_name",
    type: "text/plain",
    timestamp: Math.floor(Date.now() / 1000)
}).then(({ success, payload, response }) => {
    console.log("Message sent successfully");
}).catch((error) => {
    console.error("Failed to send message:", error);
});
```

#### Message Filtering

```javascript
// Set regex patterns to filter incoming messages
// Only messages matching at least one pattern will be delivered
sdk.setMessageFilters([
    "/webwidget.tank",      // Exact string match
    "^tank:",              // Regex pattern
    ".*player.*"           // Another pattern
]).then((filters) => {
    console.log("Filters applied:", filters);
});

// Get current filters
sdk.getMessageFilters().then((filters) => {
    console.log("Current filters:", filters);
});
```

#### Event Handling

```javascript
// Register handler for incoming messages
// Handler receives: { command, message, username, type, timestamp, payload, raw }
const unsubscribeMessages = sdk.onMessage((event) => {
    // Always check if message exists before processing
    if (!event.message) {
        return;
    }
    
    console.log(`${event.username}: ${event.message}`);
    
    // Filter by message content
    if (!event.message.startsWith("/webwidget.tank")) {
        return;
    }
    
    // Process the message
    try {
        const data = JSON.parse(event.message.substring(15));
        console.log("Parsed data:", data);
    } catch (err) {
        console.error("Failed to parse message:", err);
    }
});

// Register handler for connection state changes
// Handler receives: { connected, state, error? }
// Possible states: "connecting", "connected", "transport_up", "transport_down", "disconnected", "error"
const unsubscribeConnection = sdk.onConnectionState((event) => {
    if (event.connected) {
        console.log("Widget connected:", event.state);
    } else {
        console.log("Widget disconnected:", event.state, event.error);
    }
});

// Register handler for lifecycle events
// Handler receives: { event }
// Possible events: "WIDGET_CONNECTED", "WIDGET_CLOSING"
const unsubscribeLifecycle = sdk.onLifecycle((event) => {
    if (event.event === "WIDGET_CONNECTED") {
        console.log("Widget is ready");
    } else if (event.event === "WIDGET_CLOSING") {
        console.log("Widget is closing");
    }
});

// Unsubscribe from events when no longer needed
unsubscribeMessages();
unsubscribeConnection();
unsubscribeLifecycle();
```

#### Key-Value Storage

```javascript
// Store a persistent value (scoped to this widget instance)
sdk.setKV("game_score", 42).then((value) => {
    console.log("Stored:", value);
});

// Retrieve a persistent value with fallback
sdk.getKV("game_score", 0).then((value) => {
    console.log("Retrieved score:", value);
});
```

#### Lifecycle Control

```javascript
// Manually disconnect the SDK (usually not necessary)
sdk.disconnect();

// Access connection state
console.log("Connected:", sdk.connected);
console.log("Message filters:", sdk.messageFilters);
console.log("Stored KV pairs:", sdk.kv);
```

### Complete Example: Simple Chat Widget

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";

const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const messagesLog = document.getElementById("messages-log");

// Initialize SDK
const sdk = initWebWidget({
    alias: "my-chat-widget",
    guid: "widget-001"
});

// Handle incoming messages
sdk.onMessage((event) => {
    // Always check if message exists
    if (!event.message) {
        return;
    }
    
    const line = `[${new Date(event.timestamp * 1000).toLocaleTimeString()}] ${event.username}: ${event.message}`;
    messagesLog.textContent += line + "\n";
    messagesLog.scrollTop = messagesLog.scrollHeight;
});

// Handle connection state
sdk.onConnectionState((event) => {
    sendButton.disabled = !event.connected;
    sendButton.textContent = event.connected ? "Send" : "Connecting...";
});

// Send message on button click
sendButton.addEventListener("click", () => {
    const text = messageInput.value.trim();
    if (!text) return;

    sdk.sendMessage(text, {
        username: "chat_user",
        type: "text/plain"
    }).then(() => {
        messageInput.value = "";
        messageInput.focus();
    }).catch((error) => {
        console.error("Send failed:", error);
    });
});

// Set up message filtering
await sdk.ready;
await sdk.setMessageFilters(["/chat"]);
```

### Complete Example: Multiplayer Game (Tank)

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";

const username = "player_" + Math.random().toString(36).slice(7);
const localState = {
    x: 400,
    y: 300,
    orientation: 0,
    remotePlayers: {}
};

// Initialize SDK
const sdk = initWebWidget({ 
    alias: "kilroy.groups.tank-game",
    guid: username
});

// Receive tank updates from other players
sdk.onMessage((event) => {
    // Always check message exists first
    if (!event.message) {
        return;
    }
    
    if (!event.message.startsWith("/webwidget.tank ")) {
        return;
    }

    try {
        const update = JSON.parse(event.message.substring(16));
        if (update.username !== username) {
            localState.remotePlayers[update.username] = {
                x: update.x,
                y: update.y,
                orientation: update.orientation,
                lastUpdate: Date.now()
            };
        }
    } catch (_err) {}
});

// Update connection UI
sdk.onConnectionState((event) => {
    document.getElementById("connection-status").textContent = 
        event.connected ? "Connected" : "Disconnected";
});

// Game loop: send local position periodically
setInterval(() => {
    const message = "/webwidget.tank " + JSON.stringify({
        username,
        x: Math.round(localState.x),
        y: Math.round(localState.y),
        orientation: Math.round(localState.orientation)
    });

    sdk.sendMessage(message, {
        username,
        type: "application/json"
    }).catch(() => {});
}, 100);

// Wait for connection before starting game
await sdk.ready;
await sdk.setMessageFilters(["/webwidget.tank"]);
console.log("Game ready!");
```

### Troubleshooting

**Q: Messages aren't arriving**
- Verify the `alias` matches the widget registration in kilroy.groups
- Check message filters with `sdk.getMessageFilters()`
- Inspect browser console for connection errors in `onConnectionState` handler

**Q: Connection state is "error"**
- Ensure your widget runs in an iframe within a Kilroy instance
- Check `X-CONCLUENT-TOKEN` header is passed for backend calls
- Verify Faye WebSocket is accessible at `/ws`

**Q: Key-value storage isn't persisting**
- KV storage is scoped to the widget instance; refresh loses data
- For persistence across sessions, use backend workflows instead

