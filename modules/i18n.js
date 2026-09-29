// Minimal i18n: flat dictionaries, {var} interpolation and data-i18n attributes for static HTML.
import es from './locales/es.js';
import en from './locales/en.js';

const DICTS = { es, en };
export const LANGS = Object.keys(DICTS);

function detect() {
    try {
        const saved = localStorage.getItem('jaw-lang');
        if (saved && DICTS[saved]) return saved;
    } catch (e) { /* storage unavailable */ }
    const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return DICTS[nav] ? nav : 'es';
}

export let lang = detect();

/**
 * Translates a key. {name} placeholders are replaced only when `vars` has that
 * name, so LaTeX braces such as \hat{u} are left untouched.
 */
export function t(key, vars) {
    let s = DICTS[lang][key] ?? DICTS.es[key];
    if (s === undefined) {
        console.warn(`[i18n] missing key: ${key}`);
        return key;
    }
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Number formatting with the current locale (decimal comma in Spanish). */
export function fmt(x, d = 0) {
    const r = Number(x.toFixed(d));
    return (r === 0 ? 0 : r).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        minimumFractionDigits: d,
        maximumFractionDigits: d
    });
}

export function setLang(l) {
    if (!DICTS[l]) return;
    lang = l;
    try { localStorage.setItem('jaw-lang', l); } catch (e) { /* ignore */ }
}

/**
 * Fills static markup:
 *   data-i18n="key"                      -> innerHTML
 *   data-i18n-attr="title:key;aria-label:key2" -> attributes
 */
export function applyStatic(root = document) {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = t('meta.desc');
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        el.innerHTML = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
        el.dataset.i18nAttr.split(';').forEach((pair) => {
            const [attr, key] = pair.split(':').map((s) => s.trim());
            if (attr && key) el.setAttribute(attr, t(key));
        });
    });
}
