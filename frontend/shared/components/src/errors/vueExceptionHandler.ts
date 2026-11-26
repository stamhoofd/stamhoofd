import type { App } from 'vue';
import { vueIntegration } from '@sentry/vue';
import { configureVueExceptions } from './vue-exceptions.js';
import { captureExceptionEnvelope } from '@common/errors';
import type { ExceptionArtifacts, ExceptionDeployment } from '@common/errors';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';

declare const __STAM_ERRORS_DEPLOYMENT__: ExceptionDeployment | null;
declare const __STAM_OWNED_EXCEPTION_ARTIFACT__: ExceptionArtifacts;
let client: ReturnType<typeof configureVueExceptions>;

export function installBrowserExceptions(app: App) {
    if (AppManager.shared.isNative || typeof __STAM_ERRORS_DEPLOYMENT__ === 'undefined' || !__STAM_ERRORS_DEPLOYMENT__) return;
    if (client) {
        // Each calculator element creates a Vue app; global capture is shared by the page.
        vueIntegration({ app, attachProps: false }).setup?.(client);
        return;
    }
    client = configureVueExceptions(app, __STAM_ERRORS_DEPLOYMENT__, url => typeof __STAM_OWNED_EXCEPTION_ARTIFACT__ === 'function' ? __STAM_OWNED_EXCEPTION_ARTIFACT__(url) : undefined);
}

export function vueExceptionHandler(error: unknown) {
    if (!client) captureExceptionEnvelope(AppManager.shared.isNative ? 'capacitor.webview.vue' : 'browser.vue', error);
    console.error('Vue caught an exception');
    if (import.meta.env.DEV) throw error;
}
