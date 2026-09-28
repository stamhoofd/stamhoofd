import type { Plugin } from 'vite';

/**
 * Replaces the locale JSON files (loaded by I18nController via a dynamic import) with empty objects,
 * for builds that never load a locale and only use manually set messages.
 */
export default function emptyLocalesPlugin(): Plugin {
    return {
        name: 'empty-locales-plugin',
        enforce: 'pre',
        load(id) {
            if (id.includes('/shared/locales/dist/locales/') && id.endsWith('.json')) {
                return '{}';
            }
            return null;
        },
    };
}
