// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

import { VueGlobalHelper } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { defineCustomElement } from 'vue';

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

import App from './App.ce.vue';
import { I18nController } from '@stamhoofd/frontend-i18n';

document.body.classList.add((AppManager.shared.isNative ? 'native-' : 'web-') + AppManager.shared.getOS());

const PriceCalculator = defineCustomElement(App, {
    configureApp(app) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        VueGlobalHelper.setup(app as any);

        const i18n = I18nController.getI18n();
        I18nController.fixedCountry = true;
        app.use(i18n);
    },
});
customElements.define('price-calculator', PriceCalculator);

if (!isPrerender) {
    // ViewportHelper.setup(true);
}

// app.mount('#calculator-app');
