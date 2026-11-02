// TODO(ts-migrate): Check that this import is the one meant; TypeScript offered the name from
// several modules.
// describe was taken from vitest, over node:test. it was taken from vitest, over node:test.
import { describe, it, expect } from 'vitest';
import { createDefaultWorldRef } from '../worldTransforms';

describe('createDefaultWorldRef', () => {
    it('creates object with defaults', () => {
        const ref = createDefaultWorldRef({});
        expect(ref.id).toBe('');
        expect(ref.name).toBe('');
        expect(ref.capacity).toBe(0);
        expect(ref.$isLabs).toBe(false);
    });

    it('spreads json over defaults', () => {
        const ref = createDefaultWorldRef({
            id: 'wrld_123',
            name: 'Test World'
        });
        expect(ref.id).toBe('wrld_123');
        expect(ref.name).toBe('Test World');
    });
});
