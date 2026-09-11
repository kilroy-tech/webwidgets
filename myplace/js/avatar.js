import * as THREE from 'three';

let sceneRef = null;

export function initAvatar(guid, scene, username) {
  sceneRef = scene;
  const remoteAvatars = new Map();
  let localAvatar = null;
  let localUsernameLabel = null;

  // Helper to create a text sprite for username labels
  function createTextSprite(text, fontSize = 20) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dynamic canvas sizing based on text
    ctx.font = `300 ${fontSize}px Arial`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const paddingX = 12;
    const paddingY = 6;
    const rectWidth = Math.ceil(textWidth + paddingX * 2);
    const rectHeight = fontSize + paddingY * 2;
    
    canvas.width = rectWidth;
    canvas.height = rectHeight;
    
    // Background rounded rectangle
    const radius = Math.min(rectHeight / 2, 8);
    const x = 0;
    const y = 0;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + rectWidth - radius, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
    ctx.lineTo(x + rectWidth, y + rectHeight - radius);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
    ctx.lineTo(x + radius, y + rectHeight);
    ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    
    // Text - centered in the dynamic canvas
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `300 ${fontSize}px Arial`;
    ctx.fillText(text, rectWidth / 2, rectHeight / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(rectWidth / 40, rectHeight / 40, 1);
    return sprite;
  }

  // Helper to add nose cone to an avatar mesh
  function addNoseCone(avatarMesh, color) {
    const noseGeo = new THREE.ConeGeometry(0.2, 1.0, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2; // Rotate to point along +Z axis
    // Base flush with capsule front surface (z=0.4), cone extends forward
    nose.position.set(0, 0.6, 0.7); // y=0.6 to align with capsule center, z=0.7 to extend forward
    avatarMesh.add(nose);

    // Eyes: small white spheres on either side of the nose
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.7, 0.34);
    rightEye.position.set(0.15, 0.7, 0.34);
    avatarMesh.add(leftEye);
    avatarMesh.add(rightEye);
    // Pupils: smaller black spheres on either side of the nose
    const pupilGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.3 });
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.15, 0.7, 0.39);
    rightPupil.position.set(0.15, 0.7, 0.39);
    avatarMesh.add(leftPupil);
    avatarMesh.add(rightPupil);
  }

  // Create local player avatar
  const localGeo = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
  const localMat = new THREE.MeshStandardMaterial({ color: 0xe94560, roughness: 0.5 });
  localAvatar = new THREE.Mesh(localGeo, localMat);
  localAvatar.castShadow = true;
  scene.add(localAvatar);
  addNoseCone(localAvatar, 0xFFF116);

  // Username label above local avatar
  localUsernameLabel = createTextSprite(username || 'Player');
  scene.add(localUsernameLabel);

  function registerRemote(id, data) {
    if (!remoteAvatars.has(id)) {
      const geo = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
      const mat = new THREE.MeshStandardMaterial({ color: id === guid ? 0xe94560 : 0x0f3460 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      scene.add(mesh);
      addNoseCone(mesh, id === guid ? 0xe94560 : 0xFFF116);
      
      // Username label for remote avatar
      const label = createTextSprite(data.username || 'Player');
      scene.add(label);
      
      remoteAvatars.set(id, { mesh, target: new THREE.Vector3(data.x, data.y, data.z), label });
      if (data.yaw !== undefined) {
        mesh.rotation.y = data.yaw;
      }
    } else {
      const entry = remoteAvatars.get(id);
      entry.target.set(data.x, data.y, data.z);
      if (data.username) {
        scene.remove(entry.label);
        entry.label = createTextSprite(data.username);
        scene.add(entry.label);
      }
      if (data.yaw !== undefined) {
        entry.mesh.rotation.y = data.yaw;
      }
    }
  }

  function updateRemote(delta) {
    for (const [, entry] of remoteAvatars) {
      entry.mesh.position.lerp(entry.target, delta * 3);
      // Position label above avatar
      entry.label.position.set(
        entry.mesh.position.x,
        entry.mesh.position.y + 2.0,
        entry.mesh.position.z
      );
    }
  }

  function updateLocalAvatarPosition() {
    if (localAvatar && localUsernameLabel) {
      localUsernameLabel.position.set(
        localAvatar.position.x,
        localAvatar.position.y + 2.0,
        localAvatar.position.z
      );
    }
  }

  return { registerRemote, updateRemote, getLocalAvatar: () => localAvatar, updateLocalAvatarPosition };
}
