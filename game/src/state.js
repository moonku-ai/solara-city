// Save game in localStorage: cash, story progress, health and where Raka
// stands. Nothing else persists — the city itself is rebuilt from the seed.

import { SAVE_KEY } from './config.js';

export class GameState {
  constructor() {
    this.money = 0;
    this.health = 100;
    this.missionIndex = 0;
    this.missionsDone = 0;
    this.playerX = 8;
    this.playerZ = 26;
    this.playerHeading = Math.PI;
    this.storyDone = false;
  }

  save() {
    try {
      const data = {
        money: this.money,
        health: this.health,
        missionIndex: this.missionIndex,
        missionsDone: this.missionsDone,
        playerX: this.playerX,
        playerZ: this.playerZ,
        playerHeading: this.playerHeading,
        storyDone: this.storyDone,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.money !== 'number') return null;
      this.money = data.money;
      this.health = data.health ?? 100;
      this.missionIndex = data.missionIndex ?? 0;
      this.missionsDone = data.missionsDone ?? 0;
      this.playerX = data.playerX ?? 8;
      this.playerZ = data.playerZ ?? 26;
      this.playerHeading = data.playerHeading ?? Math.PI;
      this.storyDone = !!data.storyDone;
      return data;
    } catch {
      return null;
    }
  }

  hasSave() {
    try {
      return !!window.localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  clear() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch { /* storage unavailable — play on without saving */ }
  }
}
