# solara-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/moonku-ai/solara-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/moonku-ai/solara-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara City** is an open-world crime game in the spirit of GTA 6, built for
make.fun's "Make GTA 6" bounty. Raka is a courier in Solara City, a sunny
coastal town where the palm trees sway and the police never sleep. Explore the
city on foot and by car, steal cars, outrun the law, take on missions — and
try not to get busted.

## What is in the game

- A living city: grid streets, plaza fountain, beach and ocean, traffic and
  pedestrians, palms and streetlights, all procedural from one seed.
- On foot and by car: steal any parked car, drive with a handbrake, crash
  into things (and pay for it).
- Wanted level 0–5 with police cars and foot officers who chase, ram and
  arrest you.
- A 3-mission story (deliveries, a pickup, a beach party) with a mission
  objective banner, toast and radio chatter from Mira.
- Combat: pistol with reload, punching, health and a hospital bill when you
  go down.
- Full HUD: money, wanted stars, clock, health, speedometer, ammo, live
  minimap (press **M** for the big map) and crosshair.
- Start screen, pause menu, save game in localStorage, original WebAudio
  music and sound effects. No real brands, no real city, no Rockstar assets.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Or serve `game/` with any
static file server — the game is plain files under `game/` with no build step
and no network requests. `three.js` is vendored under
`game/vendor/three/three.module.min.js`.

Controls: **WASD** move / drive · **Mouse** look & aim · **Click** shoot ·
**Shift** sprint · **E** steal / enter / exit car · **Space** handbrake ·
**F** punch · **R** reload · **P** pause · **M** map · **N** mute.

## Screenshots

Staged with `?shot=start|play|chase|mission` (see `shots.json`): the title
screen, free roam, a 3-star police chase, and a mission in progress.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
