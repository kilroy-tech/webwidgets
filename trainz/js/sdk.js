import { initWebWidget } from "/apps/kilroy.utils/lib/kilroy/js/webwidget_sdk.js";

const params = new URLSearchParams(window.location.search);
export const sdk = initWebWidget({
  alias: params.get("alias") || "kilroy.groups.trainz",
  guid: params.get("guid") || "trainz-" + Date.now(),
  focusBridgeEnabled: true,
  targetOrigin: window.location.origin,
});

export function bindSdkStatus(onStatus) {
  sdk.onConnectionState((event) =>
    onStatus(Boolean(event.connected), event.state || "disconnected"),
  );
}

export function bindSwarmCommands(onCommand) {
  sdk.onMessage((event) => {
    if (!event || !event.message) return;
    const match = event.message.match(/^\/train\s+([a-z_]+)(?:\s+(.*))?$/i);
    if (match)
      onCommand({
        command: match[1].toLowerCase(),
        argument: match[2] || "",
        event,
      });
  });
}
