import { initWebWidget } from "/apps/kilroy.utils/lib/kilroy/js/webwidget_sdk.js";

const BASE_PREFIX = "/ww.myplace";
const CHAT_CMD = "/ww.myplace.chat";
const POS_CMD = "/ww.myplace.position";

export function initSDK(alias, guid, terrain, avatar, chat, username) {
  const statusEl = document.getElementById('status');

  const sdk = initWebWidget({
    alias: alias,
    guid: guid,
    pubsubUrl: "/ws",
    focusBridgeEnabled: true,
    targetOrigin: window.location.origin,
  });

  sdk.setMessageFilters([BASE_PREFIX]);

  sdk.onMessage((event) => {
    if (!event.message) return;

    // Handle chat messages
    if (event.message.startsWith(CHAT_CMD + " ")) {
      const payload = event.message.substring(CHAT_CMD.length + 1);
      try {
        const data = JSON.parse(payload);
        if (data.type === 'chat') {
          chat.addMessage(data.text, data.username || 'Player', false);
        }
      } catch (err) {
        console.warn('[myplace] Bad chat JSON:', payload, err);
      }
    }
    // Handle position update commands
    else if (event.message.startsWith(POS_CMD + " ")) {
      const payload = event.message.substring(POS_CMD.length + 1);
      try {
        const data = JSON.parse(payload);
        if (data.type === 'avatar' && data.x !== undefined) {
          avatar.registerRemote(data.guid || data.id, {
            x: data.x,
            y: data.y,
            z: data.z,
            username: data.username || 'Player',
            yaw: data.yaw
          });
        }
      } catch (err) {
        console.warn('[myplace] Bad position JSON:', payload, err);
      }
    }
  });

  sdk.onConnectionState((event) => {
    if (event.connected) {
      statusEl.textContent = 'Connected';
      statusEl.className = 'status connected';
    } else if (event.state === 'error') {
      statusEl.textContent = 'Error: ' + (event.error || 'unknown');
      statusEl.className = 'status error';
    }
  });

  // Expose publish for chat.js
  sdk.publish = (data) => {
    const msg = JSON.stringify({ type: 'chat', text: data.text, username: username });
    sdk.sendMessage(CHAT_CMD + ' ' + msg).catch(() => {});
  };

  // Publish position update to swarm
  sdk.publishPosition = (x, y, z, username, yaw) => {
    const posData = JSON.stringify({
      type: 'avatar',
      guid: guid,
      x: x,
      y: y,
      z: z,
      username: username || alias,
      yaw: yaw
    });
    sdk.sendMessage(POS_CMD + ' ' + posData).catch(() => {});
  };

  // Store reference for chat.js
  window.__myplaceSdk = sdk;

  return sdk;
}
