// Cars: boxy original models built from primitives, plus arcade driving
// physics — acceleration, steering that tightens with speed, handbrake,
// and simple circle-vs-building and car-vs-car collision.

import * as THREE from 'three';
import { CAR_TUNING, PALETTE } from './config.js';
import { pushOutOfBuildings, clampToWorld } from './city.js';

const bodyGeo = new THREE.BoxGeometry(2, 0.75, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
const lightGeo = new THREE.BoxGeometry(0.35, 0.18, 0.1);
const barGeo = new THREE.BoxGeometry(1.6, 0.16, 0.5);

export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.1, metalness: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.28, kind === 'truck' ? 0.6 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.6), bodyMat);
    bed.position.set(0, 1.0, -1.3);
    group.add(bed);
  }

  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
  for (const hx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(lightGeo, headMat);
    light.position.set(hx, 0.62, 2.22);
    group.add(light);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd21f1f, emissive: 0x8a1010, emissiveIntensity: 0.6 });
  for (const hx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(hx, 0.62, -2.22);
    group.add(tail);
  }
  return { group, wheels };
}

export function makePoliceMesh() {
  const { group, wheels } = makeCarMesh(PALETTE.policeBody, 'sedan');
  const trimMat = new THREE.MeshStandardMaterial({ color: PALETTE.policeTrim, roughness: 0.4, metalness: 0.4 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), trimMat);
  stripe.position.y = 0.62;
  group.add(stripe);
  const bar = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
  bar.position.set(0, 1.72, -0.2);
  group.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
  red.position.set(-0.4, 1.84, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
  blue.position.set(0.4, 1.84, -0.2);
  group.add(red, blue);
  return { group, wheels, red, blue };
}

export class Car {
  constructor(scene, color, kind, x, z, heading) {
    const built = makeCarMesh(color, kind);
    this.group = built.group;
    this.wheels = built.wheels;
    this.kind = kind;
    this.color = color;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }
  setPos(x, z) { this.group.position.x = x; this.group.position.z = z; }

  // One step of arcade driving. Returns a crash event when a hard hit happens.
  drive(dt, input, colliders, otherCars, effects, onCrash) {
    const t = CAR_TUNING;
    const forward = input.held('KeyW') || input.held('ArrowUp');
    const back = input.held('KeyS') || input.held('ArrowDown');
    const left = input.held('KeyA') || input.held('ArrowLeft');
    const right = input.held('KeyD') || input.held('ArrowRight');
    const handbrake = input.held('Space');

    if (forward) this.speed += t.accel * dt;
    if (back) this.speed -= (this.speed > 0.5 ? t.brake : t.reverseAccel) * dt;
    if (!forward && !back) this.speed -= Math.sign(this.speed) * t.drag * 4 * dt;
    if (handbrake) {
      this.speed -= Math.sign(this.speed) * t.handbrake * dt;
      if (Math.abs(this.speed) < 0.6) this.speed = 0;
    }
    this.speed = Math.max(-t.maxReverse, Math.min(t.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.05 && !forward && !back) this.speed = 0;

    const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
    const steerGoal = steerTarget * t.steerMax * (this.speed < 0 ? -1 : 1);
    this.steer += (steerGoal - this.steer) * Math.min(1, t.steerSpeed * dt * 2);
    const turnRate = this.steer * (Math.abs(this.speed) / 8) * 1.9;
    this.heading += turnRate * dt * Math.sign(this.speed || 1);

    const oldX = this.x;
    const oldZ = this.z;
    const nx = oldX + Math.sin(this.heading) * this.speed * dt;
    const nz = oldZ + Math.cos(this.heading) * this.speed * dt;
    const clamped = clampToWorld(nx, nz);
    const fixed = pushOutOfBuildings(clamped.x, clamped.z, t.radius, colliders);
    const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01
      || clamped.x !== nx || clamped.z !== nz;
    if (hitWall && Math.abs(this.speed) > 9) {
      onCrash?.(Math.abs(this.speed));
      if (effects) {
        effects.burst(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffb020, 14, { life: 0.5, gravity: 6 });
      }
      this.speed *= 0.35;
    } else if (hitWall) {
      this.speed *= 0.6;
    }
    this.setPos(fixed.x, fixed.z);

    // Soft push against other cars.
    for (const other of otherCars) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const d = Math.hypot(dx, dz);
      const min = t.radius + CAR_TUNING.radius;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        this.setPos(this.x + (dx / d) * push, this.z + (dz / d) * push);
        if (Math.abs(this.speed) > 8) onCrash?.(Math.abs(this.speed) * 0.6);
        this.speed *= 0.9;
      }
    }

    this.group.rotation.y = this.heading;
    const wheelSpin = this.speed * dt * 1.4;
    for (const w of this.wheels) w.rotation.x += wheelSpin;
    if (this.wheels[0]) this.wheels[0].rotation.y = this.steer * 0.5;
    if (this.wheels[1]) this.wheels[1].rotation.y = this.steer * 0.5;
    // Body lean and bounce for feel.
    this.group.rotation.z = -this.steer * Math.min(1, Math.abs(this.speed) / 20) * 0.08;
    this.group.position.y = Math.abs(Math.sin(this.speed * 2.2)) * 0.03 * Math.min(1, Math.abs(this.speed) / 12);
  }
}
