import type { Country } from './Country.js';
import type { Language } from './Language.js';

export { };

/**
 * Importing this file (for its side effects) registers the global helpers that Stamhoofd
 * makes available everywhere: frontend, backend and shared. They are assigned at runtime
 * during app bootstrap; this declaration only provides their types.
 */
declare global {
    const $t: (key: string, replace?: Record<string, string | { toString(): string }>) => string;
    const $getCountry: () => Country;
    const $getLanguage: () => Language;
}
