// Combat on foot: a pistol aimed with the mouse (raycast from the camera
// through the crosshair) and a close-range punch. Hits are resolved against
// whatever the ray meets first — a pedestrian, an officer, or a car body.

import * as THREE from 'three';
import { COMBAT_TUNING } from './config.js';

export class Combat {
  constructor(scene, camera, effects, sound) {
    this.scene = scene;
    this.camera = camera;
    this.effects = effects;
    this.sound = sound;
    this.ammo = COMBAT_TUNING.pistolMag;
    this.reserve = 48;
    this.reloadTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = COMBAT_TUNING.pistolRange;
    this.cooldown = 0;
    // One reusable tracer line for the muzzle flash path.
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    this.tracerLife = 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0 && this.reserve > 0) {
        const need = COMBAT_TUNING.pistolMag - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
    }
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      this.tracer.material.opacity = Math.max(0, this.tracerLife / 0.08);
    }
  }

  reloading() {
    return this.reloadTimer > 0;
  }

  reload() {
    if (this.reloadTimer <= 0 && this.ammo < COMBAT_TUNING.pistolMag && this.reserve > 0) {
      this.reloadTimer = COMBAT_TUNING.reloadSeconds;
      this.sound.blip(300, 0.08, 'square', 0.12);
    }
  }

  // Fire one shot. `targets` are root groups carrying userData.hit = {kind, ref}.
  // Returns the hit record or null.
  shoot(targets) {
    if (this.cooldown > 0 || this.reloadTimer > 0) return 'busy';
    if (this.ammo <= 0) {
      this.sound.denied();
      this.reload();
      return 'empty';
    }
    this.ammo -= 1;
    this.cooldown = 0.22;
    this.sound.gunshot();

    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects(targets, true);
    let end = origin.clone().addScaledVector(dir, COMBAT_TUNING.pistolRange);
    let hitRecord = null;
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.hit) node = node.parent;
      if (node?.userData.hit) {
        hitRecord = { ...node.userData.hit, point: hit.point.clone() };
        end = hit.point.clone();
        break;
      }
    }

    // Muzzle flash + tracer + impact sparks.
    const muzzle = origin.clone().addScaledVector(dir, 1.2);
    muzzle.y -= 0.25;
    this.effects.burst(muzzle, 0xffe9a0, 5, { life: 0.12, spread: 1.5, size: 0.8 });
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.tracerLife = 0.08;
    if (hitRecord) {
      this.effects.burst(hitRecord.point, 0xffc040, 8, { life: 0.35, spread: 4, gravity: 8 });
    }
    return hitRecord;
  }

  // Punch whatever is close and in front of the player.
  punch(playerPos, playerHeading, targets) {
    this.sound.punch();
    const fx = Math.sin(playerHeading);
    const fz = Math.cos(playerHeading);
    for (const t of targets) {
      const dx = t.x - playerPos.x;
      const dz = t.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > COMBAT_TUNING.punchRange) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.3) continue;
      return t;
    }
    return null;
  }
}
