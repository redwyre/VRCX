import { ref } from 'vue';
import { toast } from 'vue-sonner';

import {
    APP_CJK_FONT_PACK_CONFIG,
    APP_CJK_FONT_PACK_DEFAULT_KEY,
    APP_FONT_CONFIG,
    APP_FONT_DEFAULT_KEY,
    THEME_COLORS,
    THEME_CONFIG
} from '../../constants';
import { i18n } from '../../../plugins/i18n';
import { router } from '../../../plugins/router';
import { textToHex } from './string';

import configRepository, { ConfigRepository } from '../../../services/config';

const THEME_COLOR_STORAGE_KEY = 'VRCX_themeColor';
const THEME_COLOR_STYLE_ID = 'app-theme-color-style';
const THEME_MODE_STYLE_ID = 'app-theme-mode-style';
const DEFAULT_THEME_COLOR_KEY = 'default';

const APP_FONT_LINK_ATTR = 'data-app-font';
const APP_CJK_FONT_PACK_LINK_ATTR = 'data-app-cjk-font-pack';

const themeColors = THEME_COLORS.map((theme) => ({
    ...theme,
    href: theme.file ? new URL(`../../../styles/themes/${theme.file}`, import.meta.url).href : null
}));

const currentThemeColor = ref(DEFAULT_THEME_COLOR_KEY);
const isApplyingThemeColor = ref(false);

function resolveThemeColor(themeKey: string) {
    const normalized = String(themeKey).trim().toLowerCase();
    return (
        themeColors.find((theme) => theme.key === normalized) ||
        themeColors.find((theme) => theme.key === DEFAULT_THEME_COLOR_KEY)
    );
}

function applyThemeColorStyle(theme: any) {
    const root = document.documentElement;
    root.setAttribute('data-theme-color', theme.key);

    let styleEl = document.getElementById(THEME_COLOR_STYLE_ID);
    if (!theme.href) {
        styleEl?.remove();
        return;
    }

    if (!styleEl) {
        styleEl = document.createElement('link');
        styleEl.id = THEME_COLOR_STYLE_ID;
        styleEl.setAttribute('rel', 'stylesheet');
        document.head.appendChild(styleEl);
    }

    if (styleEl.getAttribute('href') !== theme.href) {
        styleEl.setAttribute('href', theme.href);
    }
}

async function applyThemeColor(themeKey: any, { persist = true } = {}) {
    const resolved = resolveThemeColor(themeKey);
    isApplyingThemeColor.value = true;
    applyThemeColorStyle(resolved);

    currentThemeColor.value = resolved.key;
    if (persist) {
        try {
            await configRepository.setString(THEME_COLOR_STORAGE_KEY, resolved.key);
        } catch (error) {
            console.warn('Failed to persist theme color', error);
        }
    }
    isApplyingThemeColor.value = false;
    return resolved;
}

async function initThemeColor() {
    const storedKey = await configRepository.getString(THEME_COLOR_STORAGE_KEY);
    const resolved = resolveThemeColor(storedKey || DEFAULT_THEME_COLOR_KEY);
    applyThemeColorStyle(resolved);

    currentThemeColor.value = resolved.key;
}

function useThemeColor() {
    return {
        themeColors,
        currentThemeColor,
        isApplyingThemeColor,
        applyThemeColor,
        initThemeColor
    };
}

let electronSystemIsDark: null = null;

function systemIsDarkMode() {
    if (electronSystemIsDark !== null) {
        return electronSystemIsDark;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setSystemIsDarkMode(isDark: any) {
    electronSystemIsDark = isDark;
}

function applyThemeFonts(themeKey: string | undefined, fontLinks = []) {
    document.querySelectorAll('link[data-theme-font]').forEach((linkEl) => linkEl.remove());

    if (!fontLinks?.length) {
        return;
    }

    const head = document.head;
    fontLinks.forEach((href) => {
        if (!href) {
            return;
        }
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = href;
        fontLink.dataset.themeFont = themeKey;
        head.appendChild(fontLink);
    });
}

function applyThemeModeStyle(themeMode: string | number) {
    const themeConfig = (THEME_CONFIG as any)[themeMode];
    const themeFile = themeConfig?.file;
    let styleEl = document.getElementById(THEME_MODE_STYLE_ID);

    if (!themeFile) {
        styleEl?.remove();
        return;
    }

    const themeHref = new URL(`../../../styles/themes/${themeFile}`, import.meta.url).href;

    if (!styleEl) {
        styleEl = document.createElement('link');
        styleEl.id = THEME_MODE_STYLE_ID;
        styleEl.setAttribute('rel', 'stylesheet');
        document.head.appendChild(styleEl);
    }

    if (styleEl.getAttribute('href') !== themeHref) {
        styleEl.setAttribute('href', themeHref);
    }
}

function resolveAppFontFamily(fontKey: any) {
    const normalized = String(fontKey || '')
        .trim()
        .toLowerCase();
    if ((APP_FONT_CONFIG as any)[normalized]) {
        return { key: normalized, ...(APP_FONT_CONFIG as any)[normalized] };
    }
    return {
        key: APP_FONT_DEFAULT_KEY,
        ...APP_FONT_CONFIG[APP_FONT_DEFAULT_KEY]
    };
}

function ensureDynamicFontStyle(attrName: string, styleKey: any, cssImport: string | null) {
    const head = document.head;
    if (!head) {
        return;
    }

    document.querySelectorAll(`style[${attrName}]`).forEach((styleEl) => {
        if (styleEl.getAttribute(attrName) !== styleKey) {
            styleEl.remove();
        }
    });

    if (!cssImport) {
        return;
    }

    const existing = document.querySelector(`style[${attrName}="${styleKey}"]`);
    if (existing) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.setAttribute(attrName, styleKey);
    styleEl.textContent = cssImport;
    head.appendChild(styleEl);
}

function resolveAppCjkFontPack(packKey: any) {
    const normalized = String(packKey || '')
        .trim()
        .toLowerCase();
    if ((APP_CJK_FONT_PACK_CONFIG as any)[normalized]) {
        return { key: normalized, ...(APP_CJK_FONT_PACK_CONFIG as any)[normalized] };
    }
    return {
        key: APP_CJK_FONT_PACK_DEFAULT_KEY,
        ...APP_CJK_FONT_PACK_CONFIG[APP_CJK_FONT_PACK_DEFAULT_KEY]
    };
}

function ensureAppCjkFontPackLinks(packKey: any) {
    const config = (APP_CJK_FONT_PACK_CONFIG as any)[packKey];
    ensureDynamicFontStyle(APP_CJK_FONT_PACK_LINK_ATTR, packKey, config?.cssImport);
}

function applyAppFontFamily(fontKey: string, customCssName: string) {
    if (fontKey === 'custom') {
        const cssName = String(customCssName || '').trim() || 'system-ui';
        const root = document.documentElement;
        root.style.setProperty('--font-western-primary', cssName);
        ensureDynamicFontStyle(APP_FONT_LINK_ATTR, 'custom', null);
        return {
            key: 'custom',
            ...APP_FONT_CONFIG.custom,
            cssName
        };
    }

    const resolved = resolveAppFontFamily(fontKey);
    const root = document.documentElement;
    root.style.setProperty('--font-western-primary', resolved.cssName);
    ensureDynamicFontStyle(APP_FONT_LINK_ATTR, resolved.key, resolved.cssImport);

    return resolved;
}

function applyAppCjkFontPack(packKey: string) {
    const resolved = resolveAppCjkFontPack(packKey);
    const root = document.documentElement;
    root.style.setProperty('--font-cjk-jp-primary', resolved.cssName.jp);
    root.style.setProperty('--font-cjk-sc-primary', resolved.cssName.sc);
    root.style.setProperty('--font-cjk-kr-primary', resolved.cssName.kr);
    root.style.setProperty('--font-cjk-tc-primary', resolved.cssName.tc);

    ensureAppCjkFontPackLinks(resolved.key);

    return resolved;
}

function changeAppThemeStyle(themeMode: string) {
    let isSystemMode = themeMode === 'system';
    if (isSystemMode) {
        themeMode = systemIsDarkMode() ? 'dark' : 'light';
    }

    let themeConfig = (THEME_CONFIG as any)[themeMode];
    if (!themeConfig) {
        // fallback to system
        console.error('Invalid theme mode:', themeMode);
        configRepository.setString('VRCX_ThemeMode', 'system');
        isSystemMode = true;
        themeMode = systemIsDarkMode() ? 'dark' : 'light';
        themeConfig = (THEME_CONFIG as any)[themeMode];
    }

    applyThemeFonts(themeMode, themeConfig.fontLinks);
    applyThemeModeStyle(themeMode);

    document.documentElement.setAttribute('data-theme', themeMode);

    const shouldUseDarkClass = Boolean(themeConfig.isDark);
    if (shouldUseDarkClass) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    if (themeConfig.name === 'Midnight') {
        (AppApi as any).ChangeTheme(2);
    } else if (themeConfig.isDark) {
        (AppApi as any).ChangeTheme(1);
    } else {
        (AppApi as any).ChangeTheme(0);
    }

    if (LINUX) {
        window.electron?.setThemeSource(isSystemMode ? 'system' : themeConfig.isDark ? 'dark' : 'light');
    }

    return { isDark: themeConfig.isDark };

    // let $appThemeDarkStyle = document.getElementById('app-theme-dark-style');
    // const darkThemeCssPath = `${filePathPrefix}theme.dark.css`;
    // const shouldApplyDarkBase = themeConfig.isDark;
    // if (shouldApplyDarkBase) {
    //     if (!$appThemeDarkStyle) {
    //         $appThemeDarkStyle = document.createElement('link');
    //         $appThemeDarkStyle.setAttribute('id', 'app-theme-dark-style');
    //         $appThemeDarkStyle.rel = 'stylesheet';
    //         $appThemeDarkStyle.href = darkThemeCssPath;
    //         document.head.insertBefore($appThemeDarkStyle, $appThemeStyle);
    //     } else if ($appThemeDarkStyle.href !== darkThemeCssPath) {
    //         $appThemeDarkStyle.href = darkThemeCssPath;
    //     }
    // } else {
    //     $appThemeDarkStyle && $appThemeDarkStyle.remove();
    // }
}

/**
 * @param {object} trustColor
 */
function updateTrustColorClasses(trustColor: object) {
    if (document.getElementById('trustColor') !== null) {
        document.getElementById('trustColor').outerHTML = '';
    }
    const style = document.createElement('style');
    style.id = 'trustColor';
    style.type = 'text/css';
    let newCSS = '';
    for (const rank in trustColor) {
        newCSS += `.x-tag-${rank} { color: ${(trustColor as any)[rank]} !important; border-color: ${(trustColor as any)[rank]} !important; } `;
    }
    style.innerHTML = newCSS;
    document.getElementsByTagName('head')[0].appendChild(style);
}

async function refreshCustomCss() {
    if (document.contains(document.getElementById('app-custom-style'))) {
        document.getElementById('app-custom-style').remove();
    }
    const customCss = await (AppApi as any).CustomCss();
    if (customCss) {
        const head = document.head;
        const $appCustomStyle = document.createElement('link');
        $appCustomStyle.setAttribute('id', 'app-custom-style');
        $appCustomStyle.rel = 'stylesheet';
        $appCustomStyle.type = 'text/css';
        $appCustomStyle.href = URL.createObjectURL(new Blob([customCss], { type: 'text/css' }));
        head.appendChild($appCustomStyle);
    }
}

async function refreshCustomScript() {
    if (document.contains(document.getElementById('app-custom-script'))) {
        document.getElementById('app-custom-script').remove();
    }
    const customScript = await (AppApi as any).CustomScript();
    if (customScript) {
        const head = document.head;
        const $appCustomScript = document.createElement('script');
        $appCustomScript.setAttribute('id', 'app-custom-script');
        $appCustomScript.type = 'text/javascript';
        $appCustomScript.textContent = customScript;
        head.appendChild($appCustomScript);
    }
}

/**
 * @param {number} hue
 * @param isDarkMode
 * @returns {string}
 */
function HueToHex(hue: number, isDarkMode: boolean) {
    // this.HSVtoRGB(hue / 65535, .8, .8);
    if (isDarkMode) {
        return HSVtoRGB(hue / 65535, 0.6, 1);
    }
    return HSVtoRGB(hue / 65535, 1, 0.7);
}

/**
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {string}
 */
function HSVtoRGB(h: number, s: number, v: number) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (arguments.length === 1) {
        s = (h as any).s;

        v = (h as any).v;

        h = (h as any).h;
    }
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);
    const decColor = 0x1000000 + blue + 0x100 * green + 0x10000 * red;
    return `#${decColor.toString(16).substr(1)}`;
}

function formatJsonVars(ref: any) {
    // remove all object keys that start with $
    const newRef = { ...ref };
    for (const key in newRef) {
        if (key.startsWith('$')) {
            delete newRef[key];
        }
    }
    // sort keys alphabetically
    const sortedKeys = Object.keys(newRef).sort();
    const sortedRef = {};
    sortedKeys.forEach((key) => {
        (sortedRef as any)[key] = newRef[key];
    });
    if ('displayName' in sortedRef) {
        // add _hexDisplayName to top
        return {
            _hexDisplayName: textToHex(String(sortedRef.displayName ?? '')),
            ...sortedRef
        };
    }
    if ((sortedRef as any).user?.displayName) {
        // add _hexDisplayName to top
        return {
            _hexDisplayName: textToHex((sortedRef as any).user.displayName),
            ...sortedRef
        };
    }
    if ('name' in sortedRef) {
        // add _hexName to top
        return {
            _hexName: textToHex(String(sortedRef.name ?? '')),
            ...sortedRef
        };
    }
    return sortedRef;
}

function changeHtmlLangAttribute(language: string) {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('lang', language);
}

async function getThemeMode(configRepository: ConfigRepository) {
    const initThemeMode = await configRepository.getString('VRCX_ThemeMode', 'system');

    let isDarkMode;
    if (initThemeMode === 'light') {
        isDarkMode = false;
    } else if (initThemeMode === 'system') {
        isDarkMode = systemIsDarkMode();
    } else {
        isDarkMode = true;
    }

    return { initThemeMode, isDarkMode };
}

function redirectToToolsTab() {
    router.push({ name: 'tools' });
    toast(i18n.global.t('view.tools.redirect_message'), { duration: 3000 });
}

export {
    systemIsDarkMode,
    changeAppThemeStyle,
    useThemeColor,
    applyThemeColor,
    initThemeColor,
    updateTrustColorClasses,
    refreshCustomCss,
    refreshCustomScript,
    applyAppFontFamily,
    applyAppCjkFontPack,
    HueToHex,
    HSVtoRGB,
    formatJsonVars,
    changeHtmlLangAttribute,
    getThemeMode,
    setSystemIsDarkMode,
    redirectToToolsTab
};
