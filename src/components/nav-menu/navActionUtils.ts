/**
 * @param {object | null | undefined} entry
 * @returns {boolean}
 */
export function isNavEntryActionable(entry: object | null | undefined) {
    return Boolean((entry as any)?.routeName || (entry as any)?.action || (entry as any)?.path);
}

/**
 * @param {object} router
 * @param {string} routeName
 * @param {object | undefined} routeParams
 */
export function navigateToRoute(router: object, routeName: string, routeParams: object | undefined = undefined) {
    if (!routeName) {
        return;
    }

    if (routeParams) {
        (router as any).push({ name: routeName, params: routeParams });
        return;
    }

    (router as any).push({ name: routeName });
}

/**
 * @param {object | null | undefined} entry
 * @param {object} deps
 * @param {object} deps.router
 * @param {Function} deps.directAccessPaste
 */
export function triggerNavEntryAction(entry: object | null | undefined, { router, directAccessPaste }: {
    router: object;
    directAccessPaste: Function;
}) {
    if (!entry) {
        return;
    }

    if ((entry as any).action === 'direct-access') {
        directAccessPaste();
        return;
    }

    if ((entry as any).action && typeof (entry as any).action === 'object') {
        return (entry as any).action;
    }

    if ((entry as any).routeName) {
        navigateToRoute(router, (entry as any).routeName, (entry as any).routeParams);
        return;
    }

    if ((entry as any).path) {
        (router as any).push((entry as any).path);
    }
}
