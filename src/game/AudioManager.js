export class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.activeLoops = new Map();
  }

  ensureContext() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
    return this.audioCtx;
  }

  playTone({
    type = 'sine',
    startFreq = 440,
    endFreq = null,
    duration = 0.3,
    startGain = 0.2,
    endGain = 0.001,
    gainRampType = 'exponential',
    freqRampType = 'exponential'
  } = {}) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
    if (endFreq !== null) {
      if (freqRampType === 'exponential') {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 0.01), ctx.currentTime + duration);
      } else {
        oscillator.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
      }
    }

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(startGain, ctx.currentTime + 0.01);
    if (gainRampType === 'exponential') {
      gainNode.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), ctx.currentTime + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(endGain, ctx.currentTime + duration);
    }

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration + 0.05);
  }

  startLoop(id, {
    type = 'sawtooth',
    baseFreq = 120,
    baseGain = 0.08,
    fadeInTime = 0.2
  } = {}) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.stopLoop(id);

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(baseGain, ctx.currentTime + fadeInTime);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);

    this.activeLoops.set(id, { oscillator, gainNode, baseFreq, baseGain });
  }

  updateLoop(id, { freq = null, gain = null } = {}) {
    const loop = this.activeLoops.get(id);
    if (!loop) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (freq !== null) {
      loop.oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    }
    if (gain !== null) {
      loop.gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    }
  }

  stopLoop(id, fadeOutTime = 0.15) {
    const loop = this.activeLoops.get(id);
    if (!loop) return;

    const ctx = this.ensureContext();
    try {
      if (ctx) {
        loop.gainNode.gain.setValueAtTime(loop.gainNode.gain.value, ctx.currentTime);
        loop.gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + fadeOutTime);
        loop.oscillator.stop(ctx.currentTime + fadeOutTime + 0.05);
      } else {
        loop.oscillator.stop();
      }
    } catch (e) {
    }

    this.activeLoops.delete(id);
  }

  stopAllLoops(fadeOutTime = 0.15) {
    for (const id of this.activeLoops.keys()) {
      this.stopLoop(id, fadeOutTime);
    }
  }

  playOverclockStart() {
    this.playTone({
      type: 'sawtooth',
      startFreq: 200,
      endFreq: 800,
      duration: 0.4,
      startGain: 0.2
    });
  }

  playOverclockStop(forced = false) {
    this.playTone({
      type: forced ? 'square' : 'sine',
      startFreq: forced ? 600 : 400,
      endFreq: 100,
      duration: 0.5,
      startGain: 0.2
    });
  }

  startOverclockLoop() {
    this.startLoop('overclock', {
      type: 'sawtooth',
      baseFreq: 120,
      baseGain: 0.08
    });
  }

  updateOverclockLoop(heatRatio) {
    const freq = 120 + heatRatio * 80;
    const gain = 0.08 + heatRatio * 0.05;
    this.updateLoop('overclock', { freq, gain });
  }

  stopOverclockLoop() {
    this.stopLoop('overclock', 0.15);
  }
}
