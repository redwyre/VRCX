import { beforeEach, describe, expect, test, vi } from 'vitest';

class FakeGraph {
    _edges: any;
    _nodes;
    constructor() {
        this._nodes = new Map();
        this._edges = [];
    }

    addNode(id: any, attrs = {}) {
        this._nodes.set(id, { ...attrs });
    }

    addEdgeWithKey(key: any, source: any, target: any, attrs = {}) {
        if (!this._nodes.has(source) || !this._nodes.has(target)) {
            throw new Error('missing node');
        }
        this._edges.push({ key, source, target, attrs: { ...attrs } });
    }

    get order() {
        return this._nodes.size;
    }

    forEachNode(cb: (arg0: any, arg1: any) => void) {
        for (const [id, attrs] of this._nodes.entries()) cb(id, attrs);
    }

    mergeNodeAttributes(node: any, attrs: any) {
        this._nodes.set(node, { ...this._nodes.get(node), ...attrs });
    }
}

vi.mock('graphology', () => ({ default: FakeGraph }));
vi.mock('graphology-layout-forceatlas2', () => ({
    default: {
        inferSettings: vi.fn(() => ({ gravity: 1 })),
        assign: vi.fn((graph) => {
            graph.forEachNode((id: any, attrs: any) => {
                graph.mergeNodeAttributes(id, {
                    x: Number.isFinite(attrs.x) ? attrs.x + 1 : 1,
                    y: Number.isFinite(attrs.y) ? attrs.y + 1 : 1
                });
            });
        })
    }
}));
vi.mock('graphology-layout-noverlap', () => ({
    default: {
        assign: vi.fn()
    }
}));

function setupWorkerHarness() {
    const sent: any = [];
    let handler: ((arg0: { data: any; }) => any) | null = null;





    globalThis.self = {
        addEventListener: vi.fn((event, cb) => {
            if (event === 'message') handler = cb;
        }),
        postMessage: vi.fn((payload) => {
            sent.push(payload);
        })
    };

    return {
        sent,
        dispatch: (data: any) => handler?.({ data })
    };
}

describe('graphLayoutWorker message protocol', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('returns positions with the same requestId on success', async () => {
        const harness = setupWorkerHarness();
        await import('../graphLayoutWorker');

        harness.dispatch({
            requestId: 11,
            nodes: [
                { id: 'n1', attributes: { x: 0, y: 0 } },
                { id: 'n2', attributes: { x: 2, y: 2 } }
            ],
            edges: [{ key: 'n1__n2', source: 'n1', target: 'n2', attributes: {} }],
            settings: {
                layoutIterations: 300,
                layoutSpacing: 60,
                deltaSpacing: 0,
                reinitialize: false
            }
        });

        expect(harness.sent).toHaveLength(1);
        expect(harness.sent[0].requestId).toBe(11);
        expect(harness.sent[0].positions.n1).toBeTruthy();
        expect(harness.sent[0].positions.n2).toBeTruthy();
    });

    test('returns error with requestId when layout throws', async () => {
        const harness = setupWorkerHarness();
        await import('../graphLayoutWorker');

        harness.dispatch({
            requestId: 12,
            nodes: [{ id: 'n1', attributes: { x: 0, y: 0 } }],
            edges: [{ key: 'n1__n2', source: 'n1', target: 'n2', attributes: {} }],
            settings: {
                layoutIterations: 300,
                layoutSpacing: 60,
                deltaSpacing: 0,
                reinitialize: false
            }
        });

        expect(harness.sent).toHaveLength(1);
        expect(harness.sent[0].requestId).toBe(12);
        expect(harness.sent[0].error).toContain('missing node');
    });
});
