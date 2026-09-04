# Radio Paradise WebWidget

A Kilroy webwidget for Radio Paradise now-playing data and lightweight player control. It shows the current track, cover art, listener rating, recent tracks, channel selector, playback controls, and volume control while participating in the Kilroy webwidget swarm through the master WebWidget SDK.

## Files

- `radio-paradise-now-playing.html` - The widget UI and runtime logic.
- `INTEGRATION_PLAN.md` - Implementation notes and design history.

## How It Works

The widget imports the master SDK from the `kilroy.groups` app:

```javascript
import { initWebWidget } from "/apps/kilroy.groups/js/webwidget_sdk.js";
```

It initializes the SDK with `focusBridgeEnabled: true`, receives Kilroy runtime bootstrap values from the URL, and registers `/ww.rp` message filters for slash-command handling.

Radio Paradise now-playing data is fetched through the Kilroy `get_url` webhook rather than directly from the browser. This avoids browser CORS issues when calling the Radio Paradise API. The widget then renders the current track and recent tracks locally.

The audio player uses Radio Paradise stream URLs directly in an HTML `Audio` object. Playback state, current channel, current track metadata, and volume are exposed through the `/ww.rp.status` command.

## Adding It To `kilroy.groups/chat_agent_linkshare`

Use the Kilroy public web root URL and include the bootstrap placeholder so `kilroy.groups` can inject the widget alias, GUID, auth, routing, and swarm parameters:

```text
/kilroypublic/webwidgets/radio-paradise/radio-paradise-now-playing.html?{{bootstrap_args}}
```

If you want to preconfigure the player ID in the URL, append it after the bootstrap args with `&id=...`:

```text
/kilroypublic/webwidgets/radio-paradise/radio-paradise-now-playing.html?{{bootstrap_args}}&id=chuck
```

Use `&{{bootstrap_args}}` instead of `?{{bootstrap_args}}` only if the URL already has query parameters before the bootstrap placeholder.

Do not point the widget at a local SDK file. The SDK source of truth is the `kilroy.groups` app at:

```text
/apps/kilroy.groups/js/webwidget_sdk.js
```

## Player ID

Each running widget instance should have a player ID so slash commands can target one person's player without controlling someone else's music in the same group `-ww` swarm.

The widget resolves its player ID in this order:

1. URL search arg: `id`
2. SDK persistent KV value: `player_id`
3. Empty/unset state

If no ID is set, the heading shows `ID Not Set`. Click it to open a small dialog and save an ID interactively. If an ID is already set, the heading shows `[id]`; click it to edit the ID.

The widget stores the ID with the SDK using the exact key `player_id`:

```javascript
sdk.setKV("player_id", playerId);
sdk.getKV("player_id", "");
```

## Restored Player Settings

The widget also persists channel, volume, and whether playback was active in one SDK KV object using the exact key `player_settings`:

```json
{
  "channel_number": 1,
  "volume_percent": 40,
  "player_state": "playing"
}
```

On page load or reload, the widget attempts to restore `player_settings`. It applies the saved channel and volume first, then attempts to resume playback if `player_state` was `playing`. Browser autoplay policy may still block automatic playback; in that case the widget remains loaded and reports an error state.

## Slash Commands

All commands use the `/ww.rp` namespace. Control/status commands take the target player ID as their first argument. If the target ID does not match this widget's configured ID, the widget silently ignores the command.

| Command | Format | Description |
| --- | --- | --- |
| Play | `/ww.rp.play <id> [local]` | Start playback on player `<id>`. |
| Pause | `/ww.rp.pause <id> [local]` | Pause playback on player `<id>`. |
| Channel | `/ww.rp.channel <id> <chan> [local]` | Switch player `<id>` to channel `<chan>`. |
| Volume | `/ww.rp.volume <id> <percent> [local]` | Set player `<id>` volume to `0` through `100`. |
| Status | `/ww.rp.status <id> [local]` | Return player state, volume, channel, stream URL, and now-playing data. |
| Help | `/ww.rp.help [id] [local]` | Return markdown help for the slash commands. |

Channel values are the same numeric values used by the widget dropdown:

| Value | Channel |
| --- | --- |
| `0` | The Main Mix |
| `1` | Mellow Mix |
| `2` | RockIt! |
| `3` | The Globe |
| `5` | Beyond... |

## Responses

Commands respond with `/ww.rp.results` and a JSON object containing `id`, `status`, and `msg`.

By default, responses are prefixed with `/wa` so they route back to the parent/agent swarm:

```text
/wa /ww.rp.results {"id":"chuck","status":"OK","msg":"Playback paused"}
```

If the final argument is `local`, the widget omits the `/wa` prefix and keeps the response in the local `-ww` swarm:

```text
/ww.rp.results {"id":"chuck","status":"OK","msg":"Playback paused"}
```

`status` is `OK` or `ERR`. `msg` is a human-readable message for control commands. For `/ww.rp.status`, `msg` is a JSON-stringified object containing the current player status.

Example status `msg` payload:

```json
{
  "id": "chuck",
  "channel": "The Main Mix",
  "channel_number": 0,
  "stream_url": "https://stream.radioparadise.com/aac-320",
  "is_playing": true,
  "player_state": "playing",
  "volume_percent": 30,
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "year": "2024",
  "song_id": "12345",
  "listener_rating": "7.8",
  "cover_url": "https://img.radioparadise.com/...",
  "progress": {
    "elapsed": 45,
    "duration": 240
  }
}
```

## Examples

Ask for help:

```text
/ww.rp.help local
```

Pause Chuck's player:

```text
/ww.rp.pause chuck
```

Switch Chuck's player to Mellow Mix:

```text
/ww.rp.channel chuck 1
```

Set Chuck's volume to 40 percent:

```text
/ww.rp.volume chuck 40
```

Get Chuck's player status locally:

```text
/ww.rp.status chuck local
```
