import { describe, it, expect, beforeEach } from 'vitest';
import { OverclockSystem } from '../src/game/OverclockSystem.js';
import { OVERCLOCK } from '../src/game/constants.js';

describe('OverclockSystem', () => {
  let oc;

  beforeEach(() => {
    oc = new OverclockSystem();
  });

  describe('初始化', () => {
    it('初始状态应该是非活动、无热量、无计时、无冷却、未解锁', () => {
      expect(oc.active).toBe(false);
      expect(oc.heat).toBe(0);
      expect(oc.timer).toBe(0);
      expect(oc.cooldown).toBe(0);
      expect(oc.unlocked).toBe(false);
      expect(oc.level).toBe(0);
    });

    it('零级时所有倍率应该为1（无加成）', () => {
      expect(oc.getSpeedMultiplier()).toBe(OVERCLOCK.BASE_SPEED_MULTIPLIER);
      expect(oc.getDrillMultiplier()).toBe(OVERCLOCK.BASE_DRILL_MULTIPLIER);
      expect(oc.getFuelMultiplier()).toBe(OVERCLOCK.BASE_FUEL_MULTIPLIER);
      expect(oc.getHeatMultiplier()).toBe(OVERCLOCK.BASE_HEAT_MULTIPLIER);
      expect(oc.getHeatRate()).toBe(OVERCLOCK.HEAT_PER_SECOND);
    });
  });

  describe('升级等级', () => {
    it('setUpgradeLevel(0) 不解锁', () => {
      oc.setUpgradeLevel(0);
      expect(oc.unlocked).toBe(false);
      expect(oc.level).toBe(0);
    });

    it('setUpgradeLevel(1) 解锁超频', () => {
      oc.setUpgradeLevel(1);
      expect(oc.unlocked).toBe(true);
      expect(oc.level).toBe(1);
    });

    it('升级后速度和钻头倍率增加', () => {
      oc.setUpgradeLevel(3);
      expect(oc.getSpeedMultiplier()).toBeCloseTo(OVERCLOCK.BASE_SPEED_MULTIPLIER + 3 * 0.1);
      expect(oc.getDrillMultiplier()).toBeCloseTo(OVERCLOCK.BASE_DRILL_MULTIPLIER + 3 * 0.2);
    });

    it('升级后燃料和热量倍率降低（更高效）', () => {
      const lvl0Fuel = oc.getFuelMultiplier();
      const lvl0Heat = oc.getHeatMultiplier();
      const lvl0Rate = oc.getHeatRate();

      oc.setUpgradeLevel(5);

      expect(oc.getFuelMultiplier()).toBeLessThan(lvl0Fuel);
      expect(oc.getHeatMultiplier()).toBeLessThan(lvl0Heat);
      expect(oc.getHeatRate()).toBeLessThan(lvl0Rate);
    });

    it('燃料倍率不低于1.0', () => {
      oc.setUpgradeLevel(99);
      expect(oc.getFuelMultiplier()).toBeGreaterThanOrEqual(1.0);
    });

    it('热量倍率不低于1.0', () => {
      oc.setUpgradeLevel(99);
      expect(oc.getHeatMultiplier()).toBeGreaterThanOrEqual(1.0);
    });

    it('产热速率不低于2.0', () => {
      oc.setUpgradeLevel(99);
      expect(oc.getHeatRate()).toBeGreaterThanOrEqual(2.0);
    });
  });

  describe('激活条件', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('未解锁时无法激活', () => {
      oc.unlocked = false;
      expect(oc.canActivate(100)).toBe(false);
    });

    it('冷却中无法激活', () => {
      oc.cooldown = 5;
      expect(oc.canActivate(100)).toBe(false);
    });

    it('燃料不足时无法激活', () => {
      expect(oc.canActivate(5)).toBe(false);
    });

    it('燃料刚好等于最低激活要求时可以激活', () => {
      expect(oc.canActivate(OVERCLOCK.MINIMUM_ACTIVATION_FUEL)).toBe(true);
    });

    it('已经激活时无法再次激活', () => {
      oc.activate();
      expect(oc.canActivate(100)).toBe(false);
    });

    it('正常条件下可以激活', () => {
      expect(oc.canActivate(100)).toBe(true);
    });
  });

  describe('激活和停止', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('activate() 成功激活并返回true', () => {
      const result = oc.activate();
      expect(result).toBe(true);
      expect(oc.active).toBe(true);
      expect(oc.timer).toBe(OVERCLOCK.MAX_DURATION);
      expect(oc.heat).toBe(0);
    });

    it('activate() 失败时返回false', () => {
      oc.unlocked = false;
      const result = oc.activate();
      expect(result).toBe(false);
      expect(oc.active).toBe(false);
    });

    it('deactivate(false) 正常停止，冷却时间与热量成正比', () => {
      oc.activate();
      oc.heat = 50;
      oc.deactivate(false);

      expect(oc.active).toBe(false);
      expect(oc.timer).toBe(0);
      expect(oc.heat).toBe(0);
      expect(oc.cooldown).toBeGreaterThan(0);
      expect(oc.cooldown).toBeLessThan(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('deactivate(true) 强制停止，满冷却时间', () => {
      oc.activate();
      oc.deactivate(true);

      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('满热量时正常停止，冷却时间约等于完整冷却', () => {
      oc.activate();
      oc.heat = OVERCLOCK.MAX_HEAT;
      oc.deactivate(false);

      expect(oc.cooldown).toBeCloseTo(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('零热量时正常停止，冷却时间为0', () => {
      oc.activate();
      oc.heat = 0;
      oc.deactivate(false);

      expect(oc.cooldown).toBe(0);
    });

    it('非活动状态下调用 deactivate 不报错', () => {
      expect(() => oc.deactivate(false)).not.toThrow();
      expect(oc.active).toBe(false);
    });
  });

  describe('update - 时间流逝', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('激活后计时器随时间减少', () => {
      oc.activate();
      const startTimer = oc.timer;
      oc.update(1, 100);

      expect(oc.timer).toBeCloseTo(startTimer - 1);
      expect(oc.active).toBe(true);
    });

    it('时间结束后自动停止（非强制）', () => {
      oc.activate();
      const result = oc.update(OVERCLOCK.MAX_DURATION + 0.1, 100);

      expect(result.stopped).toBe(true);
      expect(result.forced).toBe(false);
      expect(oc.active).toBe(false);
    });

    it('时间结束后自动停止（非强制），冷却时间与当前热量成正比', () => {
      oc.activate();
      const result = oc.update(OVERCLOCK.MAX_DURATION + 0.1, 100);

      expect(result.stopped).toBe(true);
      expect(result.forced).toBe(false);
      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBeGreaterThan(0);
      expect(oc.cooldown).toBeLessThan(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('非活动状态下 update 返回 stopped:false', () => {
      const result = oc.update(1, 100);
      expect(result.stopped).toBe(false);
    });

    it('冷却时间随 update 递减', () => {
      oc.cooldown = 10;
      oc.update(3, 100);

      expect(oc.cooldown).toBeCloseTo(7);
    });

    it('冷却时间不会低于0', () => {
      oc.cooldown = 2;
      oc.update(5, 100);

      expect(oc.cooldown).toBe(0);
    });
  });

  describe('update - 热量系统', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('激活时热量随时间增加', () => {
      oc.activate();
      const startHeat = oc.heat;
      oc.update(1, 100);

      expect(oc.heat).toBeGreaterThan(startHeat);
      expect(oc.heat).toBeCloseTo(oc.getHeatRate());
    });

    it('热量达到最大值时强制停止', () => {
      oc.activate();
      oc.heat = OVERCLOCK.MAX_HEAT - 1;
      const result = oc.update(1, 100);

      expect(result.stopped).toBe(true);
      expect(result.forced).toBe(true);
      expect(oc.active).toBe(false);
    });

    it('强制停止后进入完整冷却', () => {
      oc.activate();
      oc.deactivate(true);

      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('热量达到最大值后会停止并重置热量为0', () => {
      oc.activate();
      oc.heat = OVERCLOCK.MAX_HEAT - 1;
      oc.update(1, 100);

      expect(oc.heat).toBe(0);
      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('正常运行时热量随产热率线性增加', () => {
      oc.activate();
      const rate = oc.getHeatRate();
      oc.update(1, 100);

      expect(oc.heat).toBeCloseTo(rate);
    });

    it('升级后热量增加更慢', () => {
      const ocLow = new OverclockSystem();
      ocLow.setUpgradeLevel(1);
      ocLow.activate();
      ocLow.update(1, 100);

      const ocHigh = new OverclockSystem();
      ocHigh.setUpgradeLevel(5);
      ocHigh.activate();
      ocHigh.update(1, 100);

      expect(ocHigh.heat).toBeLessThan(ocLow.heat);
    });
  });

  describe('update - 燃料耗尽', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('燃料耗尽时强制停止', () => {
      oc.activate();
      const result = oc.update(0.1, 0);

      expect(result.stopped).toBe(true);
      expect(result.forced).toBe(true);
      expect(oc.active).toBe(false);
    });

    it('燃料耗尽时进入完整冷却', () => {
      oc.activate();
      oc.update(0.1, 0);

      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
    });

    it('燃料充足时正常运行', () => {
      oc.activate();
      const result = oc.update(1, 50);

      expect(result.stopped).toBe(false);
      expect(oc.active).toBe(true);
    });
  });

  describe('有效属性计算', () => {
    beforeEach(() => {
      oc.setUpgradeLevel(1);
    });

    it('未激活时有效属性等于基础值', () => {
      expect(oc.getEffectiveSpeed(10)).toBe(10);
      expect(oc.getEffectiveDrillPower(5)).toBe(5);
      expect(oc.getEffectiveFuelConsumption(0.03)).toBe(0.03);
      expect(oc.getEffectiveHeatGeneration(0.1)).toBe(0.1);
    });

    it('激活后速度和钻头提升', () => {
      oc.activate();

      expect(oc.getEffectiveSpeed(10)).toBeCloseTo(10 * oc.getSpeedMultiplier());
      expect(oc.getEffectiveDrillPower(5)).toBeCloseTo(5 * oc.getDrillMultiplier());
    });

    it('激活后燃料和热量消耗增加', () => {
      oc.activate();

      expect(oc.getEffectiveFuelConsumption(0.03)).toBeCloseTo(0.03 * oc.getFuelMultiplier());
      expect(oc.getEffectiveHeatGeneration(0.1)).toBeCloseTo(0.1 * oc.getHeatMultiplier());
    });

    it('升级后激活，燃料效率更高（消耗增加更少）', () => {
      const ocLow = new OverclockSystem();
      ocLow.setUpgradeLevel(1);
      ocLow.activate();

      const ocHigh = new OverclockSystem();
      ocHigh.setUpgradeLevel(5);
      ocHigh.activate();

      const baseFuel = 0.03;
      expect(ocHigh.getEffectiveFuelConsumption(baseFuel)).toBeLessThan(
        ocLow.getEffectiveFuelConsumption(baseFuel)
      );
    });
  });

  describe('完整生命周期', () => {
    it('激活 -> 时间到自动停止 -> 等冷却结束 -> 可重新激活', () => {
      oc.setUpgradeLevel(1);

      expect(oc.canActivate(100)).toBe(true);
      oc.activate();
      expect(oc.active).toBe(true);

      oc.update(OVERCLOCK.MAX_DURATION + 0.1, 100);
      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBeGreaterThan(0);

      expect(oc.canActivate(100)).toBe(false);

      oc.update(oc.cooldown + 0.1, 100);
      expect(oc.canActivate(100)).toBe(true);
    });

    it('激活 -> 手动正常停止 -> 冷却后可重新激活', () => {
      oc.setUpgradeLevel(1);

      oc.activate();
      oc.heat = 30;
      oc.deactivate(false);

      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBeGreaterThan(0);
      expect(oc.cooldown).toBeLessThan(OVERCLOCK.COOLDOWN_DURATION);

      oc.update(oc.cooldown + 0.1, 100);
      expect(oc.canActivate(100)).toBe(true);
    });

    it('激活 -> 过热强制停止 -> 冷却中不能激活 -> 冷却后可以激活', () => {
      oc.setUpgradeLevel(1);

      oc.activate();
      oc.heat = OVERCLOCK.MAX_HEAT - 1;
      oc.update(1, 100);

      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
      expect(oc.canActivate(100)).toBe(false);

      oc.update(OVERCLOCK.COOLDOWN_DURATION / 2, 100);
      expect(oc.canActivate(100)).toBe(false);

      oc.update(OVERCLOCK.COOLDOWN_DURATION / 2 + 0.1, 100);
      expect(oc.canActivate(100)).toBe(true);
    });

    it('燃料耗尽强制停止后需要等完整冷却', () => {
      oc.setUpgradeLevel(1);

      oc.activate();
      oc.update(0.1, 0);

      expect(oc.active).toBe(false);
      expect(oc.cooldown).toBe(OVERCLOCK.COOLDOWN_DURATION);
    });
  });
});
