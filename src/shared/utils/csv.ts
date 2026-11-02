/**
 * @param {string} text
 * @returns {boolean}
 */
export function needsCsvQuotes(text: string) {
    // oxlint-disable-next-line no-control-regex
    return /[\x00-\x1f,"]/.test(text);
}

/**
 * @param {any} value
 * @returns {string}
 */
export function formatCsvField(value: any) {
    if (value === null || typeof value === 'undefined') {
        return '';
    }
    const text = String(value);
    if (needsCsvQuotes(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

/**
 * @param {object} obj - The source object
 * @param {string[]} fields - Property names to include
 * @returns {string}
 */
export function formatCsvRow(obj: object, fields: string[]) {
    return fields.map((field) => formatCsvField((obj as any)?.[field])).join(',');
}
