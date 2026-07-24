// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

// Continue
import { ViewportHelper } from '@stamhoofd/components/ViewportHelper.ts';
import { VueGlobalHelper } from '@stamhoofd/components/VueGlobalHelper.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { init as initPlausible, track } from '@plausible-analytics/tracker';
import { createApp } from 'vue';

// Load ...NextVersion
import '@stamhoofd/structures/Version.js';

import App from './src/App.vue';

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

document.body.classList.add((AppManager.shared.isNative ? 'native-' : 'web-') + AppManager.shared.getOS());

const app = createApp(App);
VueGlobalHelper.setup(app);

const i18n = I18nController.getI18n();
app.use(i18n);

if (!isPrerender) {
    ViewportHelper.setup(true);
}

if (!isPrerender && STAMHOOFD.PLAUSIBLE_DOMAIN && STAMHOOFD.environment === 'production') {
    // Use the bundled tracker instead of loading plausible.js from an external origin (blocked by our CSP).
    // Events are sent via fetch/sendBeacon (connect-src), not by loading an external script.
    initPlausible({ domain: STAMHOOFD.PLAUSIBLE_DOMAIN });
    (window as any).plausible = (name: string, args: Parameters<typeof track>[1]) => {
        try {
            track(name, args);
        } catch (e) {
            console.error('Plausible error', e);
        }
    };
} else {
    (window as any).plausible = function (...args: unknown[]) {
        console.log('Debug plausible with args ', args);
    };
}
app.mount('#app');
