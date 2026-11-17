// Solara City itself: a sunny coastal grid built from one seed — roads,
// sidewalks and crosswalks painted onto one big ground texture, procedural
// buildings with lit windows, palms, streetlights, a beach and an ocean.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

function makeWindowTexture(rng, litChance) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e6ded2';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng.next() < litChance;
      g.fillStyle = lit ? '#ffd98a' : '#3d5a78';
      g.fillRect(10 + col * 30, 12 + row * 27, 20, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintGround(rng) {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const half = WORLD.cityHalf;
  const toPx = (v) => ((v + half) / (half * 2)) * size;
  const pxPerUnit = size / (half * 2);

  // Grass base.
  g.fillStyle = '#5da24a';
  g.fillRect(0, 0, size, size);
  // Mow stripes for a little texture.
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 24; i++) {
    if (i % 2 === 0) g.fillRect(0, (i * size) / 24, size, size / 48);
  }

  // Sidewalk strips (light) then road strips (dark) on every grid line.
  for (const line of WORLD.roadLines) {
    g.fillStyle = '#9aa0a3';
    g.fillRect(toPx(line - 9), 0, 18 * pxPerUnit, size);
    g.fillRect(0, toPx(line - 9), size, 18 * pxPerUnit);
    g.fillStyle = '#2e3138';
    g.fillRect(toPx(line - 6), 0, 12 * pxPerUnit, size);
    g.fillRect(0, toPx(line - 6), size, 12 * pxPerUnit);
  }
  // Centre dashes.
  g.fillStyle = '#e8c832';
  for (const line of WORLD.roadLines) {
    for (let d = -200; d < 200; d += 16) {
      g.fillRect(toPx(line) - 1, toPx(d), 2, 8 * pxPerUnit);
      g.fillRect(toPx(d), toPx(line) - 1, 8 * pxPerUnit, 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e8e8';
  for (const a of WORLD.roadLines) {
    for (const b of WORLD.roadLines) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(toPx(a + k * 2.4) - 2, toPx(b - 8), 4, 4 * pxPerUnit);
        g.fillRect(toPx(a - 8), toPx(b + k * 2.4) - 2, 4 * pxPerUnit, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- Ground, sand, ocean ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.cityHalf * 2, WORLD.cityHalf * 2),
    new THREE.MeshStandardMaterial({ map: paintGround(rng), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 52),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, 242);
  sand.receiveShadow = true;
  group.add(sand);

  const oceanMat = new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.25, metalness: 0.1 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(760, 200), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, 368);
  group.add(ocean);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.08, 268);
  group.add(foam);

  // Boardwalk strip along the sand.
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(430, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0xa97c50, roughness: 0.9 }),
  );
  boardwalk.position.set(0, 0.15, 220);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  // --- Buildings ---
  const windowTex = [makeWindowTexture(rng, 0.25), makeWindowTexture(rng, 0.45), makeWindowTexture(rng, 0.15)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a6f75, roughness: 0.9 });
  const buildings = [];
  const lines = WORLD.roadLines;
  for (let bi = 0; bi < lines.length - 1; bi++) {
    for (let bj = 0; bj < lines.length - 1; bj++) {
      const x0 = lines[bi] + WORLD.roadHalf + 3;
      const x1 = lines[bi + 1] - WORLD.roadHalf - 3;
      const z0 = lines[bj] + WORLD.roadHalf + 3;
      const z1 = lines[bj + 1] - WORLD.roadHalf - 3;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // Solara Plaza occupies the centre block; the beachfront row is hotels.
      // The four blocks around the plaza stay open as gardens, so the plaza
      // never stares at a blank tower wall.
      if (Math.abs(cx) < 1 && Math.abs(cz) < 1) continue;
      if ((Math.abs(cx) === 90 && Math.abs(cz) < 1) || (Math.abs(cz) === 90 && Math.abs(cx) < 1)) {
        continue;
      }
      const downtown = Math.hypot(cx, cz) < 90;
      const count = rng.chance(downtown ? 0.55 : 0.3) ? 1 : rng.int(2, 4);
      for (let k = 0; k < count; k++) {
        const w = rng.range(14, 22);
        const d = rng.range(14, 22);
        const px = count === 1 ? cx : rng.range(x0 + w / 2, x1 - w / 2);
        const pz = count === 1 ? cz : rng.range(z0 + d / 2, z1 - d / 2);
        const h = (Math.abs(cx) <= 90 && Math.abs(cz) <= 90)
          ? rng.range(8, 16) // low roofs around the plaza: no wall in the opening view
          : downtown ? rng.range(22, 58) : rng.range(9, 26);
        const color = rng.pick(PALETTE.buildingColors);
        const sideMat = new THREE.MeshStandardMaterial({
          map: rng.pick(windowTex),
          color,
          roughness: 0.85,
        });
        const mesh = new THREE.Mesh(boxGeo, [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
        mesh.scale.set(w, h, d);
        mesh.position.set(px, h / 2, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        buildings.push(mesh);
        colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
      }
    }
  }

  // --- Solara Plaza: fountain, trees, benches ---
  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.8 }),
  );
  fountainBase.position.set(0, 0.6, 0);
  fountainBase.castShadow = true;
  group.add(fountainBase);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x3fa8d8, roughness: 0.15, metalness: 0.3 }),
  );
  fountainWater.position.set(0, 1.1, 0);
  group.add(fountainWater);

  // --- Streetlights ---
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.4 });
  const lampGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 0.9 });
  const lights = [];
  for (const line of WORLD.roadLines) {
    for (let d = -180; d <= 180; d += 90) {
      for (const [lx, lz] of [[line + 8, d], [line - 8, d + 45]]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(lx, 3.25, lz);
        pole.castShadow = true;
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(lx, 6.6, lz);
        group.add(pole, lamp);
        lights.push(lamp);
      }
    }
  }

  // --- Palm trees along the beach, the plaza and a few avenues ---
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 6, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 });
  const frondGeo = new THREE.ConeGeometry(2.4, 3.2, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9, flatShading: true });
  const palms = [];
  const palmSpots = [];
  for (let x = -200; x <= 200; x += 20) palmSpots.push([x, 224]);
  for (let i = 0; i < 10; i++) palmSpots.push([rng.range(-50, 50), rng.range(-50, 50)]);
  // Garden palms in the four open blocks around the plaza.
  for (const [gx, gz] of [[-90, 0], [90, 0], [0, -90], [0, 90]]) {
    for (let i = 0; i < 4; i++) palmSpots.push([gx + rng.range(-32, 32), gz + rng.range(-32, 32)]);
  }
  for (const line of [-120, 0, 120]) {
    for (let d = -150; d <= 150; d += 60) palmSpots.push([line + 9, d]);
  }
  for (const [px, pz] of palmSpots) {
    // Keep the plaza's centre and Raka's starting sidewalk clear, so no
    // trunk ever grows right in front of the opening camera.
    if (Math.hypot(px - 8, pz - 26) < 18) continue;
    if (Math.hypot(px, pz) < 14) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3, pz);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(frondGeo, frondMat);
    crown.position.set(px, 7.2, pz);
    crown.castShadow = true;
    group.add(trunk, crown);
    palms.push(crown);
  }

  // --- Clouds drifting above the city (unlit, so they stay bright white) ---
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.scale.set(rng.range(6, 14), rng.range(2.5, 4.5), rng.range(5, 9));
      puff.position.set(p * rng.range(5, 9) - puffs * 3, rng.range(-1, 1), rng.range(-3, 3));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-220, 220), rng.range(70, 110), rng.range(-220, 260));
    group.add(cloud);
    clouds.push(cloud);
  }

  // --- The sun disc ---
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
  );
  sun.position.set(280, 200, 320);
  sun.lookAt(0, 40, 0);
  group.add(sun);

  return {
    colliders,
    buildings,
    update(dt, t) {
      foam.position.z = 268 + Math.sin(t * 0.7) * 2.2;
      oceanMat.color.setHSL(0.55, 0.62, 0.42 + Math.sin(t * 0.4) * 0.02);
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.1;
        if (cloud.position.x > 260) cloud.position.x = -260;
      }
      for (const palm of palms) {
        palm.rotation.z = Math.sin(t * 0.9 + palm.position.x * 0.05) * 0.05;
      }
    },
  };
}

// Push a circle (player, car, ped) out of every building AABB it overlaps.
export function pushOutOfBuildings(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        pz = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const left = px - b.minX;
        const right = b.maxX - px;
        const up = pz - b.minZ;
        const down = b.maxZ - pz;
        const m = Math.min(left, right, up, down);
        if (m === left) px = b.minX - radius;
        else if (m === right) px = b.maxX + radius;
        else if (m === up) pz = b.minZ - radius;
        else pz = b.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

export function clampToWorld(x, z) {
  return {
    x: Math.max(-WORLD.cityHalf, Math.min(WORLD.cityHalf, x)),
    z: Math.max(-WORLD.cityHalf, Math.min(290, z)),
  };
}

// A random point on a road, with a lane offset, plus the road's heading.
export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.pick(WORLD.roadLines);
  const along = rng.range(-180, 180);
  const lane = rng.pick([-3, 3]);
  if (vertical) return { x: line + lane, z: along, heading: rng.chance(0.5) ? 0 : Math.PI };
  return { x: along, z: line + lane, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
}

export const LANDMARKS = {
  start: { x: 8, z: 26, heading: Math.PI },
  plaza: { x: 0, z: 40 },
  cafe: { x: 150, z: 186 },
  pierHouse: { x: -168, z: 196 },
  beachParty: { x: 120, z: 244 },
  marina: { x: -150, z: 236 },
};
