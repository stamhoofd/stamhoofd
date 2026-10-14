import { afterEach, describe, expect, test, vi } from 'vitest';
import { configureNetworkingPresentation, NetworkingPresentation } from './NetworkingPresentation';

const original = { ...NetworkingPresentation };
afterEach(() => {
    configureNetworkingPresentation(original);
});

describe('Networking presentation', () => {
    test('headless defaults cannot approve confirmation and return safe notification handles', async () => {
        await expect(NetworkingPresentation.confirm({ title: 'Confirm', confirmText: 'Continue' })).resolves.toBe(false);
        expect(() => NetworkingPresentation.notify('Message', 'info').hide()).not.toThrow();
        expect(() => NetworkingPresentation.notifyError(new Error('Failure')).hide()).not.toThrow();
    });

    test('configuration updates the existing holder and can be restored between consumers', async () => {
        const reference = NetworkingPresentation;
        const hide = vi.fn();
        const callbacks = {
            notify: vi.fn(() => ({ hide })),
            notifyError: vi.fn(() => ({ hide })),
            confirm: vi.fn(async () => true),
        };
        configureNetworkingPresentation(callbacks);

        expect(NetworkingPresentation).toBe(reference);
        reference.notify('Message', 'info', 100).hide();
        expect(callbacks.notify).toHaveBeenCalledWith('Message', 'info', 100);
        expect(hide).toHaveBeenCalledOnce();
        const error = new Error('Failure');
        reference.notifyError(error, null);
        expect(callbacks.notifyError).toHaveBeenCalledWith(error, null);
        const question = { title: 'Confirm', confirmText: 'Continue' };
        await expect(reference.confirm(question)).resolves.toBe(true);
        expect(callbacks.confirm).toHaveBeenCalledWith(question);

        configureNetworkingPresentation(original);
        await expect(reference.confirm(question)).resolves.toBe(false);
    });
});
