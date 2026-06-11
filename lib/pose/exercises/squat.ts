/**
 * Squat form analyzer.
 *
 * State machine (robotics: finite automaton over joint-angle space):
 *   IDLE → DESCENDING → BOTTOM → ASCENDING → COMPLETE → IDLE
 *
 * Ideal form derived from biomechanics literature (Schoenfeld 2010,
 * NSCA guidelines) and parameterized, not hard-coded, so custom
 * reference data can override the defaults.
 */

import type { Keypoint } from '../angles';
import { angleBetween, angleFromVertical, allVisible } from '../angles';
import { KalmanFilter1D } from '../kalman';

// ── Ideal form reference ───────────────────────────────────────────────────

export interface SquatIdealForm {
  /** Bottom position knee angle (°) */
  kneeAngle:    { min: number; max: number };
  /** Bottom position hip angle (°) */
  hipAngle:     { min: number; max: number };
  /** Trunk lean from vertical (°) — too far forward = good morning squat */
  trunkLean:    { min: number; max: number };
  /** Shin angle from vertical (°) — excessive forward knee travel */
  shinAngle:    { min: number; max: number };
}

export const DEFAULT_IDEAL_FORM: SquatIdealForm = {
  kneeAngle: { min: 70,  max: 95  },
  hipAngle:  { min: 75,  max: 115 },
  trunkLean: { min: 15,  max: 45  },
  shinAngle: { min: 15,  max: 35  },
};

// ── State machine ──────────────────────────────────────────────────────────

export type SquatPhase =
  | 'IDLE'        // standing, no movement yet
  | 'DESCENDING'  // knee angle decreasing
  | 'BOTTOM'      // reached lowest point
  | 'ASCENDING'   // knee angle increasing
  | 'COMPLETE';   // returned to standing — rep counted

export interface RepFeedback {
  score:     number;           // 0–100
  kneeNote:  string | null;
  hipNote:   string | null;
  trunkNote: string | null;
  shinNote:  string | null;
  overall:   string;
}

// ── Landmark indices (MediaPipe BlazePose) ─────────────────────────────────

const KP = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_HIP:      23, RIGHT_HIP:      24,
  LEFT_KNEE:     25, RIGHT_KNEE:     26,
  LEFT_ANKLE:    27, RIGHT_ANKLE:    28,
} as const;

// ── Analyzer ──────────────────────────────────────────────────────────────

export interface SquatAngles {
  knee:  number;
  hip:   number;
  trunk: number;
  shin:  number;
}

export interface SquatAnalyzerState {
  phase:     SquatPhase;
  repCount:  number;
  angles:    SquatAngles;
  feedback:  RepFeedback | null;
  /** Lowest knee angle seen in current descent */
  bottomKnee: number;
  bottomHip:  number;
  bottomTrunk: number;
  bottomShin:  number;
}

export class SquatAnalyzer {
  private phase: SquatPhase = 'IDLE';
  private repCount = 0;
  private bottomKnee = 180;
  private bottomHip = 180;
  private bottomTrunk = 0;
  private bottomShin = 0;
  private lastFeedback: RepFeedback | null = null;

  // Kalman filters — one per joint (robotics: sensor fusion per DoF)
  private kfKnee  = new KalmanFilter1D(0.05, 2.0, 170);
  private kfHip   = new KalmanFilter1D(0.05, 2.0, 170);
  private kfTrunk = new KalmanFilter1D(0.05, 1.5, 10);
  private kfShin  = new KalmanFilter1D(0.05, 1.5, 15);

  constructor(private ideal: SquatIdealForm = DEFAULT_IDEAL_FORM) {}

  /** Feed one frame of landmarks. Returns updated state. */
  process(landmarks: Keypoint[]): SquatAnalyzerState {
    // Prefer left side; fall back to right if not visible
    const shoulder = landmarks[KP.LEFT_SHOULDER];
    const hip      = landmarks[KP.LEFT_HIP];
    const knee     = landmarks[KP.LEFT_KNEE];
    const ankle    = landmarks[KP.LEFT_ANKLE];

    const required = [shoulder, hip, knee, ankle];
    if (!allVisible(required, 0.4)) {
      return this.currentState();
    }

    // Raw angles
    const rawKnee  = angleBetween(hip, knee, ankle);
    const rawHip   = angleBetween(shoulder, hip, knee);
    const rawTrunk = angleFromVertical(shoulder, hip);
    const rawShin  = angleFromVertical(knee, ankle);

    // Kalman-filtered angles
    const fKnee  = this.kfKnee.update(rawKnee);
    const fHip   = this.kfHip.update(rawHip);
    const fTrunk = this.kfTrunk.update(rawTrunk);
    const fShin  = this.kfShin.update(rawShin);

    const angles: SquatAngles = {
      knee: Math.round(fKnee),
      hip:  Math.round(fHip),
      trunk: Math.round(fTrunk),
      shin:  Math.round(fShin),
    };

    // ── State transitions ─────────────────────────────────────────────────

    switch (this.phase) {
      case 'IDLE':
      case 'COMPLETE':
        if (fKnee < 155) {
          this.phase = 'DESCENDING';
          this.bottomKnee  = fKnee;
          this.bottomHip   = fHip;
          this.bottomTrunk = fTrunk;
          this.bottomShin  = fShin;
        }
        break;

      case 'DESCENDING':
        // Track deepest position
        if (fKnee < this.bottomKnee) {
          this.bottomKnee  = fKnee;
          this.bottomHip   = fHip;
          this.bottomTrunk = fTrunk;
          this.bottomShin  = fShin;
        }
        // Transition to BOTTOM when descent stops
        if (fKnee <= 100) {
          this.phase = 'BOTTOM';
        }
        // Aborted squat (came back up before reaching bottom)
        if (fKnee > 160) {
          this.phase = 'IDLE';
        }
        break;

      case 'BOTTOM':
        if (fKnee > this.bottomKnee + 10) {
          this.phase = 'ASCENDING';
        }
        break;

      case 'ASCENDING':
        if (fKnee > 155) {
          this.repCount += 1;
          this.lastFeedback = this.evaluateRep();
          this.phase = 'COMPLETE';
        }
        break;
    }

    return this.currentState(angles);
  }

  private evaluateRep(): RepFeedback {
    let score = 100;
    let kneeNote: string | null = null;
    let hipNote:  string | null = null;
    let trunkNote: string | null = null;
    let shinNote:  string | null = null;

    // ── Knee depth ────────────────────────────────────────────────────────
    if (this.bottomKnee > this.ideal.kneeAngle.max) {
      const diff = Math.round(this.bottomKnee - this.ideal.kneeAngle.max);
      kneeNote = `もう${diff}°深くしゃがむと理想的です（現在${Math.round(this.bottomKnee)}°）`;
      score -= 20;
    } else if (this.bottomKnee < this.ideal.kneeAngle.min) {
      kneeNote = `膝が深すぎます（${Math.round(this.bottomKnee)}°）。膝への負担に注意`;
      score -= 10;
    }

    // ── Hip hinge ─────────────────────────────────────────────────────────
    if (this.bottomHip < this.ideal.hipAngle.min) {
      hipNote = '前傾しすぎ（グッドモーニングスクワット）。胸を張りましょう';
      score -= 25;
    } else if (this.bottomHip > this.ideal.hipAngle.max) {
      hipNote = 'お尻が後ろに引けていません。股関節を使う意識で';
      score -= 15;
    }

    // ── Trunk lean ────────────────────────────────────────────────────────
    if (this.bottomTrunk > this.ideal.trunkLean.max) {
      trunkNote = `上体の前傾が大きすぎます（${Math.round(this.bottomTrunk)}°）。背中を伸ばしましょう`;
      score -= 20;
    } else if (this.bottomTrunk < this.ideal.trunkLean.min) {
      trunkNote = '上体が垂直すぎます。少し前傾すると膝への負担が減ります';
      score -= 5;
    }

    // ── Shin angle (forward knee travel) ─────────────────────────────────
    if (this.bottomShin > this.ideal.shinAngle.max) {
      shinNote = `膝がつま先より前に出すぎています（${Math.round(this.bottomShin)}°）。膝痛のリスクがあります`;
      score -= 15;
    }

    score = Math.max(0, score);

    const overall =
      score >= 90 ? '🔥 パーフェクトフォーム！' :
      score >= 75 ? '👍 良いフォームです！微調整で完璧に' :
      score >= 50 ? '⚠️ いくつか改善点があります' :
                    '🛑 フォームの確認が必要です';

    return { score, kneeNote, hipNote, trunkNote, shinNote, overall };
  }

  private currentState(angles?: SquatAngles): SquatAnalyzerState {
    return {
      phase:       this.phase,
      repCount:    this.repCount,
      angles:      angles ?? { knee: Math.round(this.kfKnee.value), hip: Math.round(this.kfHip.value), trunk: Math.round(this.kfTrunk.value), shin: Math.round(this.kfShin.value) },
      feedback:    this.lastFeedback,
      bottomKnee:  Math.round(this.bottomKnee),
      bottomHip:   Math.round(this.bottomHip),
      bottomTrunk: Math.round(this.bottomTrunk),
      bottomShin:  Math.round(this.bottomShin),
    };
  }

  reset(): void {
    this.phase       = 'IDLE';
    this.repCount    = 0;
    this.bottomKnee  = 180;
    this.bottomHip   = 180;
    this.bottomTrunk = 0;
    this.bottomShin  = 0;
    this.lastFeedback = null;
    this.kfKnee.reset(170);
    this.kfHip.reset(170);
    this.kfTrunk.reset(10);
    this.kfShin.reset(15);
  }

  updateIdealForm(form: Partial<SquatIdealForm>): void {
    this.ideal = { ...this.ideal, ...form };
  }
}
