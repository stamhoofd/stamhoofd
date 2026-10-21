import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Platform } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { SessionManagerStatic } from './SessionManager';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('session preparation', () => {
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
            $context: session,
            defaultCountry: Country.Belgium,
            defaultLanguage: Language.Dutch,
            country: undefined,
        });
    });
});
