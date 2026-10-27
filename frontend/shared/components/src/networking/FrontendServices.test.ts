import { Request, RequestResult } from '@common/networking';
import { LoginHelper } from '@stamhoofd/frontend-application/LoginHelper';
import { MFAManager } from '@stamhoofd/frontend-application/MFAManager';
import { loadSessionLocale } from '@stamhoofd/frontend-application/SessionLocalization';
import { SessionManager } from '@stamhoofd/frontend-application/SessionManager';
import { ThemeManager } from '@stamhoofd/frontend-application/ThemeManager';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { getSessionPresentation } from '@stamhoofd/frontend-session/SessionPresentation';
import { loadPlatformFromStorage, savePlatformToStorage } from '@stamhoofd/frontend-session/loadPlatform';
import { Storage } from '@stamhoofd/frontend-storage/Storage';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { MFAEnrollmentResult, Organization, Platform, SessionOS, Token, UserWithMembers } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ColorHelper } from '../ColorHelper';
import { configureFrontendServices } from '../context/configureFrontendServices';
import { CenteredMessage } from '../overlays/CenteredMessage';

describe('frontend service composition', () => {
    const originalStorage = { keyValue: Storage.keyValue, secure: Storage.secure };
    const originalAppManager = AppManager.shared;
    const originalLocales = I18nController.manualLocales;
    const locales = { [Country.Belgium]: [Language.Dutch, Language.French], [Country.Netherlands]: [Language.Dutch] };

    beforeEach(() => {
        const values = new Map<string, string>();
        Storage.keyValue = Storage.secure = {
            getItem: async key => values.get(key) ?? null,
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async key => { values.delete(key); },
        };
        configureFrontendServices();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        AppManager.shared = originalAppManager;
        Storage.keyValue = originalStorage.keyValue;
        Storage.secure = originalStorage.secure;
        await loadSessionLocale(null, { locales: originalLocales ?? STAMHOOFD.locales });
        I18nController.manualLocales = originalLocales;
    });

    function createToken() {
        return new Token({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            accessTokenValidUntil: new Date(Date.now() + 60 * 60 * 1000),
            refreshTokenValidUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
    }

    function createUser() {
        return UserWithMembers.create({ id: 'user', email: 'user@example.com', language: Language.French });
    }

    test('restores cached platform, credentials and user through the storage owner', async () => {
        const platform = Platform.create({ language: Language.French });
        await savePlatformToStorage(platform);
        const session = new SessionContext(null, platform);
        await session.setToken(createToken());
        session.user = createUser();
        await session.saveToStorage();

        const cachedPlatform = await loadPlatformFromStorage();
        expect(cachedPlatform?.language).toBe(Language.French);
        const restored = await SessionManager.getLastGlobalSession(cachedPlatform!);
        expect(restored.currentAccessToken).toBe('access-token');
        expect(restored.user?.id).toBe('user');
        expect(restored.user?.language).toBe(Language.French);
        expect(restored.isComplete()).toBe(true);
    });

    test.each(['login', 'enrollment'])('%s completion prepares the real session and loads its translations', async (flow) => {
        I18nController.manualLocales = locales;
        const session = new SessionContext(null, Platform.create({}));
        vi.spyOn(session, 'updateData').mockImplementation(async () => { session.user = createUser(); });
        const token = createToken();
        const server = session.identityServer;
        vi.spyOn(session, 'identityServer', 'get').mockReturnValue(server);
        vi.spyOn(server, 'request').mockResolvedValue(new RequestResult(token));

        if (flow === 'login') {
            await LoginHelper.verifyMfaTotp(session, 'mfa-token', '123456');
        }
        else {
            await MFAManager.applyEnrollmentResult(session, MFAEnrollmentResult.create({ token }));
        }

        expect(session.currentAccessToken).toBe('access-token');
        expect(session.preventComplete).toBe(false);
        expect(session.isComplete()).toBe(true);
        expect(I18nController.shared.locale).toBe('fr-BE');
        expect(I18nController.getI18n().locale).toBe('fr-BE');
    });

    test('failed enrollment preparation clears its temporary completion guard', async () => {
        const session = new SessionContext(null, Platform.create({}));
        vi.spyOn(session, 'updateData').mockRejectedValue(new Error('user unavailable'));

        await expect(MFAManager.applyEnrollmentResult(session, MFAEnrollmentResult.create({ token: createToken() }))).rejects.toThrow('user unavailable');
        expect(session.preventComplete).toBe(false);
    });

    test('switching organizations updates loaded messages and subsequent request headers', async () => {
        const first = new SessionContext(Organization.create({}), Platform.create({}));
        first.user = createUser();
        await loadSessionLocale(first, { locales });

        const organization = Organization.create({ language: Language.Dutch });
        organization.address.country = Country.Netherlands;
        const second = new SessionContext(organization, first.platform);
        await loadSessionLocale(second, { locales, country: Country.Netherlands });

        const request = new Request(NetworkManager.server, { method: 'GET', path: '/platform' });
        await NetworkManager.onBeforeRequest(request);
        expect(I18nController.getI18n().locale).toBe('nl-NL');
        expect(request.headers['X-Locale']).toBe('nl-NL');
        first.organization!.address.country = Country.Belgium;
        first.callListeners('organization');
        expect(I18nController.shared.locale).toBe('nl-NL');
    });

    test('native bootstrap overrides are observed by request metadata callbacks', async () => {
        AppManager.shared = new AppManager();
        AppManager.shared.platform = 'ios';
        AppManager.shared.setVersion({ version: '2.40.0', build: '240' });
        AppManager.shared.setNativeDeviceInfo(Promise.resolve({ model: 'iPhone16,1', operatingSystem: 'ios', osVersion: '26.0' }));

        const request = new Request(NetworkManager.server, { method: 'GET', path: '/platform' });
        await NetworkManager.onBeforeRequest(request);
        expect(request.headers['X-Platform']).toBe('ios');
        expect(JSON.parse(decodeURIComponent(request.headers['X-Session-Metadata']))).toMatchObject({
            nativeAppVersion: '2.40.0',
            osName: SessionOS.iOS,
            osVersion: '26.0',
        });
    });

    test('themes use the configured concrete color presentation', () => {
        const setColor = vi.spyOn(ColorHelper, 'setColor').mockImplementation(() => {});
        const platform = Platform.create({});
        platform.config.color = '#336699';
        const session = new SessionContext(null, platform);
        const manager = new ThemeManager(session, 'auto');

        expect(setColor).toHaveBeenCalledExactlyOnceWith('#336699');
        session.removeListener(manager);
    });

    test('session presentation preserves confirmation options', async () => {
        const confirm = vi.spyOn(CenteredMessage, 'confirm').mockResolvedValue(false);

        const options = { title: 'Confirm', confirmText: 'Continue', description: 'Description' };
        expect(await getSessionPresentation().confirm(options)).toBe(false);
        expect(confirm).toHaveBeenCalledExactlyOnceWith(options);
    });
});
