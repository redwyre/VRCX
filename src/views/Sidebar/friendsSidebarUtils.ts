/**
 * @param {object} opts
 * @param {string} opts.key - Unique key
 * @param {string} opts.label - Display label
 * @param {number | null} [opts.count] - Item count
 * @param {boolean} [opts.expanded] - Whether section is expanded
 * @param {string | null} [opts.headerPadding] - CSS padding
 * @param {number | null} [opts.paddingBottom] - Bottom padding in px
 * @param {Function | null} [opts.onClick] - Click handler
 * @returns {object} Row object
 */
export function buildToggleRow({ key, label, count = null, expanded = true, headerPadding = null, paddingBottom = null, onClick = null }: {
    key: string;
    label: string;
    count?: number | null;
    expanded?: boolean;
    headerPadding?: any;
    paddingBottom?: number | null;
    onClick?: Function | null;
}) {
    return {
        type: 'toggle-header',
        key,
        label,
        count,
        expanded,
        headerPadding,
        paddingBottom,
        onClick
    };
}

/**
 * @param {object} friend - Friend data object
 * @param {string} key - Unique key
 * @param {object} [options] - Additional options
 * @param {boolean} [options.isGroupByInstance] - Whether grouped by instance
 * @param {number} [options.paddingBottom] - Bottom padding
 * @param {object} [options.itemStyle] - Additional style
 * @returns {object} Row object
 */
export function buildFriendRow(friend: object, key: string, options: {
    isGroupByInstance?: boolean;
    paddingBottom?: number;
    itemStyle?: object;
} = {}) {
    return {
        type: 'friend-item',
        key,
        friend,
        isGroupByInstance: options.isGroupByInstance,
        paddingBottom: options.paddingBottom,
        itemStyle: options.itemStyle
    };
}

/**
 * @param {string} location - Instance location string
 * @param {number} count - Number of friends in instance
 * @param {string} key - Unique key
 * @returns {object} Row object
 */
export function buildInstanceHeaderRow(location: string, count: number, key: string) {
    return {
        type: 'instance-header',
        key,
        location,
        count,
        paddingBottom: 4
    };
}

/**
 * Estimate pixel height for a virtual row.
 *
 * @param {object} row - Row object with type property
 * @returns {number} Estimated height in pixels
 */
export function estimateRowSize(row: object) {
    if (!row) {
        return 44;
    }
    if ((row as any).type === 'toggle-header') {
        return 28 + ((row as any).paddingBottom || 0);
    }
    if ((row as any).type === 'vip-subheader') {
        return 24 + ((row as any).paddingBottom || 0);
    }
    if ((row as any).type === 'instance-header') {
        return 26 + ((row as any).paddingBottom || 0);
    }
    return 52 + ((row as any).paddingBottom || 0);
}
