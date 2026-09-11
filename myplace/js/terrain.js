import * as THREE from 'three';

export function initTerrain(scene, seed) {
  // World sizing
  const WORLD_RADIUS = 80;
  const FLAT_CENTER_RADIUS = 12;
  const EDGE_FALLOFF_START = 0.55; // fraction of WORLD_RADIUS
  const EDGE_FALLOFF_STEEPNESS = 0.2;

  // Terrain height parameters
  const BASE_AMPLITUDE = 6;
  const BASE_FREQUENCY_X = 0.04;
  const BASE_FREQUENCY_Z = 0.04;

  const MID_AMPLITUDE = 4;
  const MID_FREQUENCY_X = 0.08;
  const MID_FREQUENCY_Z = 0.06;
  const MID_PHASE_X = 1.3;
  const MID_PHASE_Z = 0.7;

  const FINE_AMPLITUDE = 2;
  const FINE_FREQUENCY_X = 0.15;
  const FINE_FREQUENCY_Z = 0.12;
  const FINE_PHASE_X = 2.1;
  const FINE_PHASE_Z = 1.2;

  const clock = new THREE.Clock();
  let terrainMesh, waterMesh;
  const trees = [], rocks = [], clouds = [];

  function mulberry32(str) {
    let s = 0;
    for (let i = 0; i < str.length; i++) s = ((s << 5) - s + str.charCodeAt(i)) | 0;
    return function() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(s ^ (s >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getTerrainHeight(x, z) {
    let h = Math.sin(x * BASE_FREQUENCY_X) * Math.cos(z * BASE_FREQUENCY_Z) * BASE_AMPLITUDE;
    h += Math.sin(x * MID_FREQUENCY_X + MID_PHASE_X) * Math.cos(z * MID_FREQUENCY_Z + MID_PHASE_Z) * MID_AMPLITUDE;
    h += Math.sin(x * FINE_FREQUENCY_X + FINE_PHASE_X) * Math.cos(z * FINE_FREQUENCY_Z + FINE_PHASE_Z) * FINE_AMPLITUDE;
    const dist = Math.sqrt(x * x + z * z);
    if (dist < FLAT_CENTER_RADIUS) h *= dist / FLAT_CENTER_RADIUS;
    if (dist > WORLD_RADIUS * EDGE_FALLOFF_START) h -= (dist - WORLD_RADIUS * EDGE_FALLOFF_START) * EDGE_FALLOFF_STEEPNESS;
    return h;
  }

  function createTerrain() {
    const rng = mulberry32(seed);
    const size = WORLD_RADIUS * 2;
    const segments = 128;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i], z = vertices[i + 2];
      const height = vertices[i + 1] = getTerrainHeight(x, z);
      const dist = Math.sqrt(x * x + z * z);
      let r, g, b;
      if (height < -2) { r = 0.76; g = 0.70; b = 0.50; }
      else if (height < 1) { r = 0.20; g = 0.50; b = 0.20; }
      else if (height < 4) { r = 0.15; g = 0.45; b = 0.15; }
      else { r = 0.40; g = 0.35; b = 0.30; }
      colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 });
    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
  }

  function createWater() {
    const geometry = new THREE.PlaneGeometry(WORLD_RADIUS * 2.5, WORLD_RADIUS * 2.5);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.3 });
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.position.y = -2;
    scene.add(waterMesh);
  }

  function createTrees(rng) {
    for (let i = 0; i < 60; i++) {
      const x = (rng() - 0.5) * WORLD_RADIUS * 1.6;
      const z = (rng() - 0.5) * WORLD_RADIUS * 1.6;
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 8 || dist > WORLD_RADIUS * 0.7) continue;
      const y = getTerrainHeight(x, z);
      if (y < -1) continue;
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
      );
      trunk.position.y = 1; trunk.castShadow = true; group.add(trunk);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 })
      );
      leaves.position.y = 3; leaves.castShadow = true; group.add(leaves);
      group.position.set(x, y, z);
      group.scale.setScalar(0.8 + rng() * 0.6);
      scene.add(group);
      trees.push(group);
    }
  }

  function createRocks(rng) {
    for (let i = 0; i < 40; i++) {
      const x = (rng() - 0.5) * WORLD_RADIUS * 1.6;
      const z = (rng() - 0.5) * WORLD_RADIUS * 1.6;
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 8 || dist > WORLD_RADIUS * 0.7) continue;
      const y = getTerrainHeight(x, z);
      if (y > 2) continue;
      const size = 0.3 + rng() * 0.7;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 1),
        new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.95 })
      );
      rock.position.set(x, y + size * 0.3, z);
      rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
      rocks.push(rock);
    }
  }

  function createClouds(rng) {
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      for (let j = 0; j < 3 + Math.floor(rng() * 3); j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(1.5 + rng(), 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
        );
        puff.position.set(j * 2.5 - (3 + Math.floor(rng() * 3)), rng() * 0.5, rng() * 1.5);
        group.add(puff);
      }
      const angle = rng() * Math.PI * 2, radius = 20 + rng() * 15;
      clouds.push({ group, angle, radius, speed: 0.5 + rng() });
      group.position.set(Math.cos(angle) * radius, 25, Math.sin(angle) * radius);
      scene.add(group);
    }
  }

  function updateClouds(time) {
    for (const cloud of clouds) {
      cloud.angle += cloud.speed * 0.01;
      cloud.group.position.x = Math.cos(cloud.angle) * cloud.radius;
      cloud.group.position.z = Math.sin(cloud.angle) * cloud.radius;
    }
  }

  function animateWater(time) {
    if (!waterMesh) return;
    const vertices = waterMesh.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i], z = vertices[i + 2];
      vertices[i + 1] = Math.sin(x * 0.1 + time) * 0.2 + Math.cos(z * 0.08 + time * 0.7) * 0.15;
    }
    waterMesh.geometry.attributes.position.needsUpdate = true;
  }

  return { init: () => { createTerrain(); createWater(); createTrees(mulberry32(seed)); createRocks(mulberry32(seed + 1)); createClouds(mulberry32(seed + 2)); }, getTerrainHeight, updateClouds, animateWater };
}
