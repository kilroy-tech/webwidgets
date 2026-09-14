---
name: kilroy-webwidgets
description: Create, modify, validate, and communicate with Kilroy webwidgets served from the kilroypublic public root.
---

# Kilroy Webwidgets

Use this skill for work in `webwidgets/`. [DEVELOPER.md](DEVELOPER.md) is the definitive reference for the WebWidget SDK, routing, lifecycle, storage, and API proxy behavior. Read the relevant section before implementing or changing any of those concerns.

## Hosting And Runtime Arguments

`webwidgets/` is served by Kilroy from the `kilroypublic` public root. A widget at `webwidgets/<name>/<entry-file>` is available at:

```text
http://localhost:3000/kilroypublic/webwidgets/<name>/<entry-file>
```

Kilroy is the server. Do not start a separate static or development server for a webwidget. Validate browser behavior through the Kilroy URL.

Every functional widget must receive `alias` and `group_name` URL search arguments. Read both through `URLSearchParams`. Do not invent fallback values: an incorrect alias or group makes the widget non-functional. When either argument is missing, display a configuration error and do not enable Kilroy-dependent messaging, persistence, or proxy behavior.

Widgets may define optional, widget-specific search arguments. Validate them and provide defaults only for those optional settings. When launching a widget through `open_url_in_webwidget`, provide widget-specific arguments using `additional_search_args`. That tool adds Kilroy routing arguments and then the additional arguments automatically. Do not add or interpret `{{bootstrap_args}}` in agent tool calls.

## Structure And Implementation

- Create a new widget in `webwidgets/<widget-name>/` and keep its entry page, modules, assets, tests, and README together.
- Do not copy, vendor, or modify the canonical SDK. Import `initWebWidget` only from the path documented in [DEVELOPER.md](DEVELOPER.md).
- Initialize the SDK with runtime parameters. Enable `focusBridgeEnabled: true`, set `targetOrigin` to the current origin, and safely handle `sdk.ready`, connection state, and relevant lifecycle events.
- Let the SDK manage pub/sub transport and parent-window focus. Do not add a parallel socket, Faye client, or custom focus protocol.
- Separate domain or simulation logic from rendering and UI orchestration when the widget has meaningful state or behavior.
- Build the usable experience as the first screen. Follow the closest comparable widget's interaction and visual conventions, and support desktop and mobile widget sizes.

## Messaging And Shared State

- Use a widget-specific slash-command namespace, such as `/ww.<widget>`.
- Register SDK message filters, validate inbound messages and arguments, and document command formats and response payloads in the widget README.
- Define targeting behavior deliberately for instance IDs, empty IDs, wildcard IDs, and group-wide commands. Do not infer an ID from an example; request it from the user when it is not known.
- Use SDK messaging and group routing for widget communication. Treat inbound shared-state data as untrusted.
- Use widget-scoped SDK KV storage for small persistent settings. Use stable, documented keys, safe local UI behavior when storage is unavailable, and never persist credentials or secrets.

## Remote APIs

Use Kilroy's documented API/webhook proxy flow when a browser request would be blocked by CORS. Validate proxy responses and represent API failure states in the UI. Do not embed credentials or introduce unrelated third-party CORS proxies.

## Validation

- Run the narrow tests, syntax checks, or type checks provided by the target widget after editing.
- Test the relevant user workflow through the Kilroy URL, including SDK initialization, messages, persistence, or proxy behavior when changed.
- Check the rendered experience at desktop and mobile widget dimensions. Do not consider a widget complete based only on static review.

## Reference Map

- [DEVELOPER.md](DEVELOPER.md): definitive SDK, routing, storage, lifecycle, focus, and proxy reference.
- [README.md](README.md): public-root hosting conventions.
- [radio-paradise](radio-paradise): single-user, bidirectional commands, persistence, lifecycle, and Kilroy API proxy use.
- [myplace](myplace): 3D multiplayer world with integrated chat.
- [vote](vote): minimal shared-group multi-user interaction.