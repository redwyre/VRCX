import { isFunction } from '@tanstack/vue-table';

export function valueUpdater(updaterOrValue: (arg0: any) => any, ref: { value: any; }) {
    ref.value = isFunction(updaterOrValue) ? updaterOrValue(ref.value) : updaterOrValue;
}
