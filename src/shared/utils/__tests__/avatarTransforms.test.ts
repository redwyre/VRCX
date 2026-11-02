// TODO(ts-migrate): Check that this import is the one meant; TypeScript offered the name from
// several modules.
// describe was taken from vitest, over node:test. it was taken from vitest, over node:test.
import { describe, it, expect } from 'vitest';
import { createDefaultAvatarRef } from '../avatarTransforms';

describe('createDefaultAvatarRef', () => {
    it('creates object with defaults', () => {
        const ref = createDefaultAvatarRef({});
        expect(ref.id).toBe('');
        expect(ref.name).toBe('');
        expect(ref.version).toBe(0);
        expect(ref.tags).toEqual([]);
    });

    it('spreads json over defaults', () => {
        const ref = createDefaultAvatarRef({
            id: 'avtr_123',
            name: 'My Avatar'
        });
        expect(ref.id).toBe('avtr_123');
        expect(ref.name).toBe('My Avatar');
    });
});
