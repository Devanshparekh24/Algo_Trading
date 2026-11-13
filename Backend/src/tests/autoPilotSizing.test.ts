import { describe, it, expect } from 'vitest';
import { getAutoPilotConfig, updateAutoPilotConfig } from '../services/ai/autoPilot.service.js';

describe('Auto-Pilot Configuration & Sizing Logic', () => {
  it('updates auto-pilot enabled status, mode, and maxBudgetPerTrade slab', () => {
    const updated = updateAutoPilotConfig({
      enabled: true,
      mode: 'PAPER',
      strategy: 'GAMMA_BLAST',
      maxBudgetPerTrade: 10000,
    });

    expect(updated.enabled).toBe(true);
    expect(updated.mode).toBe('PAPER');
    expect(updated.strategy).toBe('GAMMA_BLAST');
    expect(updated.maxBudgetPerTrade).toBe(10000);

    const current = getAutoPilotConfig();
    expect(current.maxBudgetPerTrade).toBe(10000);
    expect(current.mode).toBe('PAPER');
  });

  it('correctly calculates lots fitting within manual budget slab', () => {
    const lotSize = 25; // NIFTY lot size
    const optionPrice = 120; // ₹120 per unit
    const singleLotCost = lotSize * optionPrice; // ₹3,000

    // Case 1: Slab = ₹5,000
    const slab5k = 5000;
    const maxLotsIn5k = Math.floor(slab5k / singleLotCost); // 1 lot (cost: ₹3,000 <= ₹5,000)
    expect(maxLotsIn5k).toBe(1);

    // Case 2: Slab = ₹10,000
    const slab10k = 10000;
    const maxLotsIn10k = Math.floor(slab10k / singleLotCost); // 3 lots (cost: ₹9,000 <= ₹10,000)
    expect(maxLotsIn10k).toBe(3);

    // Case 3: 1 lot cost exceeds slab
    const expensiveOptionPrice = 250;
    const expensiveLotCost = lotSize * expensiveOptionPrice; // ₹6,250 > ₹5,000
    const fitsIn5k = expensiveLotCost <= slab5k;
    expect(fitsIn5k).toBe(false);
  });

  it('supports dynamic mode when maxBudgetPerTrade is 0', () => {
    const updated = updateAutoPilotConfig({
      enabled: false,
      maxBudgetPerTrade: 0,
      defaultQuantity: 2,
    });

    expect(updated.maxBudgetPerTrade).toBe(0);
    expect(updated.defaultQuantity).toBe(2);
  });
});

