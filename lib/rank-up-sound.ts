/**
 * Rank-up celebration sound — Web Audio API synthesis, no audio file assets.
 * Two sine oscillators: a bright "ding" (~880Hz) and a low "bass" (~110Hz),
 * both with a short exponential decay envelope.
 *
 * Wrapped in try/catch: browsers block AudioContext creation before a user
 * gesture has occurred on the page, and some environments (SSR, older
 * Safari) may not expose the API at all. Either failure mode is silently
 * swallowed — the visual celebration continues regardless of whether sound
 * plays.
 */

export function playRankUpSound(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    const playTone = (freq: number, startAt: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      gainNode.gain.setValueAtTime(gain, ctx.currentTime + startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    // Bass first (grounds the sound), ding shortly after (bright accent).
    playTone(110, 0, 0.6, 0.15);
    playTone(880, 0.05, 0.5, 0.12);

    // Best-effort cleanup — AudioContext GC isn't guaranteed otherwise.
    setTimeout(() => { void ctx.close().catch(() => {}); }, 1200);
  } catch {
    // AudioContext blocked (no user gesture yet) or unavailable — silent no-op.
  }
}
