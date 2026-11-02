// Mock router to avoid transitive i18n.global error from columns.jsx
vi.mock('../../plugins/router.js', () => ({
    router: { beforeEach: vi.fn(), push: vi.fn() },
    initRouter: vi.fn()
}));

// TODO(ts-migrate): Check that this import is the one meant; TypeScript offered the name from
// several modules.
// describe was taken from vitest, over node:test. test was taken from vitest, over node:test
// and node:test.
import { vi, describe, test, expect } from 'vitest';
import { transformKey } from '../config';

describe('transformKey', () => {
    test('lowercases and prefixes with config:', () => {
        expect(transformKey('Foo')).toBe('config:foo');
    });

    test('handles already lowercase key', () => {
        expect(transformKey('bar')).toBe('config:bar');
    });

    test('handles key with mixed case and numbers', () => {
        expect(transformKey('MyKey123')).toBe('config:mykey123');
    });

    test('handles empty string', () => {
        expect(transformKey('')).toBe('config:');
    });

    test('converts non-string values via String()', () => {
        expect(transformKey(42)).toBe('config:42');
        expect(transformKey(null)).toBe('config:null');
    });
});
