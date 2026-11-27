import { setExceptionEnvelopeSink } from '@common/errors';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { afterEach, expect, it } from 'vitest';
import { createApp, defineComponent } from 'vue';
import { vueExceptionHandler } from './vueExceptionHandler';

afterEach(() => setExceptionEnvelopeSink(undefined));

it.each(['web', 'ios', 'android'] as const)('projects the Vue exception on %s without its component context', async (platform) => {
    const originalPlatform = AppManager.shared.platform;
    const transport = new MessageChannel();
    try {
        AppManager.shared.platform = platform;
        const received = new Promise<{ boundary: string; type: string }>((resolve) => {
            transport.port2.onmessage = event => resolve(event.data);
        });
        setExceptionEnvelopeSink(bytes => transport.port1.postMessage(bytes));
        const defect = new RangeError('canary-member', { cause: new Error('canary-password') });
        defect.stack = 'at canary-component (https://example.invalid/?key=canary-health:1:1)';
        const app = createApp(defineComponent({
            props: { recipient: String },
            data: () => ({ payment: 'canary-payment' }),
            mounted() { throw defect; },
            render() { return null; },
        }), { recipient: 'canary-recipient' });
        app.config.errorHandler = (...args) => {
            // Vue must finish its mounted-hook queue after the development debugger rethrow.
            expect(Reflect.get(args[1]!.$props, 'recipient')).toBe('canary-recipient');
            expect(Reflect.get(args[1]!.$data, 'payment')).toBe('canary-payment');
            expect(() => Reflect.apply(vueExceptionHandler, undefined, args)).toThrow(defect);
        };
        app.mount(document.createElement('div'));
        app.unmount();
        const envelope = await received;
        expect(envelope).toEqual({ boundary: platform === 'web' ? 'browser.vue' : 'capacitor.webview.vue', type: 'RangeError' });
    } finally {
        AppManager.shared.platform = originalPlatform;
        transport.port1.close();
        transport.port2.close();
    }
});
