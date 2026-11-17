// The living city: AI cars cruising the road grid and turning at
// intersections, and pedestrians strolling the sidewalks who scatter when a
// car bears down on them.

import * as THREE from 'three';
import { TRAFFIC_TUNING, PALETTE } from './config.js';
import { WORLD } from './config.js';
import { Car } from './vehicles.js';
import { makePersonMesh } from './player.js';
import { pushOutOfBuildings, clampToWorld } from './city.js';

function nearestRoadLine(v) {
  let best = WORLD.roadLines[0];
  let bestD = Math.abs(v - best);
  for (const line of WORLD.roadLines) {
    const d = Math.abs(v - line);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

export class TrafficCar {
  constructor(scene, rng, city) {
    const spot = randomRoadSpawn(rng);
    this.car = new Car(scene, rng.pick(PALETTE.carColors), rng.pick(['sedan', 'sedan', 'truck']), spot.x, spot.z, spot.heading);
    this.speed = rng.range(TRAFFIC_TUNING.carSpeedMin, TRAFFIC_TUNING.carSpeedMax);
    this.vertical = Math.abs(Math.sin(spot.heading)) < 0.5;
    this.line = nearestRoadLine(this.vertical ? spot.x : spot.z);
    this.dir = Math.sign(this.vertical ? Math.cos(spot.heading) : Math.sin(spot.heading)) || 1;
    this.lane = rng.pick([-3, 3]);
    this.stopped = 0;
    this.city = city;
  }

  update(dt, allCars, playerPos) {
    if (this.stopped > 0) {
      this.stopped -= dt;
      return;
    }
    // Stop for a car or the player right ahead.
    const aheadX = this.car.x + Math.sin(this.car.heading) * 7;
    const aheadZ = this.car.z + Math.cos(this.car.heading) * 7;
    for (const other of allCars) {
      if (other === this.car) continue;
      if (Math.hypot(other.x - aheadX, other.z - aheadZ) < 4) {
        this.stopped = 0.5;
        return;
      }
    }
    if (Math.hypot(playerPos.x - aheadX, playerPos.z - aheadZ) < 4) {
      this.stopped = 0.4;
      return;
    }

    const step = this.speed * dt;
    let nx = this.car.x;
    let nz = this.car.z;
    if (this.vertical) nz += this.dir * step;
    else nx += this.dir * step;

    // At an intersection, sometimes turn onto the cross street.
    const onLine = this.vertical ? nx : nz;
    const cross = nearestRoadLine(this.vertical ? nz : nx);
    const nearCross = Math.abs((this.vertical ? nz : nx) - cross) < 2.5;
    if (nearCross && Math.random() < 0.012) {
      this.vertical = !this.vertical;
      this.line = cross;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.lane = Math.random() < 0.5 ? -3 : 3;
      this.car.heading = this.vertical ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (this.vertical) {
      nx = this.line + this.lane;
      nz = Math.max(-205, Math.min(205, nz));
      if (nz >= 205 || nz <= -205) this.dir *= -1;
    } else {
      nz = this.line + this.lane;
      nx = Math.max(-205, Math.min(205, nx));
      if (nx >= 205 || nx <= -205) this.dir *= -1;
    }
    this.car.setPos(nx, nz);
    const targetHeading = this.vertical ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.car.heading = targetHeading;
    this.car.group.rotation.y = targetHeading;
    for (const w of this.car.wheels) w.rotation.x += step * 1.4;
  }
}

function randomRoadSpawn(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.pick(WORLD.roadLines);
  const along = rng.range(-180, 180);
  const lane = rng.pick([-3, 3]);
  if (vertical) return { x: line + lane, z: along, heading: lane > 0 ? 0 : Math.PI };
  return { x: along, z: line + lane, heading: lane > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export class Pedestrian {
  constructor(scene, rng) {
    const spot = randomRoadSpawn(rng);
    const shirt = rng.pick([0xd25a4a, 0x4a7ad2, 0xe8c832, 0x7a4ad2, 0x3aa655, 0xe87a2e, 0xd2d2d2]);
    const built = makePersonMesh(shirt, rng.pick([0xc98d64, 0x8a5a3a, 0xe8b48a, 0x6a4530]));
    this.parts = built;
    this.group = built.group;
    this.x = spot.x + (rng.chance(0.5) ? 9 : -9);
    this.z = spot.z + (rng.chance(0.5) ? 9 : -9);
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(TRAFFIC_TUNING.pedSpeedMin, TRAFFIC_TUNING.pedSpeedMax);
    this.phase = rng.range(0, 6);
    this.fleeing = 0;
    this.fallen = false;
    this.fallTimer = 0;
    this.vertical = rng.chance(0.5);
    this.line = nearestRoadLine(this.vertical ? this.x : this.z);
    this.side = rng.pick([-9, 9]);
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
  }

  update(dt, playerPos, playerSpeed, colliders) {
    if (this.fallen) {
      this.fallTimer -= dt;
      if (this.fallTimer <= 0) {
        this.group.visible = false;
      }
      return;
    }
    const distToPlayer = Math.hypot(playerPos.x - this.x, playerPos.z - this.z);
    if (distToPlayer < 9 && playerSpeed > 6) this.fleeing = 1.2;
    if (this.fleeing > 0) this.fleeing -= dt;

    const speed = this.fleeing > 0 ? 5.5 : this.speed;
    let nx = this.x + Math.sin(this.heading) * speed * dt;
    let nz = this.z + Math.cos(this.heading) * speed * dt;

    // Stay on the sidewalk: keep the side offset, walk along the road.
    if (this.vertical) {
      nx = this.line + this.side;
      if (nz > 205 || nz < -205) { this.heading += Math.PI; }
    } else {
      nz = this.line + this.side;
      if (nx > 205 || nx < -205) { this.heading += Math.PI; }
    }
    // Occasionally turn at an intersection.
    const cross = nearestRoadLine(this.vertical ? nz : nx);
    if (Math.abs((this.vertical ? nz : nx) - cross) < 1.5 && Math.random() < 0.008) {
      this.vertical = !this.vertical;
      this.line = cross;
      this.side = Math.random() < 0.5 ? -9 : 9;
      this.heading = this.vertical ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    }
    const fixed = pushOutOfBuildings(nx, nz, 0.6, colliders);
    const clamped = clampToWorld(fixed.x, fixed.z);
    this.x = clamped.x;
    this.z = clamped.z;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    this.phase += dt * (this.fleeing > 0 ? 13 : 8);
    const swing = Math.sin(this.phase) * 0.5;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.7;
    this.parts.armR.rotation.x = swing * 0.7;
  }

  knockDown() {
    this.fallen = true;
    this.fallTimer = 6;
    this.group.rotation.z = Math.PI / 2;
    this.group.position.y = 0.3;
  }
}

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < TRAFFIC_TUNING.carCount; i++) {
      this.cars.push(new TrafficCar(scene, rng, city));
    }
    for (let i = 0; i < TRAFFIC_TUNING.pedCount; i++) {
      this.peds.push(new Pedestrian(scene, rng));
    }
  }

  update(dt, playerPos, playerSpeed, colliders, playerCar) {
    const allCars = this.cars.map((c) => c.car);
    if (playerCar) allCars.push(playerCar);
    for (const car of this.cars) car.update(dt, allCars, playerPos);
    for (const ped of this.peds) ped.update(dt, playerPos, playerSpeed, colliders);
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const t of this.cars) {
      const d = Math.hypot(t.car.x - x, t.car.z - z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  removeCar(trafficCar) {
    const i = this.cars.indexOf(trafficCar);
    if (i >= 0) this.cars.splice(i, 1);
  }

  addCar(trafficCar) {
    this.cars.push(trafficCar);
  }
}
