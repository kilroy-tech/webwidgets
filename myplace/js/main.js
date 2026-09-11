import * as THREE from 'three';
import { initSDK } from './sdk.js';
import { initTerrain } from './terrain.js';
import { initAvatar } from './avatar.js';
import { initChat } from './chat.js';

export function startGame(alias, guid, seed, username) {
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const instructionsEl = document.getElementById('instructions');
  const canvasContainer = document.getElementById('canvas-container');

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0x87CEEB, 0.008);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const terrain = initTerrain(scene, seed);
  terrain.init();
  const startY = terrain.getTerrainHeight(0, 0) + 2;
  camera.position.set(0, startY, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(renderer.domElement);

  // Third-person camera: yaw/pitch angles for mouse rotation
  let camYaw = 0;       // horizontal rotation (radians)
  let camPitch = -0.4;  // vertical angle (slightly downward)
  const CAM_MIN_PITCH = -Math.PI / 2.2;
  const CAM_MAX_PITCH = 0;
  const MOUSE_SENSITIVITY = 0.002;
  const MOUSE_SENSITIVITY_H = 0.006;
  let isPointerLocked = false;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x362907, 0.4);
  scene.add(hemiLight);

  // Initialize subsystems
  const avatar = initAvatar(guid, scene, username);
  const localAvatar = avatar.getLocalAvatar();
  const chat = initChat(username);
  const chatInput = document.getElementById('chat-input');
  const sdk = initSDK(alias, guid, terrain, avatar, chat, username);

  // Keyboard input
  const keys = {};
  const MOVESPEED = 8, JUMPSPEED = 8, GRAVITY = 20;
  let velY = 0, grounded = true;

  document.addEventListener('keydown', e => {
    if (chat.isChatFocused()) return;
    keys[e.code] = true;
  });
  document.addEventListener('keyup', e => {
    if (chat.isChatFocused()) return;
    keys[e.code] = false;
  });

  // 'C' key opens chat panel — only if chat is not active
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.altKey) {
      if (!chat.isChatFocused() && !chat.isChatActive()) {
        e.preventDefault();
        chat.toggleChatPanel();
      }
    }
  });

  // Escape closes chat panel and discards the message
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && chat.isChatVisible()) {
      e.preventDefault();
      chatInput.value = '';  // clear input before closing
      chat.closeChatPanel();
    }
  });

  // Third-person mouse control (pointer lock for mouse capture)
  canvasContainer.addEventListener('click', () => {
    if (!isPointerLocked) {
      canvasContainer.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvasContainer;
    if (isPointerLocked) {
      instructionsEl.classList.remove('visible');
    } else {
      const chatPanel = document.getElementById('chat-panel');
      if (!chatPanel.classList.contains('visible')) {
        instructionsEl.classList.add('visible');
      }
    }
  });

  document.addEventListener('mousemove', e => {
    if (!isPointerLocked) return;
    camYaw -= e.movementX * MOUSE_SENSITIVITY_H;
    // Mouse vertical movement controls camera altitude (down = lower, up = higher)
    cameraAltitude = Math.max(ALTITUDE_MIN, Math.min(ALTITUDE_MAX, cameraAltitude + e.movementY * MOUSE_SENSITIVITY_H));
  });

  // Third-person camera settings
  let cameraDistance = 8;
  const CAMERA_MIN_DISTANCE = 2;
  const CAMERA_MAX_DISTANCE = 20;
  let cameraAltitude = 2.5; // Dynamic altitude controlled by mouse vertical movement
  const ALTITUDE_MIN = 0.5;
  const ALTITUDE_MAX = 12.0;

  // Initialize camera position behind avatar
  camera.position.set(0, startY, cameraDistance);
  camera.lookAt(localAvatar.position.x, localAvatar.position.y, localAvatar.position.z);

  // Scroll wheel adjusts both altitude and distance proportionally
  canvasContainer.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY * 0.01;
    cameraDistance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, cameraDistance + delta));
    cameraAltitude = Math.max(ALTITUDE_MIN, Math.min(ALTITUDE_MAX, cameraAltitude + delta));
  }, { passive: false });

  // Handle connection
  sdk.ready.then(() => {
    console.log('[myplace] SDK connected');
    statusEl.textContent = 'Connected';
    statusEl.className = 'status connected';
    loadingEl.style.display = 'none';
    instructionsEl.classList.add('visible');
    startPositionBroadcast(username);
    startGameLoop();
  }).catch(err => {
    console.error('[myplace] Connection failed:', err);
    statusEl.textContent = 'Connection failed';
    statusEl.className = 'status error';
    loadingEl.innerHTML = '<div style="color:#ef4444">Connection failed. Please refresh.</div>';
  });

  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Position broadcast: immediate on movement events, periodic heartbeat for idle
  const POS_HEARTBEAT_INTERVAL = 5000; // ms
  let lastBroadcastPos = { x: 0, y: 0, z: 0 };
  let lastBroadcastYaw = 0;
  let heartbeatTimer = null;
  let lastHeartbeatTime = 0;
  let needsPositionBroadcast = false;
  let needsRotationBroadcast = false;

  function broadcastPosition(x, y, z, username) {
    const dx = x - lastBroadcastPos.x;
    const dy = y - lastBroadcastPos.y;
    const dz = z - lastBroadcastPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 0.1) {
      if (window.__myplaceSdk && window.__myplaceSdk.publishPosition) {
        window.__myplaceSdk.publishPosition(x, y, z, username, localAvatar.rotation.y);
        lastBroadcastPos = { x: x, y: y, z: z };
      }
      needsPositionBroadcast = false;
    }
  }

  function broadcastRotationIfChanged(yaw, username) {
    const yawDiff = Math.abs(yaw - lastBroadcastYaw);
    if (yawDiff > 0.01) { // Broadcast if rotation changed by at least ~0.5 degrees
      if (window.__myplaceSdk && window.__myplaceSdk.publishPosition) {
        window.__myplaceSdk.publishPosition(
          localAvatar.position.x,
          localAvatar.position.y,
          localAvatar.position.z,
          username,
          yaw
        );
        lastBroadcastYaw = yaw;
      }
      needsRotationBroadcast = false;
    }
  }

  function startPositionBroadcast(username) {
    // Heartbeat timer for idle players
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastHeartbeatTime > POS_HEARTBEAT_INTERVAL) {
        const pos = localAvatar.position;
        if (window.__myplaceSdk && window.__myplaceSdk.publishPosition) {
          window.__myplaceSdk.publishPosition(pos.x, pos.y, pos.z, username, localAvatar.rotation.y);
          lastBroadcastPos = { x: pos.x, y: pos.y, z: pos.z };
          lastBroadcastYaw = localAvatar.rotation.y;
        }
        lastHeartbeatTime = now;
        needsPositionBroadcast = false;
        needsRotationBroadcast = false;
      }
    }, 1000); // Check every second, broadcast every 5s
  }

  function stopPositionBroadcast() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  function startGameLoop() {
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      if (isPointerLocked) {
        // Third-person: camera orbits around avatar based on yaw/pitch angles
        // Movement is relative to camera's view direction

        // Calculate camera direction from yaw only (horizontal orbit)
        const sinYaw = Math.sin(camYaw);
        const cosYaw = Math.cos(camYaw);
        const camDirX = sinYaw;
        const camDirZ = cosYaw;

        // Position camera behind with user-controlled altitude
        camera.position.set(
          localAvatar.position.x + camDirX * cameraDistance,
          localAvatar.position.y + cameraAltitude,
          localAvatar.position.z + camDirZ * cameraDistance
        );

        // LookAt Y target interpolates between cone level (zoomed in) and capsule top (zoomed out)
        const zoomRatio = (cameraDistance - CAMERA_MIN_DISTANCE) / (CAMERA_MAX_DISTANCE - CAMERA_MIN_DISTANCE);
        const coneYOffset = 1.1;
        const capsuleTopYOffset = 2.0;
        const lookAtY = localAvatar.position.y + coneYOffset + (capsuleTopYOffset - coneYOffset) * zoomRatio;
        camera.lookAt(localAvatar.position.x, lookAtY, localAvatar.position.z);

        // Movement direction: forward is away from camera (opposite of camDir)
        const forwardX = -camDirX;
        const forwardZ = -camDirZ;
        // Strafe direction (perpendicular to forward in horizontal plane)
        const rightX = camDirZ;
        const rightZ = -camDirX;

        // WASD movement relative to camera view
        const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? MOVESPEED * 2 : MOVESPEED;
        let moveX = 0, moveZ = 0;

        if (keys['KeyW']) { moveX += forwardX; moveZ += forwardZ; }
        if (keys['KeyS']) { moveX -= forwardX; moveZ -= forwardZ; }
        if (keys['KeyA']) { moveX -= rightX; moveZ -= rightZ; }
        if (keys['KeyD']) { moveX += rightX; moveZ += rightZ; }

        const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (moveLen > 0) {
          localAvatar.position.x += (moveX / moveLen) * speed * delta;
          localAvatar.position.z += (moveZ / moveLen) * speed * delta;
          localAvatar.rotation.y = Math.atan2(moveX / moveLen, moveZ / moveLen);
          broadcastPosition(localAvatar.position.x, localAvatar.position.y, localAvatar.position.z, username);
          lastHeartbeatTime = Date.now(); // Reset heartbeat timer on movement
        }

        // Jump + gravity
        if (keys['Space'] && grounded) { velY = JUMPSPEED; grounded = false; }
        velY -= GRAVITY * delta;
        localAvatar.position.y += velY * delta;
        if (velY !== 0) {
          broadcastPosition(localAvatar.position.x, localAvatar.position.y, localAvatar.position.z, username, true);
          lastHeartbeatTime = Date.now();
        }

        // Ground collision on avatar
        const terrainY = terrain.getTerrainHeight(localAvatar.position.x, localAvatar.position.z);
        if (localAvatar.position.y < terrainY + 2) {
          localAvatar.position.y = terrainY + 2;
          velY = 0; grounded = true;
        }

        // World boundary: clamp avatar to terrain X,Z bounds
        const TERRAIN_HALF_SIZE = 80;
        if (localAvatar.position.x < -TERRAIN_HALF_SIZE) localAvatar.position.x = -TERRAIN_HALF_SIZE;
        if (localAvatar.position.x > TERRAIN_HALF_SIZE) localAvatar.position.x = TERRAIN_HALF_SIZE;
        if (localAvatar.position.z < -TERRAIN_HALF_SIZE) localAvatar.position.z = -TERRAIN_HALF_SIZE;
        if (localAvatar.position.z > TERRAIN_HALF_SIZE) localAvatar.position.z = TERRAIN_HALF_SIZE;

        // Update local avatar username label position
        avatar.updateLocalAvatarPosition();

        terrain.updateClouds(time);
        terrain.animateWater(time);
      }

      avatar.updateRemote(delta);
      renderer.render(scene, camera);
    }

    animate();
  }
}
