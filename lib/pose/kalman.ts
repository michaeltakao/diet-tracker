/**
 * 1-D Kalman filter for smoothing noisy joint angle readings.
 *
 * Robotics analogy: identical to sensor fusion on a joint encoder.
 * Q = process noise (how fast the true angle can change)
 * R = measurement noise (how noisy the pose estimator is)
 */
export class KalmanFilter1D {
  private P: number;
  private x: number;

  constructor(
    private Q = 0.05,  // process noise — higher = more responsive, less smooth
    private R = 2.0,   // measurement noise — higher = smoother but more lag
    initialValue = 0,
  ) {
    this.x = initialValue;
    this.P = 1.0;
  }

  update(z: number): number {
    // Predict
    this.P += this.Q;
    // Update
    const K = this.P / (this.P + this.R);
    this.x = this.x + K * (z - this.x);
    this.P = (1 - K) * this.P;
    return this.x;
  }

  reset(value = 0): void {
    this.x = value;
    this.P = 1.0;
  }

  get value(): number {
    return this.x;
  }
}
