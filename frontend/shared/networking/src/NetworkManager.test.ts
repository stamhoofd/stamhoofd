import { SimpleError, SimpleErrors } from '@common/errors';
import { Request } from '@common/networking';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import { Version } from '@stamhoofd/structures';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NetworkManagerStatic } from './NetworkManager';
import { configureNetworking, getNetworkingConfiguration } from './NetworkingConfiguration';

describe('transport callbacks', () => {
    let restore: ReturnType<typeof getNetworkingConfiguration>;
    const headers = vi.fn(async () => ({ 'X-Locale': 'nl-BE' }));
    const onClientUpdateRequired = vi.fn();
    const onNewerVersion = vi.fn();

    beforeEach(() => {
        restore = getNetworkingConfiguration();
        configureNetworking({ getRequestHeaders: headers, onClientUpdateRequired, onNewerVersion });
    });

    afterEach(() => {
        configureNetworking(restore);
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    test('reads configured headers for each attempt', async () => {
        const manager = new NetworkManagerStatic();
        const request = new Request(manager.server, { method: 'GET', path: '/platform' });
        await manager.onBeforeRequest(request);
        expect(request.version).toBe(Version);
        expect(request.headers['X-Locale']).toBe('nl-BE');
        headers.mockResolvedValueOnce({ 'X-Locale': 'fr-BE' });
        await manager.onBeforeRequest(request);
        expect(request.headers['X-Locale']).toBe('fr-BE');
        expect(headers).toHaveBeenCalledTimes(2);
    });

    test('shares a retry notification until all requests finish', async () => {
        vi.useFakeTimers();
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const show = vi.spyOn(Toast.prototype, 'show').mockImplementation(function (this: Toast) { return this; });
        const manager = new NetworkManagerStatic();
        const requests = [0, 1].map(() => new Request(manager.server, { method: 'GET', path: '/platform' }));
        for (const request of requests) {
            await manager.onBeforeRequest(request);
            await manager.onBeforeRequest(request);
            const retry = manager.shouldRetryNetworkError(request, new Error('offline'));
            await vi.runAllTimersAsync();
            expect(await retry).toBe(true);
        }
        expect(show).toHaveBeenCalledOnce();
        const notification = manager.networkErrorToast!;
        expect(notification).toMatchObject({ message: $t('%ks'), icon: 'spinner', autohideAfter: null });
        const hide = vi.spyOn(notification, 'hide');
        manager.onNetworkResponse(requests[0], new XMLHttpRequest());
        expect(hide).not.toHaveBeenCalled();
        manager.onFatalNetworkError(requests[1], new Error('cancelled'));
        expect(hide).toHaveBeenCalledOnce();
        expect(manager.networkErrorToast).toBeNull();
        expect(manager.retryingRequestsCount).toBe(0);
    });

    test('reports update-required errors without retrying', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const manager = new NetworkManagerStatic();
        const request = new Request(manager.server, { method: 'GET', path: '/platform' });
        const error = new SimpleErrors(new SimpleError({ code: 'client_update_required', message: 'Update required' }));
        expect(await manager.shouldRetryError(request, new XMLHttpRequest(), error)).toBe(false);
        expect(onClientUpdateRequired).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('reports each newer server version once', () => {
        const manager = new NetworkManagerStatic();
        const request = new Request(manager.server, { method: 'GET', path: '/platform' });
        const response = new XMLHttpRequest();
        vi.spyOn(response, 'getResponseHeader').mockImplementation(name => name === 'X-Platform-Latest-Version' ? String(Version + 1) : null);
        manager.onNetworkResponse(request, response);
        manager.onNetworkResponse(request, response);
        expect(onNewerVersion).toHaveBeenCalledExactlyOnceWith(Version + 1);
    });
});
