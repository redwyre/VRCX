import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { toolDefinitionMap, toolDefinitions } from '../shared/constants';
import { useAdvancedSettingsStore, useLaunchStore, useToolsStore, useVrcxStore } from '../stores';

/**
 * @param {object} definition
 * @param {object} deps
 * @param {object} deps.router
 * @param {Function} deps.t
 * @param {object} deps.toolsStore
 * @param {object} deps.advancedSettingsStore
 * @param {object} deps.launchStore
 * @param {object} deps.vrcxStore
 */
export async function executeToolAction(
    definition: object, { router, t, toolsStore, advancedSettingsStore, launchStore, vrcxStore }: {
    router: object;
    t: Function;
    toolsStore: object;
    advancedSettingsStore: object;
    launchStore: object;
    vrcxStore: object;
}
) {
    if (!(definition as any)?.action) {
        return;
    }

    const { action }: any = definition;

    if (action.type === 'route') {
        (router as any).push({ name: action.routeName });
        return;
    }

    if (action.type === 'dialog') {
        (toolsStore as any).openDialog(toDialogStoreKey(action.dialogKey));
        return;
    }

    if (action.type === 'store-action') {
        const targetStore = ({
    advancedSettings: advancedSettingsStore,
    launch: launchStore,
    vrcx: vrcxStore
} as any)[action.target];

        targetStore?.[action.method]?.();
        return;
    }

    if (action.type === 'app-api') {
        const result = await (AppApi as any)[action.method]();
        if (result) {
            toast.success(t(action.successMessageKey));
            return;
        }
        toast.error(t(action.errorMessageKey));
    }
}

/**
 * @param {string} dialogKey
 * @returns {string}
 */
export function toDialogStoreKey(dialogKey: string) {
    return dialogKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function useToolActions() {
    const router = useRouter();
    const { t } = useI18n();

    const toolsStore = useToolsStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const launchStore = useLaunchStore();
    const vrcxStore = useVrcxStore();

    async function triggerTool(toolOrKey: any) {
        const definition = typeof toolOrKey === 'string' ? toolDefinitionMap.get(toolOrKey) : toolOrKey;

        await executeToolAction(definition, {
            router,
            t,
            toolsStore,
            advancedSettingsStore,
            launchStore,
            vrcxStore
        });
    }

    return {
        toolDefinitions,
        triggerTool
    };
}
