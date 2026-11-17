// Lightweight particle pool: small glowing boxes reused for exhaust smoke,
// crash sparks, muzzle flashes and running dust. Nothing is allocated while
// the game runs — dead particles are recycled.

import * as THREE from 'three';

const MAX_PARTICLES = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1, grow: 0, gravity: 0 });
    }
    this.cursor = 0;
  }

  spawn(pos, opts) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.set(opts.color ?? 0xffffff);
    p.mesh.material.opacity = opts.opacity ?? 0.9;
    p.mesh.scale.setScalar(opts.size ?? 1);
    p.vel.set(
      (opts.vx ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 1),
      (opts.vy ?? 1) + (Math.random() - 0.5) * (opts.spread ?? 1),
      (opts.vz ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 1),
    );
    p.life = 0;
    p.maxLife = opts.life ?? 0.7;
    p.grow = opts.grow ?? 0;
    p.gravity = opts.gravity ?? 0;
  }

  burst(pos, color, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn(pos, { color, ...opts, spread: opts.spread ?? 6 });
    }
  }

  smoke(pos) {
    this.spawn(pos, { color: 0x8a8f94, size: 0.9, life: 0.9, vy: 1.4, spread: 0.6, opacity: 0.45, grow: 1.6 });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.maxLife;
      p.mesh.material.opacity = 0.9 * k;
      if (p.grow) p.mesh.scale.addScalar(p.grow * dt);
    }
  }
}
