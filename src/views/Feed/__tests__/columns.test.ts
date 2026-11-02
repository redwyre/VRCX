import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../plugins/i18n', () => ({
    i18n: {
        global: {
            t: (key: any) => key
        }
    }
}));

vi.mock('../../../stores', () => ({
    useGalleryStore: () => ({
        showFullscreenImageDialog: vi.fn()
    })
}));

vi.mock('../../../coordinators/userCoordinator', () => ({
    showUserDialog: vi.fn()
}));

vi.mock('../../../shared/utils', () => ({
    formatDateFilter: (value: any) => value,
    statusClass: (value: any) => value,
    timeToText: (value: any) => value
}));

vi.mock('../../../components/AvatarInfo.vue', () => ({
    default: 'AvatarInfo'
}));

vi.mock('../../../components/Location.vue', () => ({
    default: 'Location'
}));

vi.mock('../../../components/ui/badge', () => ({
    Badge: 'Badge'
}));

vi.mock('../../../components/ui/button', () => ({
    Button: 'Button'
}));

vi.mock('../../../components/ui/tooltip', () => ({
    Tooltip: 'Tooltip',
    TooltipContent: 'TooltipContent',
    TooltipTrigger: 'TooltipTrigger'
}));

vi.mock('lucide-vue-next', () => ({
    ArrowDown: 'ArrowDown',
    ArrowRight: 'ArrowRight',
    ArrowUpDown: 'ArrowUpDown',
    ChevronDown: 'ChevronDown',
    ChevronRight: 'ChevronRight'
}));

import { columns } from '../columns';

function createElement(type: any, props: any, ...children: any[]) {
    return {
        type,
        props: props ?? {},
        children: children.flat()
    };
}

function findNode(node: { children: any; }, predicate: { (n: any): boolean; (arg0: any): any; }): any {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (const item of node) {
            const result = findNode(item, predicate);
            if (result) return result;
        }
        return null;
    }
    if (predicate(node)) return node;
    if (!node.children) return null;
    return findNode(node.children, predicate);
}

describe('views/Feed/columns.jsx', () => {
    beforeEach(() => {
        globalThis.React = { createElement };
    });

    test('renders current bio text in detail cell', () => {
        const detailCol = columns.find((c) => c.id === 'detail');
        const row = {
            original: {
                type: 'Bio',
                previousBio: 'hello\nold',
                bio: 'hello\nnew'
            }
        };





        const vnode = detailCol.cell({ row });

        expect(vnode.type).toBe('span');
        expect(vnode.children).toContain('hello\nnew');
        expect(vnode.props.innerHTML).toBeUndefined();
    });

    test('keeps multiline bio diff in expanded row', () => {
        const expanderCol = columns.find((c) => c.id === 'expander');




        const expanded = expanderCol.meta.expandedRow({
            row: {
                original: {
                    type: 'Bio',
                    previousBio: 'line1\nline2',
                    bio: 'line1\nline3'
                }
            }
        });
        const preNode = findNode(expanded, (n: { type: string; }) => n.type === 'pre');

        expect(preNode).toBeTruthy();
        expect(preNode.props.innerHTML).toContain('x-text-added');
        expect(preNode.props.innerHTML).toContain('x-text-removed');
        expect(preNode.props.innerHTML).toContain('<br>');
    });
});
