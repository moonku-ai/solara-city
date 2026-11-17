// The wanted level: stars 0–5. Crimes raise it, the Solara Police answer
// with patrol cars and foot officers who chase, ram, and arrest — the hotter
// the stars, the more of them and the harder they push.

import * as THREE from 'three';
import { POLICE_TUNING, PALETTE } from './config.js';
import { Car, makePoliceMesh } from './vehicles.js';
import { makePersonMesh } from './player.js';
import { randomRoadPoint, pushOutOfBuildings, clampToWorld } from './city.js';

export class PoliceCar extends Car {
  constructor(scene, x, z, heading) {
    const built = makePoliceMesh();
    super(scene, PALETTE.policeBody, 'sedan', x, z, heading);
    // Replace the plain body with the marked police build.
    scene.remove(this.group);
    this.group = built.group;
    this.wheels = built.wheels;
    this.red = built.red;
    this.blue = built.blue;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    this.group.userData.hit = { kind: 'copcar', ref: this };
    scene.add(this.group);
    this.flashPhase = Math.random() * 10;
  }

  chase(dt, targetX, targetZ, colliders, others, onCrash) {
    const t = POLICE_TUNING;
    const dx = targetX - this.x;
    const dz = targetZ - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.4, Math.min(2.4, diff * 2.2));
    this.heading += turn * dt;
    const targetSpeed = dist > 26 ? t.chaseCarSpeed : t.chaseCarSpeed * 0.75;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.4);

    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const clamped = clampToWorld(nx, nz);
    const fixed = pushOutOfBuildings(clamped.x, clamped.z, 2.4, colliders);
    if ((Math.abs(fixed.x - nx) > 0.05 || Math.abs(fixed.z - nz) > 0.05) && Math.abs(this.speed) > 8) {
      onCrash?.(Math.abs(this.speed));
      this.speed *= 0.4;
    }
    this.setPos(fixed.x, fixed.z);
    for (const other of others) {
      if (other === this) continue;
      const ox = this.x - other.x;
      const oz = this.z - other.z;
      const d = Math.hypot(ox, oz);
      if (d > 0.01 && d < 4.8) {
        this.setPos(this.x + (ox / d) * (4.8 - d) * 0.5, this.z + (oz / d) * (4.8 - d) * 0.5);
      }
    }
    this.group.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 1.4;
    this.flashPhase += dt * 9;
    const on = Math.sin(this.flashPhase) > 0;
    this.red.material.emissiveIntensity = on ? 2.2 : 0.15;
    this.blue.material.emissiveIntensity = on ? 0.15 : 2.2;
  }
}

export class FootCop {
  constructor(scene, x, z) {
    const built = makePersonMesh(0x1a2a44, 0xc98d64);
    this.parts = built;
    this.group = built.group;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.phase = 0;
    this.punchTimer = 0;
    this.fallen = false;
    this.group.position.set(x, 0, z);
    this.group.userData.hit = { kind: 'cop', ref: this };
    scene.add(this.group);
  }

  update(dt, targetX, targetZ, colliders, onReach) {
    if (this.fallen) return;
    const dx = targetX - this.x;
    const dz = targetZ - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const want = Math.atan2(dx, dz);
      this.heading = want;
      const step = Math.min(dist, POLICE_TUNING.footCopSpeed * dt);
      const nx = this.x + Math.sin(want) * step;
      const nz = this.z + Math.cos(want) * step;
      const fixed = pushOutOfBuildings(nx, nz, 0.6, colliders);
      const clamped = clampToWorld(fixed.x, fixed.z);
      this.x = clamped.x;
      this.z = clamped.z;
    }
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    this.phase += dt * 11;
    const swing = Math.sin(this.phase) * 0.55;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.7;
    this.parts.armR.rotation.x = swing * 0.7;
    this.punchTimer -= dt;
    if (dist < 1.8 && this.punchTimer <= 0) {
      this.punchTimer = 1.1;
      onReach?.();
    }
  }

  knockDown() {
    this.fallen = true;
    this.group.rotation.z = Math.PI / 2;
    this.group.position.y = 0.3;
  }
}

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.stars = 0;
    this.cars = [];
    this.cops = [];
    this.lastCrimeAt = -1000;
    this.lastDecayAt = 0;
    this.arrestProgress = 0;
    this.nearestCopDist = 999;
  }

  addWanted(n, now) {
    this.stars = Math.max(0, Math.min(5, this.stars + n));
    this.lastCrimeAt = now;
  }

  setWanted(n, now) {
    this.stars = Math.max(0, Math.min(5, n));
    this.lastCrimeAt = now;
  }

  clearWanted() {
    this.stars = 0;
    this.arrestProgress = 0;
  }

  update(dt, now, playerPos, playerInCar, playerCar, colliders, onArrestTick, onCopPunch) {
    // Slow decay when the heat dies down and no officer is close.
    if (this.stars > 0 && now - this.lastCrimeAt > POLICE_TUNING.decayGraceSeconds
      && this.nearestCopDist > 55 && now - this.lastDecayAt > POLICE_TUNING.decayStepSeconds) {
      this.stars -= 1;
      this.lastDecayAt = now;
    }

    const wantCars = this.stars >= 1 ? Math.min(this.stars, 3) : 0;
    const wantCops = this.stars >= 2 ? Math.min(this.stars - 1, 2) : 0;

    while (this.cars.length < wantCars) {
      const spot = randomRoadPoint(this.rng);
      const dx = spot.x - playerPos.x;
      const dz = spot.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      const sx = playerPos.x + (dx / (d || 1)) * POLICE_TUNING.spawnDistance;
      const sz = playerPos.z + (dz / (d || 1)) * POLICE_TUNING.spawnDistance;
      const clamped = clampToWorld(sx, sz);
      this.cars.push(new PoliceCar(this.scene, clamped.x, clamped.z, Math.atan2(-dx, -dz)));
    }
    while (this.cars.length > wantCars) {
      const gone = this.cars.pop();
      this.scene.remove(gone.group);
    }
    while (this.cops.length < wantCops) {
      const spot = randomRoadPoint(this.rng);
      const clamped = clampToWorld(spot.x + 20, spot.z + 20);
      this.cops.push(new FootCop(this.scene, clamped.x, clamped.z));
    }
    while (this.cops.length > wantCops) {
      const gone = this.cops.pop();
      this.scene.remove(gone.group);
    }

    const others = [...this.cars];
    if (playerCar) others.push(playerCar);
    let nearest = 999;
    for (const car of this.cars) {
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d < nearest) nearest = d;
      car.chase(dt, playerPos.x, playerPos.z, colliders, others, () => {});
    }
    for (const cop of this.cops) {
      const d = Math.hypot(cop.x - playerPos.x, cop.z - playerPos.z);
      if (d < nearest) nearest = d;
      cop.update(dt, playerPos.x, playerPos.z, colliders, onCopPunch);
    }
    this.nearestCopDist = nearest;

    // Arrest: an officer standing on the player fills the meter.
    if (!playerInCar && this.cops.some((c) => !c.fallen && Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 2.2)) {
      this.arrestProgress += dt / POLICE_TUNING.arrestSeconds;
      onArrestTick?.(this.arrestProgress);
    } else {
      this.arrestProgress = Math.max(0, this.arrestProgress - dt * 0.5);
    }
  }

  nearestPoliceDistance() {
    return this.nearestCopDist;
  }
}
