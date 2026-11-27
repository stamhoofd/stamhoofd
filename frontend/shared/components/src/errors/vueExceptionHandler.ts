import { captureExceptionEnvelope } from '@common/errors';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';

export function vueExceptionHandler(error: unknown) {
    captureExceptionEnvelope(AppManager.shared.isNative ? 'capacitor.webview.vue' : 'browser.vue', error);
    console.error('Vue caught an exception');
    if (import.meta.env.DEV) throw error;
}
