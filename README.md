# Kilroy Webwidgets

A webwidget is a browser-based application that runs inside a Kilroy webwidget window, typically as an iframe hosted by a Kilroy process diagram. Webwidgets can provide interactive tools, games, dashboards, and visual experiences while communicating with Kilroy agents and other widgets through the WebWidget SDK.

## What Webwidgets Provide

A webwidget can:

- Render a user interface with ordinary HTML, CSS, JavaScript, Canvas, or other browser APIs.
- Receive its runtime `alias`, `guid`, and swarm-related parameters from Kilroy.
- Send messages to the widget alias channel.
- Receive messages bridged from the shared swarm.
- Persist widget-scoped values with the SDK key-value API.
- React to connection and widget lifecycle events.
- Request that its parent Kilroy window receive focus when the user interacts with the widget.

## Repository Contents

- `radio-paradise/` - Radio Paradise now-playing widget.
- `trainz/` - Model railway layout and train simulation widget.
- `sdk/` - Bundled WebWidget SDK implementation and SDK-specific notes.
- `DEVELOPER.md` - Detailed SDK, URL bootstrap, messaging, filtering, lifecycle, and storage documentation.

## Running a Widget

Widgets hosted in Kilroy's public web root use the `/kilroypublic/` route. When opening a widget through Kilroy, include the bootstrap placeholder so Kilroy can inject the runtime parameters:

```text
http://localhost:3000/kilroypublic/trainz/index.html?{{bootstrap_args}}
```

Do not use a `file:` URL for a widget. See [DEVELOPER.md](DEVELOPER.md) for the complete integration guide.

## SDK Import

A widget can import the bundled SDK with:

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";
```

The local copy in [`sdk/webwidget_sdk.js`](sdk/webwidget_sdk.js) is maintained here for reference, development, and distribution alongside the webwidget examples.
