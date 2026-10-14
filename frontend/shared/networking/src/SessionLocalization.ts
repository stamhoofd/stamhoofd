import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { SessionContext } from './SessionContext';

const owner = {};
let currentSession: SessionContext | null = null;

/** Load session locale preferences and follow organization country changes until the next load. */
export async function loadSessionLocale(session: SessionContext | null, options: Omit<Parameters<typeof I18nController.loadDefault>[0], 'preferredLanguage' | 'fallbackLanguage' | 'fallbackCountry'> = {}) {
    currentSession?.removeListener(owner);
    currentSession = session;

    await I18nController.loadDefault({
        ...options,
        preferredLanguage: session?.user?.impersonatedBy ? undefined : session?.user?.language,
        fallbackLanguage: session?.organization?.language || session?.platform.language,
        fallbackCountry: session?.organization?.address.country,
    });

    const controller = I18nController.shared;
    session?.addListener(owner, (changed) => {
        if (changed === 'organization' && session.organization && I18nController.shared === controller) {
            controller.switchToLocale({ country: session.organization.address.country }).catch(console.error);
        }
    });
}
