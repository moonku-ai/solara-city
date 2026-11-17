// Raka's story in three jobs from Mira at Solara Courier Co. Each mission
// has a briefing, a glowing beacon in the world, an objective line on the
// HUD and a cash reward. Finishing all three opens free roam.

import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { MISSION_REWARDS } from './config.js';

const MISSION_DEFS = [
  {
    id: 'first-delivery',
    title: 'MISSION 1 — FIRST DELIVERY',
    briefing: 'Mira: "Raka, first job. A parcel for the Surfside Cafe, south end of town. ' +
      'Follow the yellow beacon — and try not to scratch the paint."',
    objective: 'Deliver the parcel to Surfside Cafe',
    target: LANDMARKS.cafe,
    radius: 7,
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'beach-run',
    title: 'MISSION 2 — BEACH RUN',
    briefing: 'Mira: "The parcel was evidence, Raka. The police want a word. ' +
      'Lose them and get to the old pier house — do NOT get busted."',
    objective: 'Escape the police — reach the old pier house',
    target: LANDMARKS.pierHouse,
    radius: 7,
    reward: MISSION_REWARDS[1],
    wantedOnStart: 3,
  },
  {
    id: 'pickup-sari',
    title: 'MISSION 3 — PICKUP SARI',
    briefing: 'Mira: "Last one. My friend Sari is waiting at Solara Plaza. Pick her up ' +
      'and take her to the beach party — and Raka? Drive like a gentleman."',
    objective: 'Pick up Sari at Solara Plaza',
    target: LANDMARKS.plaza,
    radius: 6,
    reward: MISSION_REWARDS[2],
    twoStage: true,
  },
];

function makeBeacon() {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 21;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xcc9900, emissiveIntensity: 0.8, roughness: 0.2 }),
  );
  gem.position.y = 6;
  group.add(gem);
  return { group, pillar, ring, gem };
}

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.active = false;
    this.stage = 0;
    this.done = false;
    this.beacon = makeBeacon();
    this.beacon.group.visible = false;
    scene.add(this.beacon.group);
    this.onEvent = null;
  }

  get current() {
    return MISSION_DEFS[this.index] ?? null;
  }

  get finishedAll() {
    return this.index >= MISSION_DEFS.length;
  }

  start(index = 0) {
    this.index = index;
    this.stage = 0;
    this.done = this.finishedAll;
    this.active = !this.done;
    if (this.active) this.placeBeacon();
    else this.beacon.group.visible = false;
    return this.current;
  }

  placeBeacon() {
    const def = this.current;
    if (!def) return;
    const target = this.stage === 1 ? LANDMARKS.beachParty : def.target;
    this.beacon.group.position.set(target.x, 0, target.z);
    this.beacon.group.visible = true;
  }

  objectiveText() {
    if (!this.active || !this.current) return '';
    if (this.current.twoStage && this.stage === 1) return 'Take Sari to the beach party';
    return this.current.objective;
  }

  markerPos() {
    if (!this.active || !this.current) return null;
    return this.stage === 1 ? LANDMARKS.beachParty : this.current.target;
  }

  // Returns 'stage', 'complete', 'all-done' or null.
  update(dt, playerPos, timeNow) {
    if (!this.active || !this.current) return null;
    const target = this.stage === 1 ? LANDMARKS.beachParty : this.current.target;
    const dist = Math.hypot(playerPos.x - target.x, playerPos.z - target.z);
    if (dist > this.current.radius) return null;

    if (this.current.twoStage && this.stage === 0) {
      this.stage = 1;
      this.placeBeacon();
      this.onEvent?.('stage', 'Sari hops in! Now drive her to the beach party.');
      return 'stage';
    }
    const reward = this.current.reward;
    const title = this.current.title;
    this.index += 1;
    this.stage = 0;
    if (this.index >= MISSION_DEFS.length) {
      this.active = false;
      this.done = true;
      this.beacon.group.visible = false;
      this.onEvent?.('all-done', `Story complete! You earned $${reward}. Solara City is yours — free roam!`, reward, title);
      return 'all-done';
    }
    this.placeBeacon();
    this.onEvent?.('complete', `${title} complete — $${reward} earned!`, reward, title);
    return 'complete';
  }

  animate(dt, t) {
    if (!this.beacon.group.visible) return;
    this.beacon.gem.rotation.y += dt * 2;
    this.beacon.gem.position.y = 6 + Math.sin(t * 2.2) * 0.5;
    const pulse = 1 + Math.sin(t * 3) * 0.12;
    this.beacon.ring.scale.set(pulse, pulse, 1);
  }
}
