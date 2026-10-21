import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Version } from '@stamhoofd/structures';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { NetworkManagerStatic } from './NetworkManager';

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('networking application integration', () => {
    test('each attempt reads current locale and platform metadata', async () => {
        const manager = new NetworkManagerStatic();
        const request = new Request(manager.server, { method: 'GET', path: '/platform' });
        const metadata = await AppManager.shared.getSessionMetaData();
        vi.spyOn(AppManager.shared, 'getSessionMetaData').mockResolvedValue(metadata);
        const locale = vi.spyOn(I18nController.shared, 'locale', 'get').mockReturnValue('nl-BE');

        await manager.onBeforeRequest(request);
        expect(request.version).toBe(Version);
        expect(request.headers['X-Platform']).toBe(AppManager.shared.platform);
        expect(JSON.parse(decodeURIComponent(request.headers['X-Session-Metadata']))).toEqual(metadata);
        expect(request.headers['X-Locale']).toBe('nl-BE');

        locale.mockReturnValue('fr-BE');
        await manager.onBeforeRequest(request);
        expect(request.headers['X-Locale']).toBe('fr-BE');
    });

    test('retrying requests share a notification until all finish', async () => {
        vi.useFakeTimers();
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const show = vi.spyOn(Toast.prototype, 'show').mockImplementation(function (this: Toast) { return this; });
        const manager = new NetworkManagerStatic();
        const first = new Request(manager.server, { method: 'GET', path: '/platform' });
        const second = new Request(manager.server, { method: 'GET', path: '/platform' });

        for (const request of [first, second]) {
            await manager.onBeforeRequest(request);
            await manager.onBeforeRequest(request);
            const retry = manager.shouldRetryNetworkError(request, new Error('offline'));
            await vi.runAllTimersAsync();
            expect(await retry).toBe(true);
        }

        expect(show).toHaveBeenCalledOnce();
        const notification = manager.networkErrorToast!;
        const hide = vi.spyOn(notification, 'hide');
        expect(notification.autohideAfter).toBeNull();
        manager.onNetworkResponse(first, new XMLHttpRequest());
        expect(hide).not.toHaveBeenCalled();
        manager.onFatalNetworkError(second, new Error('cancelled'));
        expect(hide).toHaveBeenCalledOnce();
        expect(manager.networkErrorToast).toBeNull();
        expect(manager.retryingRequestsCount).toBe(0);
    });

    test('native update-required errors invoke the updater without retrying', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(Toast.prototype, 'show').mockImplementation(function (this: Toast) { return this; });
        vi.spyOn(AppManager.shared, 'isNative', 'get').mockReturnValue(true);
        const update = vi.spyOn(AppManager.shared, 'checkUpdates').mockResolvedValue();
        const manager = new NetworkManagerStatic();
        const request = new Request(manager.server, { method: 'GET', path: '/platform' });
        const error = new SimpleErrors(new SimpleError({ code: 'client_update_required', message: 'Update required' }));

        expect(await manager.shouldRetryError(request, new XMLHttpRequest(), error)).toBe(false);
        expect(update).toHaveBeenCalledExactlyOnceWith({
            visibleCheck: 'text',
            visibleDownload: true,
            installAutomatically: true,
        });
    });
});
