import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { afterEach, expect, test, vi } from 'vitest';
import { isReactive } from 'vue';
import { Toast, ToastButton } from './Toast';

const owner = {};

afterEach(() => {
    Toast.removeListener(owner);
    vi.restoreAllMocks();
    vi.useRealTimers();
});

test('toasts are reactive and are not delivered until shown', () => {
    const listener = vi.fn();
    Toast.addListener(owner, listener);

    const toast = new Toast('Bezig', 'spinner').setHide(null).setProgress(0);
    expect(isReactive(toast)).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    expect(toast.show()).toBe(toast);
    expect(listener).toHaveBeenCalledExactlyOnceWith(toast);

    toast.message = 'Bijna klaar';
    toast.setProgress(0.5);
    expect(listener.mock.calls[0][0]).toMatchObject({ message: 'Bijna klaar', progress: 0.5, autohideAfter: null });

    const hide = vi.fn();
    toast.doHide = hide;
    toast.hide();
    toast.hide();
    expect(hide).toHaveBeenCalledOnce();
});

test('factories preserve icons, default timeouts and button configuration', () => {
    expect(Toast.success('Klaar')).toMatchObject({ icon: 'success green', autohideAfter: 8000 });
    expect(Toast.error('Fout').icon).toBe('error red');
    expect(Toast.warning('Let op').icon).toBe('warning yellow');
    expect(Toast.info('Info').icon).toBe('info');

    const action = vi.fn();
    const button = new ToastButton('Download', action, 'download').setHref('/file').setDownload('file.pdf');
    const toast = new Toast('Klaar').setButton(button).setForceButtonClick().setTestId('download-toast');
    expect(toast).toMatchObject({ forceButtonClick: true, testId: 'download-toast', button: { href: '/file', download: 'file.pdf' } });
    toast.button!.action();
    expect(action).toHaveBeenCalledOnce();
});

test('show waits for a renderer listener and removal stops delivery to that listener', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const toast = Toast.info('Wachten');
    toast.show();
    Toast.addListener(owner, listener);
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledExactlyOnceWith(toast);
    Toast.removeListener(owner);
    toast.show();
    expect(listener).toHaveBeenCalledOnce();
    vi.clearAllTimers();
});

test('error factories retain human messages and network/module-load fallbacks', () => {
    const error = new SimpleError({ code: 'invalid', message: 'Niet geldig', human: 'Controleer de gegevens' });
    expect(Toast.fromError(error).message).toBe('Controleer de gegevens');
    expect(Toast.fromError(new SimpleErrors(error)).message).toBe('Controleer de gegevens');
    expect(Toast.fromError(new Error('Onverwacht')).message).toBe('Onverwacht');
    expect(Toast.fromError(new Error('Failed to fetch dynamically imported module')).message).toBe($t('%ge'));
    vi.spyOn(Request, 'isNetworkError').mockReturnValue(true);
    expect(Toast.fromError(new Error('Network error')).message).toBe($t('%ge'));
});
