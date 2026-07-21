import { describe, it, expect } from 'vitest';
import { decideSusShow, type SusGateInput } from '../sus-gate';

const CONSENTED_AT = '2026-07-01T09:00:00.000Z'; // JST day 2026-07-01

function input(overrides: Partial<SusGateInput> = {}): SusGateInput {
  return {
    consentedAt: CONSENTED_AT,
    today: '2026-07-15',
    alreadySubmitted: false,
    dismissCount: 0,
    lastDismissedDay: null,
    ...overrides,
  };
}

describe('decideSusShow', () => {
  it('never shows to an unconsented user', () => {
    expect(decideSusShow(input({ consentedAt: null, today: '2026-12-31' })).show).toBe(false);
  });

  it('hides before day 14', () => {
    expect(decideSusShow(input({ today: '2026-07-13' })).show).toBe(false); // day 12
  });

  it('shows exactly on day 14', () => {
    expect(decideSusShow(input({ today: '2026-07-15' })).show).toBe(true); // day 14
  });

  it('shows after day 14', () => {
    expect(decideSusShow(input({ today: '2026-07-20' })).show).toBe(true); // day 19
  });

  it('never shows again once already submitted', () => {
    expect(decideSusShow(input({ alreadySubmitted: true, today: '2026-08-01' })).show).toBe(false);
  });

  it('hides for the rest of the same day after a dismissal', () => {
    expect(decideSusShow(input({ today: '2026-07-15', lastDismissedDay: '2026-07-15' })).show).toBe(false);
  });

  it('reappears the day after a dismissal', () => {
    expect(decideSusShow(input({ today: '2026-07-16', lastDismissedDay: '2026-07-15' })).show).toBe(true);
  });
});
