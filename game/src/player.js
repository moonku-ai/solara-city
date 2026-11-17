// Raka on foot: a boxy courier with swinging limbs, WASD movement relative
// to the camera, sprint, and a smooth third-person camera that swings behind
// the car while driving.

import * as THREE from 'three';
import { PLAYER_TUNING } from './config.js';
import { pushOutOfBuildings, clampToWorld } from './city.js';

export function makePersonMesh(shirtColor, skinColor = 0xc98d64) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xffb400, roughness: 0.7 }));
  cap.position.y = 1.96;
  group.add(cap);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.38, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legR.position.set(0.16, 0.38, 0);
  group.add(legL, legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.14, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armR.position.set(0.42, 1.14, 0);
  group.add(armL, armR);

  return { group, legL, legR, armL, armR, torso, head };
}

export class Player {
  constructor(scene, x, z, heading) {
    const built = makePersonMesh(0x2e8f6e);
    this.parts = built;
    this.group = built.group;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.camYaw = heading;
    this.camPitch = 0.32;
    this.vx = 0;
    this.vz = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.sprinting = false;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  update(dt, input, colliders, camera, driving, carHeading, effects) {
    const mouse = input.takeMouse();
    this.camYaw -= mouse.dx * 0.0032;
    this.camPitch = Math.max(0.05, Math.min(1.1, this.camPitch + mouse.dy * 0.0024));

    if (driving) {
      // Camera trails the car from behind.
      const wantYaw = carHeading;
      let diff = wantYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 3.2);
      this.updateCamera(dt, camera, driving);
      return;
    }

    const fwd = input.held('KeyW') || input.held('ArrowUp');
    const back = input.held('KeyS') || input.held('ArrowDown');
    const left = input.held('KeyA') || input.held('ArrowLeft');
    const right = input.held('KeyD') || input.held('ArrowRight');
    this.sprinting = input.held('ShiftLeft') || input.held('ShiftRight');
    const topSpeed = this.sprinting ? PLAYER_TUNING.runSpeed : PLAYER_TUNING.walkSpeed;

    // Movement is relative to where the camera looks: W walks away from the
    // camera into the screen, A/D strafe across it.
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    let mx = 0;
    let mz = 0;
    if (fwd) { mx += sin; mz += cos; }
    if (back) { mx -= sin; mz -= cos; }
    if (left) { mx += cos; mz += -sin; }
    if (right) { mx += -cos; mz += sin; }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (this.moving) {
      mx /= len;
      mz /= len;
      this.vx += (mx * topSpeed - this.vx) * Math.min(1, dt * 10);
      this.vz += (mz * topSpeed - this.vz) * Math.min(1, dt * 10);
      this.heading = Math.atan2(this.vx, this.vz);
      this.walkPhase += dt * (this.sprinting ? 13 : 9);
    } else {
      this.vx -= this.vx * Math.min(1, dt * 12);
      this.vz -= this.vz * Math.min(1, dt * 12);
    }

    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    const clamped = clampToWorld(nx, nz);
    const fixed = pushOutOfBuildings(clamped.x, clamped.z, PLAYER_TUNING.radius, colliders);
    this.x = fixed.x;
    this.z = fixed.z;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;

    // Limb swing while walking, idle breathing otherwise.
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.8;
    this.parts.armR.rotation.x = swing * 0.8;
    this.parts.torso.position.y = 1.12 + (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : Math.sin(performance.now() * 0.0015) * 0.01);

    if (this.moving && this.sprinting && Math.random() < dt * 6) {
      effects.spawn(new THREE.Vector3(this.x, 0.15, this.z), { color: 0xcbb98a, size: 0.7, life: 0.5, vy: 0.6, spread: 0.8, opacity: 0.4 });
    }

    this.updateCamera(dt, camera, false);
  }

  updateCamera(dt, camera, driving) {
    const dist = driving ? 11.5 : 8.5;
    const height = driving ? 4.4 : 3.4;
    const tx = this.x - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const tz = this.z - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const ty = height + Math.sin(this.camPitch) * dist * 0.6;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 10);
    camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 10);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 10);
    // Look a few units ahead of the player/car, so the hero sits in the
    // lower half of the frame and the crosshair points at the world ahead.
    const viewX = Math.sin(this.camYaw);
    const viewZ = Math.cos(this.camYaw);
    const ahead = driving ? 9 : 5;
    camera.lookAt(this.x + viewX * ahead, driving ? 1.5 : 1.8, this.z + viewZ * ahead);
  }

  aimDirection(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
}
