import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { SimpleError } from '@common/errors';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import { Organization, Platform } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { SessionManagerStatic } from './SessionManager';
import { loadSessionLocale } from './SessionLocalization';

afterEach(async () => {
    await loadSessionLocale(null);
    vi.restoreAllMocks();
});

describe('session preparation', () => {
    test('an invalid organization from a background update uses the shared toast service', async () => {
        const session = new SessionContext(Organization.create({}), Platform.create({}));
        vi.spyOn(session, 'enableStorage').mockImplementation(() => {});
        vi.spyOn(session, 'isComplete').mockReturnValue(true);
        vi.spyOn(session, 'saveToStorage').mockResolvedValue();
        vi.spyOn(session, 'updateData').mockRejectedValue(new SimpleError({ code: 'invalid_organization', message: 'Invalid organization' }));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(I18nController, 'loadDefault').mockResolvedValue();
        const show = vi.spyOn(Toast.prototype, 'show').mockImplementation(function (this: Toast) { return this; });
        const manager = new SessionManagerStatic();
        const storage = await manager.getSessionStorage();
        vi.spyOn(manager, 'getSessionStorage').mockResolvedValue(storage);
        vi.spyOn(manager, 'saveSessionStorage').mockImplementation(() => {});
        vi.spyOn(manager, 'removeOrganizationFromStorage').mockResolvedValue();
        vi.spyOn(manager, 'addOrganizationToStorage').mockResolvedValue();

        await manager.prepareSessionForUsage(session);

        await vi.waitFor(() => expect(show).toHaveBeenCalledOnce());
        expect(show.mock.instances[0]).toMatchObject({ message: $t('%kz'), icon: 'error red', autohideAfter: 8000 });
        expect(session.organization!.active).toBe(false);
        expect(session.preventComplete).toBe(true);
        session.removeListener(manager);
    });

    test('initializes localization before returning the prepared session', async () => {
        const session = new SessionContext(null, Platform.create({}));
        vi.spyOn(session, 'enableStorage').mockImplementation(() => {});
        vi.spyOn(session, 'updateData').mockResolvedValue();
        vi.spyOn(session, 'saveToStorage').mockResolvedValue();
        const manager = new SessionManagerStatic();
        const storage = await manager.getSessionStorage();
        vi.spyOn(manager, 'getSessionStorage').mockResolvedValue(storage);
        vi.spyOn(manager, 'saveSessionStorage').mockImplementation(() => {});
        const load = vi.spyOn(I18nController, 'loadDefault').mockResolvedValue();

        expect(await manager.prepareSessionForUsage(session)).toBe(session);
        expect(load).toHaveBeenCalledExactlyOnceWith({
            preferredLanguage: undefined,
            fallbackLanguage: session.platform.language,
            fallbackCountry: undefined,
            defaultCountry: Country.Belgium,
            defaultLanguage: Language.Dutch,
            country: undefined,
        });
    });
});
