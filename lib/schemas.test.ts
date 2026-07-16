import { describe, expect, it } from 'vitest';
import { INITIAL_STRATEGIES } from './data';
import { strategySchema } from './schemas';

describe('strategySchema', () => {
  it('accepts every bundled initial strategy', () => {
    for (const strategy of Object.values(INITIAL_STRATEGIES)) {
      expect(strategySchema.safeParse(strategy).success).toBe(true);
    }
  });

  it('rejects syntactically valid but incomplete model output', () => {
    const result = strategySchema.safeParse({
      positioning: { type: 'Spike' },
      schools: {},
    });

    expect(result.success).toBe(false);
  });
});
