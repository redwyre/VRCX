/**
 * @param {Array} array
 * @param {any} item
 * @returns {boolean}
 */
function removeFromArray(array: Array<any>, item: any) {
    const { length } = array;
    for (let i = 0; i < length; ++i) {
        if (array[i] === item) {
            array.splice(i, 1);
            return true;
        }
    }
    return false;
}

/**
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function arraysMatch(a: Array<any>, b: Array<any>) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
        return false;
    }
    return a.length === b.length && a.every((element, index) => JSON.stringify(element) === JSON.stringify(b[index]));
}

/**
 * @param {Array} array
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {void}
 */
function moveArrayItem(array: Array<any>, fromIndex: number, toIndex: number) {
    if (!Array.isArray(array) || fromIndex === toIndex) {
        return;
    }
    if (fromIndex < 0 || fromIndex >= array.length) {
        return;
    }
    if (toIndex < 0 || toIndex >= array.length) {
        return;
    }
    const item = array[fromIndex];
    array.splice(fromIndex, 1);
    array.splice(toIndex, 0, item);
}

function replaceReactiveObject(target: { [x: string]: any; a?: number; b?: number; }, source: { [x: string]: any; c?: number; a?: number; b?: number; }) {
    for (const key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            delete target[key];
        }
    }

    for (const key in source) {
        target[key] = source[key];
    }
}

export { removeFromArray, arraysMatch, moveArrayItem, replaceReactiveObject };
