import { I18n } from '@stamhoofd/backend-i18n';
import { inject } from 'vitest';

export type ApiLocales = [string, [string, string][]][];

declare module 'vitest' {
    interface ProvidedContext {
        apiLocales: ApiLocales;
    }
}

export function loadTestLocales() {
    I18n.loadedLocales = new Map(inject('apiLocales').map(([locale, messages]) => [locale, new Map(messages)]));
}
