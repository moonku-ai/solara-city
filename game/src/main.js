// Solara City — bootstrap and game loop. Wires the city, the player, cars,
// traffic, police, missions, combat, HUD and sound together, runs the state
// machine (title → playing → paused → busted/wasted) and the four staging
// modes used for screenshots (?shot=start|play|chase|mission).

import * as THREE from 'three';
import { WORLD, PALETTE, PLAYER_TUNING, CAR_TUNING, SAVE_KEY } from './config.js';
import { Rng } from './rng.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Effects } from './effects.js';
import { buildCity, pushOutOfBuildings, clampToWorld, randomRoadPoint, LANDMARKS } from './city.js';
import { Player } from './player.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police, PoliceCar } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { GameState } from './state.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot') || '';
const seed = Number(params.get('seed') || '1') || 1;
const rng = new Rng(seed);

// ---------- Renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 260, 700);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 40, 140);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.25);
scene.add(hemi);
// A soft ambient fill so faces turned away from the sun never fall to black.
scene.add(new THREE.AmbientLight(0x93a7bd, 0.7));
const sun = new THREE.DirectionalLight(0xffe0b3, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 420;
scene.add(sun);
scene.add(sun.target);

// ---------- Systems ----------
const input = new Input(canvas);
const sound = new SoundBank();
const effects = new Effects(scene);
const city = buildCity(scene, rng);
const state = new GameState();
const saved = state.load();
const hud = new Hud();
hud.setBuildings(city.colliders);

const player = new Player(scene, state.playerX, state.playerZ, state.playerHeading);
const traffic = new Traffic(scene, rng, city);
const police = new Police(scene, rng, city);
const missions = new Missions(scene);
const combat = new Combat(scene, camera, effects, sound);

// Parked cars along the streets, free for the taking.
const parkedCars = [];
for (let i = 0; i < 9; i++) {
  const spot = randomRoadPoint(rng);
  const car = new Car(scene, rng.pick(PALETTE.carColors), rng.pick(['sedan', 'sedan', 'truck']), spot.x, spot.z, spot.heading);
  car.group.userData.hit = { kind: 'car', ref: car };
  parkedCars.push(car);
}
// Mark traffic and police as shootable.
for (const t of traffic.cars) t.car.group.userData.hit = { kind: 'traffic', ref: t };
for (const p of traffic.peds) p.group.userData.hit = { kind: 'ped', ref: p };

// ---------- Game state ----------
let mode = 'title';
let driving = false;
let currentCar = null;
let timeNow = 0;
let clockMinutes = 17 * 60 + 30;
let lastDamageAt = -100;
let shakeTime = 0;
let mapTimer = 0;
let smokeTimer = 0;
let endKind = '';

function damagePlayer(amount, cause) {
  state.health = Math.max(0, state.health - amount);
  lastDamageAt = timeNow;
  shakeTime = Math.max(shakeTime, 0.25);
  if (cause) hud.feed(cause);
}

function respawn() {
  police.clearWanted();
  police.arrestProgress = 0;
  state.health = PLAYER_TUNING.maxHealth;
  if (driving) exitCar();
  player.x = LANDMARKS.start.x;
  player.z = LANDMARKS.start.z;
  player.heading = LANDMARKS.start.heading;
  player.camYaw = LANDMARKS.start.heading;
  player.group.position.set(player.x, 0, player.z);
  player.group.visible = true;
}

function endGame(kind, title, sub, color) {
  endKind = kind;
  mode = 'ended';
  input.releasePointer();
  sound.setEngine(0, false);
  sound.setSiren(false, 0);
  hud.showEnd(title, sub, color);
}

function applyMissionStart() {
  const def = missions.current;
  if (!def) return;
  if (def.wantedOnStart) police.setWanted(def.wantedOnStart, timeNow);
  hud.setObjective(missions.objectiveText());
  hud.toast(def.title, 4);
  hud.feed(def.briefing);
}

missions.onEvent = (type, text, reward, title) => {
  if (type === 'stage') {
    sound.pickup();
    hud.feed(text);
    hud.toast('Sari is with you!', 3);
    hud.setObjective(missions.objectiveText());
    return;
  }
  if (type === 'complete' || type === 'all-done') {
    state.money += reward || 0;
    state.missionsDone += 1;
    state.missionIndex = missions.index;
    if (type === 'all-done') state.storyDone = true;
    sound.chime();
    hud.toast(text, 4);
    hud.feed(text);
    state.save();
    if (type === 'complete') applyMissionStart();
    else hud.setObjective('');
  }
};

function startGame(fromSave) {
  sound.unlock();
  sound.startMusic();
  hud.hideStart();
  hud.hideEnd();
  hud.showHud(true);
  if (!fromSave) {
    state.money = 0;
    state.health = PLAYER_TUNING.maxHealth;
    state.missionIndex = 0;
    state.missionsDone = 0;
    state.storyDone = false;
    state.playerX = LANDMARKS.start.x;
    state.playerZ = LANDMARKS.start.z;
    state.playerHeading = LANDMARKS.start.heading;
    player.x = state.playerX;
    player.z = state.playerZ;
    player.heading = state.playerHeading;
    player.camYaw = state.playerHeading;
    player.group.position.set(player.x, 0, player.z);
  }
  missions.start(state.storyDone ? 99 : state.missionIndex);
  if (!missions.finishedAll) applyMissionStart();
  else hud.setObjective('');
  mode = 'playing';
  hud.setMoney(state.money);
  hud.setHealth(state.health, PLAYER_TUNING.maxHealth);
}

function enterCar(car, kind) {
  driving = true;
  currentCar = car;
  player.group.visible = false;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  if (kind === 'traffic') {
    police.addWanted(1, timeNow);
    hud.feed('You stole a car! The police are on to you.');
    hud.toast('STOLEN CAR — wanted level up!', 3);
    sound.denied();
  } else if (kind === 'police') {
    police.addWanted(2, timeNow);
    hud.feed('You stole a police car! Big mistake… or big fun.');
    hud.toast('POLICE CAR STOLEN — wanted level up!', 3);
  } else {
    hud.feed('You took a parked car.');
  }
  hud.setHint('');
}

function exitCar() {
  if (!currentCar) return;
  const h = currentCar.heading;
  const px = currentCar.x + Math.cos(h) * 2.8;
  const pz = currentCar.z - Math.sin(h) * 2.8;
  const fixed = pushOutOfBuildings(px, pz, PLAYER_TUNING.radius, city.colliders);
  const clamped = clampToWorld(fixed.x, fixed.z);
  player.x = clamped.x;
  player.z = clamped.z;
  player.heading = h;
  player.group.position.set(player.x, 0, player.z);
  player.group.visible = true;
  parkedCars.push(currentCar);
  currentCar = null;
  driving = false;
}

function nearestEnterableCar() {
  let best = null;
  let bestD = 4.6;
  const consider = (car, kind) => {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { bestD = d; best = { car, kind }; }
  };
  for (const t of traffic.cars) consider(t.car, 'traffic');
  for (const c of parkedCars) consider(c, 'parked');
  for (const c of police.cars) consider(c, 'police');
  return best;
}

function shootTargets() {
  const list = [];
  for (const p of traffic.peds) if (!p.fallen && p.group.visible) list.push(p.group);
  for (const c of police.cops) if (!c.fallen) list.push(c.group);
  for (const t of traffic.cars) list.push(t.car.group);
  for (const c of police.cars) list.push(c.group);
  for (const c of parkedCars) list.push(c.group);
  return list;
}

function tryEnterExitCar() {
  if (driving) {
    exitCar();
    return;
  }
  const found = nearestEnterableCar();
  if (!found) return;
  if (found.kind === 'traffic') {
    const tc = traffic.cars.find((t) => t.car === found.car);
    if (tc) traffic.removeCar(tc);
  } else if (found.kind === 'parked') {
    const i = parkedCars.indexOf(found.car);
    if (i >= 0) parkedCars.splice(i, 1);
  } else {
    const i = police.cars.indexOf(found.car);
    if (i >= 0) police.cars.splice(i, 1);
  }
  enterCar(found.car, found.kind);
}

function handleShot(hit) {
  if (!hit || hit === 'busy' || hit === 'empty') return;
  if (hit.kind === 'ped') {
    hit.ref.knockDown();
    police.addWanted(1, timeNow);
    hud.feed('You shot a pedestrian! Wanted level up.');
    effects.burst(hit.point, 0xd21f1f, 10, { life: 0.5, spread: 3 });
  } else if (hit.kind === 'cop') {
    hit.ref.knockDown();
    police.addWanted(2, timeNow);
    hud.feed('You shot an officer! Wanted level up.');
    effects.burst(hit.point, 0xd21f1f, 10, { life: 0.5, spread: 3 });
  } else if (hit.kind === 'copcar' || hit.kind === 'traffic' || hit.kind === 'car') {
    hud.feed('Your shot sparked off the car.');
  }
}

function handlePunch() {
  const near = [];
  for (const p of traffic.peds) {
    if (!p.fallen) near.push({ x: p.x, z: p.z, kind: 'ped', ref: p });
  }
  for (const c of police.cops) {
    if (!c.fallen) near.push({ x: c.x, z: c.z, kind: 'cop', ref: c });
  }
  const hit = combat.punch({ x: player.x, z: player.z }, player.heading, near);
  if (!hit) return;
  hit.ref.knockDown();
  effects.burst(new THREE.Vector3(hit.x, 1.2, hit.z), 0xffe9a0, 8, { life: 0.4, spread: 3 });
  if (hit.kind === 'ped') {
    police.addWanted(1, timeNow);
    hud.feed('You knocked a pedestrian down!');
  } else {
    police.addWanted(2, timeNow);
    hud.feed('You knocked an officer down!');
  }
}

// ---------- Shot staging ----------
function applyShotMode() {
  if (shotMode === 'start') {
    hud.showStart(false);
    return;
  }
  if (shotMode === 'play') {
    startGame(false);
    return;
  }
  if (shotMode === 'chase') {
    startGame(false);
    const car = new Car(scene, 0xd23c2e, 'sedan', 0, -60, 0);
    car.group.userData.hit = { kind: 'car', ref: car };
    car.speed = 22;
    enterCar(car, 'parked');
    police.setWanted(3, timeNow);
    // Two patrol cars already in frame ahead of Raka, facing him head-on,
    // so the chase reads at a glance instead of only on the minimap.
    const lead1 = new PoliceCar(scene, 3, -28, Math.PI);
    lead1.speed = 20;
    police.cars.push(lead1);
    const lead2 = new PoliceCar(scene, -3, -14, Math.PI);
    lead2.speed = 18;
    police.cars.push(lead2);
    hud.feed('Mira: "Lose them, Raka!"');
    return;
  }
  if (shotMode === 'mission') {
    startGame(false);
    // Stand Raka on the beach road, facing the yellow beacon at the
    // Surfside Cafe, so the mission target is in frame with the HUD objective.
    player.x = 100;
    player.z = 180;
    player.heading = Math.atan2(LANDMARKS.cafe.x - 100, LANDMARKS.cafe.z - 180);
    player.camYaw = player.heading;
    player.group.position.set(player.x, 0, player.z);
    player.group.rotation.y = player.heading;
    return;
  }
  hud.showStart(state.hasSave());
}

// ---------- UI wiring ----------
document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', () => {
  mode = 'playing';
  hud.showPause(false);
});
document.getElementById('restartBtn').addEventListener('click', () => {
  state.clear();
  hud.showPause(false);
  respawn();
  startGame(false);
});
document.getElementById('quitBtn').addEventListener('click', () => {
  state.playerX = player.x;
  state.playerZ = player.z;
  state.playerHeading = player.heading;
  state.missionIndex = missions.index;
  state.save();
  hud.showPause(false);
  hud.showHud(false);
  mode = 'title';
  hud.showStart(true);
});
document.getElementById('againBtn').addEventListener('click', () => {
  hud.hideEnd();
  respawn();
  mode = 'playing';
  hud.setHealth(state.health, PLAYER_TUNING.maxHealth);
  hud.setMoney(state.money);
});
document.getElementById('titleBtn').addEventListener('click', () => {
  state.playerX = player.x;
  state.playerZ = player.z;
  state.playerHeading = player.heading;
  state.save();
  hud.hideEnd();
  hud.showHud(false);
  mode = 'title';
  hud.showStart(true);
});
document.getElementById('startMenu').addEventListener('click', (event) => {
  if (mode === 'title' && event.target.id === 'startMenu') startGame(false);
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && mode === 'title') startGame(false);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Main loop ----------
const clock = new THREE.Clock();
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  timeNow += dt;
  const t = timeNow;

  if (mode === 'title') {
    // Cinematic orbit over the living city behind the title screen.
    const a = t * 0.05;
    camera.position.set(Math.sin(a) * 150, 52, Math.cos(a) * 150);
    camera.lookAt(0, 8, 20);
    traffic.update(dt, { x: 0, z: 0 }, 0, city.colliders, null);
    city.update(dt, t);
    effects.update(dt);
    missions.animate(dt, t);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      document.getElementById('loading').classList.add('hidden');
    }
    return;
  }

  if (mode === 'paused') {
    renderer.render(scene, camera);
    return;
  }

  if (mode === 'ended') {
    city.update(dt, t);
    effects.update(dt);
    renderer.render(scene, camera);
    return;
  }

  // ----- playing -----
  clockMinutes += dt * 0.4;
  const hours = Math.floor(clockMinutes / 60) % 24;
  const minutes = Math.floor(clockMinutes % 60);

  if (input.wasPressed('KeyP')) {
    mode = 'paused';
    hud.showPause(true);
    input.releasePointer();
  }
  if (input.wasPressed('KeyM')) hud.toggleBigMap(!hud.bigMapVisible());
  if (input.wasPressed('KeyN')) {
    const muted = sound.toggleMute();
    hud.feed(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('KeyR') && !driving) combat.reload();
  if (input.wasPressed('KeyF') && !driving) handlePunch();
  if (input.wasPressed('KeyE')) tryEnterExitCar();

  // Health regen after a quiet spell.
  if (state.health > 0 && state.health < PLAYER_TUNING.maxHealth && t - lastDamageAt > 8) {
    state.health = Math.min(PLAYER_TUNING.maxHealth, state.health + 4 * dt);
  }

  if (driving && currentCar) {
    currentCar.drive(dt, input, city.colliders, [...traffic.cars.map((c) => c.car), ...parkedCars, ...police.cars], effects, (speed) => {
      damagePlayer(Math.min(22, (speed - 9) * 1.1), 'You crashed!');
      sound.crash();
    });
    player.x = currentCar.x;
    player.z = currentCar.z;
    player.heading = currentCar.heading;
    // Exhaust smoke.
    smokeTimer -= dt;
    if (smokeTimer <= 0 && Math.abs(currentCar.speed) > 5) {
      smokeTimer = 0.06;
      const bx = currentCar.x - Math.sin(currentCar.heading) * 2.3;
      const bz = currentCar.z - Math.cos(currentCar.heading) * 2.3;
      effects.smoke(new THREE.Vector3(bx, 0.5, bz));
    }
    // Running over pedestrians.
    for (const ped of traffic.peds) {
      if (ped.fallen) continue;
      if (Math.hypot(ped.x - currentCar.x, ped.z - currentCar.z) < 2.4 && Math.abs(currentCar.speed) > 6) {
        ped.knockDown();
        police.addWanted(1, t);
        damagePlayer(2, 'You hit a pedestrian!');
        sound.punch();
        hud.feed('You ran over a pedestrian! Wanted level up.');
      }
    }
    player.update(dt, input, city.colliders, camera, true, currentCar.heading, effects);
  } else {
    player.update(dt, input, city.colliders, camera, false, 0, effects);
    if (input.takeClick()) {
      const hit = combat.shoot(shootTargets());
      handleShot(hit);
    }
  }

  traffic.update(dt, { x: player.x, z: player.z }, driving ? Math.abs(currentCar?.speed || 0) : (player.moving ? 6 : 0), city.colliders, currentCar);
  police.update(dt, t, { x: player.x, z: player.z }, driving, currentCar, city.colliders,
    (progress) => {
      if (progress > 0.15) hud.setHint(`OFFICER IS ARRESTING YOU — ${Math.ceil((1 - progress) * 2.2)}s`);
      if (progress >= 1) {
        state.money = Math.max(0, state.money - 100);
        endGame('busted', 'BUSTED', 'The Solara Police caught you. $100 fine — better luck next time, Raka.', '#4a90ff');
      }
    },
    () => {
      damagePlayer(8, 'An officer hit you!');
      sound.punch();
    });

  missions.update(dt, { x: player.x, z: player.z }, t);
  missions.animate(dt, t);
  combat.update(dt);
  effects.update(dt);
  city.update(dt, t);

  // Sun follows the player so shadows stay crisp nearby.
  sun.position.set(player.x + WORLD.sunDir.x * 160, 120, player.z + WORLD.sunDir.z * 160);
  sun.target.position.set(player.x, 0, player.z);

  // Sound.
  const nearestPolice = police.nearestPoliceDistance();
  sound.setEngine(driving ? Math.abs(currentCar?.speed || 0) / CAR_TUNING.maxSpeed : 0, driving);
  sound.setSiren(police.stars > 0, Math.max(0, 1 - nearestPolice / 90));

  // Camera shake after a hit.
  if (shakeTime > 0) {
    shakeTime -= dt;
    camera.position.x += (Math.random() - 0.5) * 0.35 * shakeTime;
    camera.position.y += (Math.random() - 0.5) * 0.3 * shakeTime;
  }

  // HUD.
  hud.setMoney(state.money);
  hud.setStars(police.stars);
  hud.setClock(hours, minutes);
  hud.setHealth(state.health, PLAYER_TUNING.maxHealth);
  hud.setSpeed(driving ? Math.abs(currentCar?.speed || 0) * 3.6 : 0, driving);
  hud.setAmmo(combat.ammo, combat.reserve, combat.reloading());
  hud.setCrosshair(!driving);
  hud.tickToast(dt);
  if (police.arrestProgress <= 0.15) {
    if (!driving) {
      const near = nearestEnterableCar();
      hud.setHint(near ? (near.kind === 'traffic' ? 'Press E — steal this car' : near.kind === 'police' ? 'Press E — steal the police car?!' : 'Press E — drive this car') : '');
    } else {
      hud.setHint('E — get out • Space — handbrake');
    }
  }
  mapTimer -= dt;
  if (mapTimer <= 0) {
    mapTimer = 0.12;
    hud.updateMinimap({
      player: { x: player.x, z: player.z, heading: player.heading },
      trafficCars: traffic.cars.map((c) => ({ x: c.car.x, z: c.car.z, color: `#${c.car.color.toString(16).padStart(6, '0')}` })),
      policeCars: police.cars.map((c) => ({ x: c.x, z: c.z })),
      cops: police.cops.filter((c) => !c.fallen).map((c) => ({ x: c.x, z: c.z })),
      peds: traffic.peds.filter((p) => !p.fallen && p.group.visible).map((p) => ({ x: p.x, z: p.z })),
      marker: missions.markerPos(),
    }, t);
  }

  if (state.health <= 0 && mode === 'playing') {
    state.money = Math.max(0, state.money - 100);
    endGame('wasted', 'WASTED', 'Raka got taken down. $100 hospital bill — the city is still waiting.', '#ff4040');
  }

  renderer.render(scene, camera);
  input.endFrame();
  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('hidden');
  }
}

applyShotMode();
animate();
