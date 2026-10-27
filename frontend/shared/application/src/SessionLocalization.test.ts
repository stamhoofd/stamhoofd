import { UrlHelper } from '@browser/navigation';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { ImpersonatedBy, Organization, Platform, UserWithMembers } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadSessionLocale } from './SessionLocalization';

describe('session localization', () => {
    const originalUrl = UrlHelper.initial.url.href;
    const locales = { [Country.Belgium]: [Language.Dutch, Language.French, Language.English], [Country.Netherlands]: [Language.Dutch] };

    beforeEach(() => {
        UrlHelper.initial.url.pathname = '/fr-BE';
        vi.spyOn(I18nController, 'getLocaleFromStorage').mockResolvedValue({ language: Language.English });
        vi.spyOn(I18nController.prototype, 'loadLocale').mockResolvedValue();
        vi.spyOn(I18nController.prototype, 'updateUrl').mockResolvedValue();
        vi.spyOn(I18nController.prototype, 'saveLocaleToStorage').mockResolvedValue();
    });

    afterEach(async () => {
        await loadSessionLocale(null);
        I18nController.manualLocales = undefined;
        UrlHelper.initial.url.href = originalUrl;
        vi.restoreAllMocks();
    });

    function createSession() {
        const session = new SessionContext(Organization.create({}), Platform.create({ language: Language.French }));
        session.user = UserWithMembers.create({ email: 'user@example.com', language: Language.Dutch });
        return session;
    }

    test('the user preference wins over storage and the URL', async () => {
        await loadSessionLocale(createSession(), { country: Country.Belgium, locales });
        expect(I18nController.shared.language).toBe(Language.Dutch);
        expect(I18nController.shared.usingStoredLanguage).toBe(false);
    });

    test('impersonation ignores the user preference', async () => {
        const session = createSession();
        session.user!.impersonatedBy = ImpersonatedBy.create({ id: 'administrator', email: 'admin@example.com' });
        await loadSessionLocale(session, { country: Country.Belgium, locales });
        expect(I18nController.shared.language).toBe(Language.English);
        expect(I18nController.shared.usingStoredLanguage).toBe(true);
    });

    test('organization language and country precede the platform fallback', async () => {
        vi.mocked(I18nController.getLocaleFromStorage).mockResolvedValue({});
        UrlHelper.initial.url.pathname = '/';
        const session = createSession();
        session.user = null;
        session.organization!.language = Language.Dutch;
        session.organization!.address.country = Country.Netherlands;
        await loadSessionLocale(session, { locales });
        expect(I18nController.shared.locale).toBe('nl-NL');
    });

    test('the platform language is used without a user or organization', async () => {
        vi.mocked(I18nController.getLocaleFromStorage).mockResolvedValue({});
        UrlHelper.initial.url.pathname = '/';
        const session = new SessionContext(null, Platform.create({ language: Language.French }));
        await loadSessionLocale(session, { country: Country.Belgium, locales });
        expect(I18nController.shared.language).toBe(Language.French);
    });

    test('storage and URL settings precede organization fallbacks', async () => {
        const session = createSession();
        session.user = null;
        session.organization!.language = Language.Dutch;
        session.organization!.address.country = Country.Netherlands;
        await loadSessionLocale(session, { locales });
        expect(I18nController.shared.locale).toBe('en-BE');

        vi.mocked(I18nController.getLocaleFromStorage).mockResolvedValue({});
        await loadSessionLocale(session, { locales });
        expect(I18nController.shared.locale).toBe('fr-BE');
    });

    test('only the active session updates country on organization changes', async () => {
        const first = createSession();
        await loadSessionLocale(first, { country: Country.Belgium, locales });
        const second = createSession();
        await loadSessionLocale(second, { country: Country.Belgium, locales });
        const switchLocale = vi.spyOn(I18nController.shared, 'switchToLocale').mockResolvedValue();

        first.callListeners('organization');
        second.callListeners('user');
        expect(switchLocale).not.toHaveBeenCalled();

        second.organization!.address.country = Country.Netherlands;
        second.callListeners('organization');
        expect(switchLocale).toHaveBeenCalledExactlyOnceWith({ country: Country.Netherlands });
    });

    test('loading without a session removes the previous subscription', async () => {
        const session = createSession();
        await loadSessionLocale(session, { country: Country.Belgium, locales });
        const removeListener = vi.spyOn(session, 'removeListener');
        await loadSessionLocale(null, { country: Country.Belgium, locales });
        const switchLocale = vi.spyOn(I18nController.shared, 'switchToLocale').mockResolvedValue();

        session.callListeners('organization');

        expect(removeListener).toHaveBeenCalledOnce();
        expect(switchLocale).not.toHaveBeenCalled();
    });
});
