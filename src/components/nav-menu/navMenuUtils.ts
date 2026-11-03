const DEFAULT_FOLDER_ICON = 'ri-folder-line';

/**
 * Deduplicate and validate hidden navigation keys against the definition map.
 *
 * @param {string[]} hiddenKeys - Keys to normalize
 * @param {Map} definitionMap - Map of valid nav definition keys
 * @returns {string[]} Normalized, deduplicated array of valid keys
 */

export function normalizeHiddenKeys(hiddenKeys: string[], definitionMap: Map<string, any>) {
    if (!Array.isArray(hiddenKeys)) {
        return [];
    }
    const seen = new Set();
    const normalized: string[] = [];
    hiddenKeys.forEach((key) => {
        if (!key || seen.has(key) || !definitionMap.has(key)) {
            return;
        }
        seen.add(key);
        normalized.push(key);
    });
    return normalized;
}

/**
 * Normalize a saved navigation layout: dedup items, create folders, append missing definitions.
 *
 * @param {Array} layout - Raw layout from storage
 * @param {string[]} hiddenKeys - Keys that should be hidden
 * @param {Map} definitionMap - Map of all valid nav definition keys
 * @param {Array} allDefinitions - Array of all nav definitions (for appending missing)
 * @param {Function} t - I18n translation function
 * @param {Function} generateFolderId - Function to generate unique folder IDs
 * @returns {Array} Sanitized layout
 */

export function sanitizeLayout(
    layout: Array<any>,
    hiddenKeys: string[],
    definitionMap: Map<string, any>,
    allDefinitions: Array<any>,
    t: Function,
    generateFolderId: Function
) {
    const usedKeys = new Set();
    const normalizedHiddenKeys = normalizeHiddenKeys(hiddenKeys, definitionMap);
    const hiddenSet = new Set(normalizedHiddenKeys);
    const normalized: any = [];
    const chartsKeys = ['charts-instance', 'charts-mutual', 'charts-hot-worlds'];

    const appendItemEntry = (key: unknown, target = normalized) => {
        if (typeof key !== 'string' || usedKeys.has(key) || !definitionMap.has(key)) {
            return;
        }
        target.push({ type: 'item', key });
        usedKeys.add(key);
    };

    const appendChartsFolder = (target = normalized) => {
        if (chartsKeys.some((key) => usedKeys.has(key))) {
            return;
        }
        if (!chartsKeys.every((key) => definitionMap.has(key))) {
            return;
        }
        chartsKeys.forEach((key) => usedKeys.add(key));
        target.push({
            type: 'folder',
            id: 'default-folder-charts',
            nameKey: 'nav_tooltip.charts',
            name: t('nav_tooltip.charts'),
            icon: 'ri-pie-chart-line',
            items: [...chartsKeys]
        });
    };

    if (Array.isArray(layout)) {
        layout.forEach((entry) => {
            if (entry?.type === 'item') {
                if (entry.key === 'charts') {
                    appendChartsFolder();
                    return;
                }
                appendItemEntry(entry.key);
                return;
            }

            if (entry?.type === 'folder') {
                const folderItems: any = [];
                (entry.items || []).forEach((key: unknown) => {
                    if (typeof key !== 'string' || usedKeys.has(key) || !definitionMap.has(key)) {
                        return;
                    }
                    folderItems.push(key);
                    usedKeys.add(key);
                });

                if (folderItems.length >= 1) {
                    const folderNameKey = entry.nameKey || null;
                    const folderName = folderNameKey ? t(folderNameKey) : entry.name || '';
                    normalized.push({
                        type: 'folder',
                        id: entry.id || generateFolderId(),
                        name: folderName,
                        nameKey: folderNameKey,
                        icon: entry.icon || DEFAULT_FOLDER_ICON,
                        items: folderItems
                    });
                }
            }
        });
    }

    allDefinitions.forEach((item) => {
        if (!usedKeys.has(item.key) && !hiddenSet.has(item.key)) {
            if (chartsKeys.includes(item.key)) {
                const chartsFolder = normalized.find(
                    (entry: { type: string; id: string }) =>
                        entry.type === 'folder' && entry.id === 'default-folder-charts'
                );
                if (chartsFolder && Array.isArray(chartsFolder.items)) {
                    chartsFolder.items.push(item.key);
                    usedKeys.add(item.key);
                    return;
                }
            }
            appendItemEntry(item.key);
        }
    });

    if (!chartsKeys.some((key) => usedKeys.has(key)) && !chartsKeys.some((key) => hiddenSet.has(key))) {
        appendChartsFolder();
    }

    // Ensure direct-access is always the last item
    const directAccessIdx = normalized.findIndex(
        (entry: { type: string; key: string }) => entry.type === 'item' && entry.key === 'direct-access'
    );
    if (directAccessIdx !== -1 && directAccessIdx !== normalized.length - 1) {
        const [directAccessEntry] = normalized.splice(directAccessIdx, 1);
        normalized.push(directAccessEntry);
    }

    return normalized;
}

/**
 * Find the first routable navigation key in a layout.
 *
 * @param {Array} layout - Navigation layout
 * @param {Map} definitionMap - Map of nav definitions
 * @returns {string | null} The route name of the first routable entry, or null
 */

export function getFirstNavRoute(layout: Array<any>, definitionMap: Map<string, any>) {
    for (const entry of layout) {
        if (entry.type === 'item') {
            const definition = definitionMap.get(entry.key);
            if (definition?.routeName) {
                return definition.routeName;
            }
        }
        if (entry.type === 'folder' && entry.items?.length) {
            const definition = entry.items
                .map((key: any) => definitionMap.get(key))
                .find((def: { routeName: any }) => def?.routeName);
            if (definition?.routeName) {
                return definition.routeName;
            }
        }
    }
    return null;
}

/**
 * Check if a navigation entry has a notification indicator.
 *
 * @param {object} entry - Navigation entry object
 * @param {string[]} notifiedMenus - List of menu keys with notifications
 * @returns {boolean}
 */
export function isEntryNotified(entry: object, notifiedMenus: string[]) {
    if (!entry) {
        return false;
    }
    const targets = [];
    if ((entry as any).index) {
        targets.push((entry as any).index);
    }
    if ((entry as any).routeName) {
        targets.push((entry as any).routeName);
    }
    if ((entry as any).path) {
        const lastSegment = (entry as any).path.split('/').pop();
        if (lastSegment) {
            targets.push(lastSegment);
        }
    }
    if (!Array.isArray(notifiedMenus)) {
        return false;
    }
    return targets.some((key) => notifiedMenus.includes(key));
}
