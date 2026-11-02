/**
 * @param {Array} group - Array of group instance refs
 * @returns {string} The groupId, or empty string
 */
export function getGroupId(group: Array<any>) {
    return group[0]?.group?.groupId || '';
}

/**
 * @param {Array} group - Array of group instance refs
 * @param {number} index - Index of the group in the list
 * @param {object} cfg - Collapsed state config object
 * @returns {object} Row object
 */
export function buildGroupHeaderRow(group: Array<any>, index: number, cfg: object) {
    const groupId = getGroupId(group);
    return {
    type: 'group-header',
    key: `group-header:${groupId}`,
    groupId,
    label: group[0]?.group?.name ?? '',
    count: group.length,
    isCollapsed: Boolean((cfg as any)[groupId]?.isCollapsed),
    headerPaddingTop: index === 0 ? '0px' : '10px'
};
}

/**
 * @param {object} ref - Group instance ref object
 * @param {number} index - Index within the group
 * @param {string} groupId - Parent group ID
 * @param {boolean} isAgeGatedVisible - Whether age-gated instances should be visible
 * @returns {object} Row object
 */
export function buildGroupItemRow(ref: object, index: number, groupId: string, isAgeGatedVisible: boolean) {
    return {
    type: 'group-item',
    key: `group-item:${groupId}:${(ref as any)?.instance?.id ?? index}`,
    ownerId: (ref as any)?.instance?.ownerId ?? '',
    iconUrl: (ref as any)?.group?.iconUrl ?? '',
    name: (ref as any)?.group?.name ?? '',
    userCount: (ref as any)?.instance?.userCount ?? 0,
    capacity: (ref as any)?.instance?.capacity ?? 0,
    location: (ref as any)?.instance?.location ?? '',
    isVisible: Boolean(isAgeGatedVisible || !((ref as any)?.ageGate || (ref as any)?.location?.includes('~ageGate')))
};
}

/**
 * @param {object} row - Row object with type property
 * @returns {number} Estimated height in pixels
 */
export function estimateGroupRowSize(row: object) {
    if (!row) return 44;
    if ((row as any).type === 'group-header') {
        return 30;
    }
    return 52;
}
