// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

import { ViewportHelper } from '@stamhoofd/components/ViewportHelper.ts';
import { VueGlobalHelper } from '@stamhoofd/components/VueGlobalHelper.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { createApp } from 'vue';

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

import App from './App.vue';

// iPads get the desktop layout: the iOS styles are designed for phones and waste too much space on a tablet
const os = AppManager.shared.isIPad ? 'macOS' : AppManager.shared.getOS();
document.body.classList.add((AppManager.shared.isNative ? 'native-' : 'web-') + os);

const app = createApp(App);
VueGlobalHelper.setup(app, { os });

const i18n = I18nController.getI18n();
I18nController.fixedCountry = true;
app.use(i18n);

if (!isPrerender) {
    ViewportHelper.setup(true);
}

app.mount('#app');
