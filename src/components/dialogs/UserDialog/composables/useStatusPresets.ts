import { ref } from 'vue';
import configRepository from '../../../../services/config';

const STORAGE_KEY = 'VRCX_statusPresets';
const MAX_PRESETS = 10;

const STATUS_CLASS_MAP = {
    'join me': 'joinme',
    active: 'online',
    'ask me': 'askme',
    busy: 'busy',
    offline: 'offline'
};

const presets = ref([]);
let loadPromise: Promise<void> | null = null;

export function useStatusPresets() {
    async function loadPresets() {
        try {




            presets.value = await configRepository.getArray(STORAGE_KEY, []);
        } catch {
            presets.value = [];
        }
    }

    async function addPreset(status: any, statusDescription: any) {
        if (presets.value.length >= MAX_PRESETS) {
            return 'limit';
        }
        const exists = presets.value.some((p) => (p as any).status === status && (p as any).statusDescription === statusDescription);
        if (exists) {
            return 'exists';
        }




        presets.value.push({ status, statusDescription });
        await configRepository.setArray(STORAGE_KEY, presets.value);
        return 'ok';
    }

    async function removePreset(index: number) {
        presets.value.splice(index, 1);
        await configRepository.setArray(STORAGE_KEY, presets.value);
    }

    function getStatusClass(status: string | number) {
        return STATUS_CLASS_MAP[status as keyof typeof STATUS_CLASS_MAP] || 'online';
    }

    if (!loadPromise) {
        loadPromise = loadPresets();
    }

    return {
        presets,
        loadPresets,
        addPreset,
        removePreset,
        getStatusClass,
        MAX_PRESETS
    };
}
