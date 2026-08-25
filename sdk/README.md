# WebWidget SDK

This folder contains the bundled Kilroy WebWidget SDK implementation:

- `webwidget_sdk.js` - Self-contained browser SDK for widgets running inside Kilroy webwidget iframes.

## Capabilities

The SDK provides:

- Faye pub/sub transport setup.
- Widget lifecycle events.
- Connection state events.
- Inbound message handling and filtering.
- Outbound messages to the widget alias channel.
- Widget-scoped key-value storage.
- Parent-window focus activation through the iframe focus bridge.
- Forwarding of runtime bootstrap and OAuth-related parameters used by Kilroy integrations.

## Basic Usage

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";

const sdk = initWebWidget({
  focusBridgeEnabled: true,
  targetOrigin: window.location.origin
});

await sdk.ready;
```

Kilroy supplies the runtime `alias` and `guid` through the widget URL. When opening a local widget, use the `?{{bootstrap_args}}` suffix so those parameters are injected automatically.

## Reference Documentation

For the complete SDK contract, URL bootstrap rules, swarm routing model, messaging API, lifecycle events, filters, storage API, and troubleshooting guidance, see the parent repository guide: [DEVELOPER.md](../DEVELOPER.md).
