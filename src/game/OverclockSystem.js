import { OVERCLOCK } from './constants.js';

export class OverclockSystem {
  constructor() {
    this.active = false;
    this.heat = 0;
    this.timer = 0;
    this.cooldown = 0;
    this.unlocked = false;
    this.level = 0;
  }

  setUpgradeLevel(level) {
    this.level = level;
    if (level > 0) {
      this.unlocked = true;
    }
  }

  getSpeedMultiplier() {
    return OVERCLOCK.BASE_SPEED_MULTIPLIER + this.level * 0.1;
  }

  getDrillMultiplier() {
    return OVERCLOCK.BASE_DRILL_MULTIPLIER + this.level * 0.2;
  }

  getHeatMultiplier() {
    return Math.max(1.0, OVERCLOCK.BASE_HEAT_MULTIPLIER - this.level * 0.2);
  }

  getFuelMultiplier() {
    return Math.max(1.0, OVERCLOCK.BASE_FUEL_MULTIPLIER - this.level * 0.15);
  }

  getHeatRate() {
    return Math.max(2.0, OVERCLOCK.HEAT_PER_SECOND - this.level * 0.8);
  }

  canActivate(currentFuel) {
    if (!this.unlocked) return false;
    if (this.active) return false;
    if (this.cooldown > 0) return false;
    if (currentFuel < OVERCLOCK.MINIMUM_ACTIVATION_FUEL) return false;
    return true;
  }

  activate() {
    if (!this.canActivate(Infinity)) return false;
    this.active = true;
    this.timer = OVERCLOCK.MAX_DURATION;
    this.heat = 0;
    return true;
  }

  deactivate(forced = false) {
    if (!this.active) return;
    this.active = false;
    this.timer = 0;
    if (forced) {
      this.cooldown = OVERCLOCK.COOLDOWN_DURATION;
    } else {
      this.cooldown = OVERCLOCK.COOLDOWN_DURATION * (this.heat / OVERCLOCK.MAX_HEAT);
    }
    this.heat = 0;
  }

  update(dt, currentFuel) {
    if (this.active) {
      this.timer -= dt;
      this.heat += this.getHeatRate() * dt;

      if (this.timer <= 0) {
        this.deactivate(false);
        return { stopped: true, forced: false };
      } else if (this.heat >= OVERCLOCK.MAX_HEAT) {
        this.heat = OVERCLOCK.MAX_HEAT;
        this.deactivate(true);
        return { stopped: true, forced: true };
      }

      if (currentFuel <= 0) {
        this.deactivate(true);
        return { stopped: true, forced: true };
      }
    }

    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    return { stopped: false, forced: false };
  }

  getEffectiveSpeed(baseSpeed) {
    return this.active ? baseSpeed * this.getSpeedMultiplier() : baseSpeed;
  }

  getEffectiveDrillPower(baseDrillPower) {
    return this.active ? baseDrillPower * this.getDrillMultiplier() : baseDrillPower;
  }

  getEffectiveFuelConsumption(baseFuelConsumption) {
    return this.active ? baseFuelConsumption * this.getFuelMultiplier() : baseFuelConsumption;
  }

  getEffectiveHeatGeneration(baseHeatGeneration) {
    return this.active ? baseHeatGeneration * this.getHeatMultiplier() : baseHeatGeneration;
  }
}
